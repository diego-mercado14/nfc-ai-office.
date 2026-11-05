"""Authenticated HTTP adapter. Bind loopback; use a trusted HTTPS proxy remotely."""

import argparse
import getpass
import hmac
import json
import os
import sqlite3
import time
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse
import domain as d
import security

ORIGIN = os.environ.get("NFC_ORIGIN", f"http://127.0.0.1:{d.PORT}").rstrip("/")
SECURE = ORIGIN.startswith("https://")


class App(BaseHTTPRequestHandler):
    def setup(self):
        super().setup()
        self.connection.settimeout(75)

    def log_message(self, *_):
        pass  # Do not log personal data, cookies or request bodies.

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
        )
        if SECURE:
            self.send_header("Strict-Transport-Security", "max-age=31536000")
        super().end_headers()

    def reply(self, status, value, cookie=None):
        data = json.dumps(value, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        if cookie:
            self.send_header("Set-Cookie", cookie)
        self.end_headers()
        self.wfile.write(data)

    def cookie(self, token, age=28800):
        return (
            f"nfc_session={token}; Path=/; HttpOnly; SameSite=Strict; Max-Age={age}"
            + ("; Secure" if SECURE else "")
        )

    def session(self):
        cookies = SimpleCookie()
        try:
            cookies.load(self.headers.get("Cookie", ""))
        except Exception:
            return None
        token = cookies.get("nfc_session")
        if not token:
            return None
        found = d.query(
            "SELECT s.*,u.username FROM sessions s JOIN users u ON u.id=s.user_id WHERE token=? AND expires>?",
            (security.digest(token.value), time.time()),
        )
        return found[0] if found else None

    def body(self):
        if self.headers.get("Content-Type", "").split(";")[0] != "application/json":
            raise ValueError("Se requiere JSON")
        size = int(self.headers.get("Content-Length", "0"))
        if not 0 < size <= 30000:
            raise ValueError("Longitud inválida")
        obj = json.loads(self.rfile.read(size))
        if not isinstance(obj, dict):
            raise ValueError("Se requiere objeto JSON")
        return obj

    def handle_api(self, method):
        path = urlparse(self.path).path
        if self.headers.get("Host") != urlparse(ORIGIN).netloc:
            return self.reply(403, {"error": "Host no autorizado"})
        if method == "GET" and path == "/api/health":
            return self.reply(200, {"ok": True})
        if method == "GET" and path in d.MIME:
            file = (
                d.ROOT
                / "web"
                / ("index.html" if path in ("/", "/index.html") else path[1:])
            )
            data = file.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", d.MIME[path])
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        if method != "GET":
            origin = self.headers.get("Origin")
            if origin and origin != ORIGIN:
                return self.reply(403, {"error": "Origen no autorizado"})
        obj = self.body() if method != "GET" else {}
        if method == "POST" and path == "/api/login":
            username = obj.get("username", "")
            password = obj.get("password", "")
            if (
                not isinstance(username, str)
                or not isinstance(password, str)
                or len(password) > 256
                or len(username) > 60
            ):
                raise ValueError("Credenciales inválidas")
            with d.connect() as c:
                c.execute("BEGIN IMMEDIATE")
                result = security.login(c, username, password, self.client_address[0])
            if not result:
                return self.reply(401, {"error": "Credenciales inválidas"})
            token = result.pop("token")
            return self.reply(200, result, self.cookie(token))
        session = self.session()
        if not session:
            return self.reply(401, {"error": "Inicia sesión"})
        if method != "GET" and not hmac.compare_digest(
            self.headers.get("X-CSRF-Token", ""), session["csrf"]
        ):
            return self.reply(
                403, {"error": "Token de sesión inválido; vuelve a iniciar sesión"}
            )
        if method == "GET" and path == "/api/session":
            return self.reply(
                200,
                {
                    "username": session["username"],
                    "id": session["user_id"],
                    "csrf": session["csrf"],
                },
            )
        if method == "POST" and path == "/api/logout":
            with d.connect() as c:
                c.execute("DELETE FROM sessions WHERE token=?", (session["token"],))
            return self.reply(200, {"ok": True}, self.cookie("", 0))
        if method == "GET" and path == "/api/state":
            return self.reply(200, d.snapshot())
        if method == "POST" and path == "/api/agents/run":
            agent = obj.get("agent")
            pid = (
                d.integer(obj["prospect_id"])
                if obj.get("prospect_id") not in (None, "", "0", 0)
                else None
            )
            if agent not in ("coordinador", "prospeccion", "ventas", "finanzas"):
                raise ValueError("Agente desconocido")
            if agent in ("coordinador", "finanzas"):
                state = d.snapshot()
                m = state["metrics"]
                mxn = lambda value: f"${value / 100:,.2f} MXN"
                lines = [
                    f"Ventas confirmadas: {mxn(m['sales'])}",
                    f"Cobrado: {mxn(m['collected'])}",
                    f"Por cobrar: {mxn(m['balance'])}",
                    f"Margen estimado: {mxn(m['profit'])}",
                    f"Socio A: {mxn(m['share_a'])} · Socio B: {mxn(m['share_b'])}",
                ]
                if agent == "coordinador":
                    lines += ["TAREAS PENDIENTES (por fecha límite)"]
                    lines += [
                        f"Tarea #{t['id']} · {t['due']} · {t['title']}"
                        for t in sorted(state["tasks"], key=lambda t: t["due"])
                        if not t["done"]
                    ]
                else:
                    lines += ["EVIDENCIA POR PEDIDO"]
                    lines += [
                        f"Pedido #{o['id']} · cotización #{o['quote_id']} · saldo {mxn(o['balance'])} · margen {mxn(o['profit'])}"
                        for o in state["orders"]
                    ]
                lines += [
                    "Fuente: registros internos al ejecutar. Margen = ventas − costo directo − gastos registrados. No es utilidad fiscal ni dinero disponible para retirar."
                ]
                result = "\n".join(lines)
                with d.connect() as c:
                    rid = c.execute(
                        "INSERT INTO agent_runs(agent,result,mode) VALUES (?,?,?)",
                        (agent, result, "reglas"),
                    ).lastrowid
                output = {"id": rid, "result": result, "mode": "reglas"}
            else:
                output = d.run_agent(agent, pid)
            with d.connect() as c:
                c.execute(
                    "INSERT INTO audit(user_id,action) VALUES (?,?)",
                    (
                        session["user_id"],
                        "agente " + str(agent) + " #" + str(output["id"]),
                    ),
                )
            return self.reply(200, output)
        if method in ("POST", "PATCH") and path.startswith("/api/"):
            with d.connect() as c:
                c.execute("BEGIN IMMEDIATE")
                ident = d.mutate(c, method, path, obj, session["user_id"])
                c.execute(
                    "INSERT INTO audit(user_id,action) VALUES (?,?)",
                    (session["user_id"], method + " " + path + " #" + str(ident)),
                )
            return self.reply(
                201 if method == "POST" else 200, {"id": ident, "ok": True}
            )
        return self.reply(404, {"error": "Ruta desconocida"})

    def dispatch(self, method):
        try:
            self.handle_api(method)
        except (ValueError, TypeError, OverflowError, KeyError, sqlite3.IntegrityError):
            self.reply(
                400,
                {
                    "error": "Datos inválidos, registro inexistente o duplicado. Revisa los campos y el estado de la operación."
                },
            )
        except (BrokenPipeError, ConnectionResetError, TimeoutError):
            pass
        except Exception:
            self.reply(
                500,
                {
                    "error": "Error interno; revisa el servidor sin compartir datos privados"
                },
            )

    def do_GET(self):
        self.dispatch("GET")

    def do_POST(self):
        self.dispatch("POST")

    def do_PATCH(self):
        self.dispatch("PATCH")


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "command",
        choices=["serve", "create-user", "reset-password"],
        nargs="?",
        default="serve",
    )
    parser.add_argument("--username")
    args = parser.parse_args()
    d.init_db()
    if args.command != "serve":
        username = args.username or input("Usuario: ").strip()
        password = getpass.getpass("Contraseña (12+ caracteres): ")
        if password != getpass.getpass("Repetir contraseña: "):
            raise SystemExit("No coinciden")
        with d.connect() as c:
            c.execute("BEGIN IMMEDIATE")
            if args.command == "create-user":
                security.create_user(c, username, password)
            else:
                if not 12 <= len(password) <= 256:
                    raise SystemExit("Longitud inválida")
                user = c.execute(
                    "SELECT id FROM users WHERE username=?", (username,)
                ).fetchone()
                if not user:
                    raise SystemExit("Usuario inexistente")
                c.execute(
                    "UPDATE users SET password=? WHERE id=?",
                    (security.password_hash(password), user["id"]),
                )
                c.execute("DELETE FROM sessions WHERE user_id=?", (user["id"],))
        print("Cuenta actualizada")
        return
    print("NFC AI Office 1.0 · acceso local protegido · puerto", d.PORT)
    ThreadingHTTPServer(("127.0.0.1", d.PORT), App).serve_forever()


if __name__ == "__main__":
    main()
