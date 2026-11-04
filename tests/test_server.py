"""Integration tests use isolated SQLite, real HTTP and two authenticated partners."""

import http.client
import json
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch
from http.server import ThreadingHTTPServer
import domain as d
import security
import server


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.old_db = d.DB
        d.DB = Path(self.tmp.name) / "test.db"
        d.init_db()
        with d.connect() as c:
            security.create_user(c, "socio_a", "password-test-A")
            security.create_user(c, "socio_b", "password-test-B")
        self.http = ThreadingHTTPServer(("127.0.0.1", 0), server.App)
        self.thread = threading.Thread(target=self.http.serve_forever, daemon=True)
        self.thread.start()
        self.old_origin = server.ORIGIN
        server.ORIGIN = f"http://127.0.0.1:{self.http.server_port}"
        self.cookie = ""
        self.csrf = ""
        self.signin()

    def tearDown(self):
        self.http.shutdown()
        self.http.server_close()
        self.thread.join()
        server.ORIGIN = self.old_origin
        d.DB = self.old_db
        self.tmp.cleanup()

    def request(self, path, method="GET", payload=None, headers=None):
        c = http.client.HTTPConnection("127.0.0.1", self.http.server_port, timeout=5)
        h = {
            "Cookie": self.cookie,
            "X-CSRF-Token": self.csrf,
            "Content-Type": "application/json",
        }
        h.update(headers or {})
        c.request(method, path, json.dumps(payload) if payload is not None else None, h)
        r = c.getresponse()
        raw = r.read()
        self.last_headers = dict(r.getheaders())
        status = r.status
        c.close()
        return status, json.loads(raw) if raw.startswith(b"{") else raw

    def signin(self, username="socio_a", password="password-test-A"):
        code, result = self.request(
            "/api/login", "POST", {"username": username, "password": password}
        )
        self.assertEqual(code, 200)
        self.cookie = self.last_headers["Set-Cookie"].split(";")[0]
        self.csrf = result["csrf"]

    def post(self, path, obj):
        status, data = self.request("/api/" + path, "POST", obj)
        self.assertIn(status, (200, 201), data)
        return data

    def state(self):
        return self.request("/api/state")[1]

    def prospect(self):
        return self.post("prospects", {"business": "Café de prueba", "phone": "000"})[
            "id"
        ]

    def order(self):
        pid = self.prospect()
        q = self.post(
            "quotes",
            {
                "prospect_id": pid,
                "quantity": 2,
                "total": "500.01",
                "unit_cost": "20.00",
            },
        )["id"]
        self.assertEqual(
            self.request("/api/quotes/" + str(q), "PATCH", {"status": "aceptada"})[0],
            200,
        )
        return self.post("orders", {"quote_id": q})["id"], q

    def test_authentication_csrf_origin_and_logout(self):
        self.assertEqual(self.request("/api/state", headers={"Cookie": ""})[0], 401)
        self.assertEqual(
            self.request(
                "/api/prospects", "POST", {"business": "x"}, {"X-CSRF-Token": ""}
            )[0],
            403,
        )
        self.assertEqual(
            self.request(
                "/api/prospects",
                "POST",
                {"business": "x"},
                {"Origin": "https://evil.example"},
            )[0],
            403,
        )
        self.assertEqual(
            self.request("/api/state", headers={"Host": "evil.example"})[0], 403
        )
        self.post("logout", {})
        self.assertEqual(self.request("/api/state")[0], 401)

    def test_passwords_and_session_storage(self):
        user = d.query("SELECT * FROM users")[0]
        self.assertNotIn("password-test", user["password"])
        self.assertNotIn(
            self.cookie.split("=")[1], d.query("SELECT * FROM sessions")[0]["token"]
        )
        self.signin()
        self.assertIn("HttpOnly", self.last_headers["Set-Cookie"])
        self.assertIn("SameSite=Strict", self.last_headers["Set-Cookie"])
        self.assertEqual(
            self.request(
                "/api/login", "POST", {"username": "socio_a", "password": "wrong"}
            )[0],
            401,
        )
        with d.connect() as c:
            c.execute("UPDATE sessions SET expires=0")
        self.assertEqual(self.request("/api/state")[0], 401)

    def test_login_rate_limit_and_two_users(self):
        with d.connect() as c:
            with self.assertRaises(ValueError):
                security.create_user(c, "third", "password-test-C")
        for _ in range(9):
            self.request(
                "/api/login", "POST", {"username": "unknown", "password": "wrong"}
            )
        self.assertEqual(
            self.request(
                "/api/login",
                "POST",
                {"username": "socio_a", "password": "password-test-A"},
            )[0],
            400,
        )

    def test_shared_crm_notes_tasks(self):
        pid = self.prospect()
        self.post("notes", {"prospect_id": pid, "body": "Solicita información"})
        task = self.post(
            "tasks",
            {
                "prospect_id": pid,
                "title": "Preparar propuesta",
                "due": "2027-01-01",
                "assignee": 2,
            },
        )["id"]
        self.signin("socio_b", "password-test-B")
        self.assertEqual(self.state()["notes"][0]["body"], "Solicita información")
        self.assertEqual(
            self.request("/api/tasks/" + str(task), "PATCH", {"done": 1})[0], 200
        )
        self.assertEqual(
            self.request(
                "/api/prospects/" + str(pid),
                "PATCH",
                {"business": "Nuevo nombre", "contact": "Persona"},
            )[0],
            200,
        )
        self.assertEqual(
            self.request("/api/prospects/" + str(pid), "PATCH", {"stage": "ganado"})[0],
            200,
        )
        s = self.state()
        self.assertEqual(s["metrics"]["clients"], 1)
        self.assertEqual(s["tasks"][0]["done"], 1)
        self.assertEqual(s["prospects"][0]["business"], "Nuevo nombre")
        self.assertTrue(s["audit"])

    def test_finance_exact_money_payments_expenses_and_frozen_share(self):
        self.post("settings", {"price": 250, "cost": 20, "share": 60})
        oid, q = self.order()
        self.assertEqual(self.state()["metrics"]["collected"], 0)
        self.post("settings", {"price": 999, "cost": 99, "share": 50})
        payment = {
            "order_id": oid,
            "amount": "100.01",
            "reference": "Transferencia verificada",
            "request_id": "payment-1",
        }
        first = self.post("payments", payment)
        self.assertEqual(first, self.post("payments", payment))
        self.post("expenses", {"order_id": oid, "amount": 10, "description": "Envío"})
        o = self.state()["orders"][0]
        self.assertEqual(o["balance"], 40000)
        self.assertEqual(o["profit"], 45001)
        self.assertEqual(o["share"], 60)
        self.assertEqual(o["share_a"] + o["share_b"], 45001)
        self.assertEqual(o["payment_status"], "parcial")
        self.post("payments", {**payment, "amount": 400, "request_id": "payment-2"})
        self.assertEqual(self.state()["orders"][0]["payment_status"], "pagado")
        self.assertEqual(
            self.request(
                "/api/payments",
                "POST",
                {**payment, "amount": 1, "request_id": "payment-3"},
            )[0],
            400,
        )
        self.assertEqual(self.request("/api/orders", "POST", {"quote_id": q})[0], 400)
        self.assertEqual(
            self.request("/api/quotes/" + str(q), "PATCH", {"status": "rechazada"})[0],
            400,
        )

    def test_rejects_invalid_money_and_foreign_keys(self):
        pid = self.prospect()
        for amount in ("NaN", "Infinity", "-1", "bad"):
            self.assertEqual(
                self.request(
                    "/api/quotes",
                    "POST",
                    {
                        "prospect_id": pid,
                        "quantity": 1,
                        "total": amount,
                        "unit_cost": 1,
                    },
                )[0],
                400,
            )
        self.assertEqual(
            self.request(
                "/api/tasks",
                "POST",
                {"prospect_id": 999, "title": "x", "due": "2027-01-01", "assignee": 1},
            )[0],
            400,
        )
        self.assertEqual(
            self.request(
                "/api/tasks",
                "POST",
                {"prospect_id": pid, "title": "x", "due": "2027-02-30", "assignee": 1},
            )[0],
            400,
        )
        self.assertEqual(
            self.request(
                "/api/quotes",
                "POST",
                {"prospect_id": pid, "quantity": 1.5, "total": 1, "unit_cost": 1},
            )[0],
            400,
        )
        self.assertEqual(
            self.request("/api/prospects", "POST", {"business": ""})[0], 400
        )

    def test_agents_and_fallback_are_recorded(self):
        pid = self.prospect()
        for agent in ("coordinador", "prospeccion", "finanzas"):
            result = self.post("agents/run", {"agent": agent, "prospect_id": pid})
            self.assertEqual(result["mode"], "reglas")
        with patch.object(d, "draft_with_ollama", side_effect=OSError()):
            result = self.post("agents/run", {"agent": "ventas", "prospect_id": pid})
        self.assertEqual(result["mode"], "plantilla")
        self.assertEqual(len(self.state()["runs"]), 4)
        self.assertEqual(
            self.request(
                "/api/agents/run", "POST", {"agent": "ventas", "prospect_id": 999}
            )[0],
            400,
        )

    def test_migration_repeatable_and_static_headers(self):
        pid = self.prospect()
        d.init_db()
        d.init_db()
        self.assertEqual(self.state()["prospects"][0]["id"], pid)
        code, html = self.request("/")
        self.assertEqual(code, 200)
        self.assertIn(b"NFC AI Office 1.0", html)
        self.assertIn(
            "frame-ancestors 'none'", self.last_headers["Content-Security-Policy"]
        )
        self.assertEqual(self.request("/api/unknown")[0], 404)

    def test_concurrent_payments_cannot_overpay(self):
        from concurrent.futures import ThreadPoolExecutor

        oid, _ = self.order()

        def pay(key):
            return self.request(
                "/api/payments",
                "POST",
                {
                    "order_id": oid,
                    "amount": 400,
                    "reference": "race test",
                    "request_id": key,
                },
            )[0]

        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(pay, ["race-1", "race-2"]))
        self.assertEqual(sorted(results), [201, 400])
        self.assertEqual(self.state()["orders"][0]["paid"], 40000)

    def test_upgrade_from_legacy_preserves_records(self):
        active = d.DB
        try:
            d.DB = Path(self.tmp.name) / "legacy.db"
            d.init_legacy()
            with d.connect() as c:
                c.execute("INSERT INTO prospects(business) VALUES ('Legacy')")
                c.execute(
                    "INSERT INTO quotes(prospect_id,quantity,total,unit_cost,status) VALUES (1,2,500.01,20,'aceptada')"
                )
            d.init_db()
            data = d.snapshot()
            self.assertEqual(data["prospects"][0]["business"], "Legacy")
            self.assertEqual(data["quotes"][0]["total"], 500.01)
            self.assertEqual(data["metrics"]["sales"], 0)
            with d.connect() as c:
                d.mutate(c, "POST", "/api/orders", {"quote_id": 1}, None)
            self.assertEqual(d.snapshot()["orders"][0]["total"], 50001)
        finally:
            d.DB = active

    def test_unaccepted_quote_cannot_be_ordered(self):
        pid = self.prospect()
        q = self.post(
            "quotes", {"prospect_id": pid, "quantity": 1, "total": 1, "unit_cost": 1}
        )["id"]
        self.assertEqual(self.request("/api/orders", "POST", {"quote_id": q})[0], 400)
        self.assertEqual(self.state()["metrics"]["sales"], 0)


if __name__ == "__main__":
    unittest.main()
