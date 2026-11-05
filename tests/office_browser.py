"""Real HTTP/browser office tests. Delays only gate transport; all successful results are server-generated."""

import os
import sys
import tempfile
import time
import secrets
import subprocess
import socket
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import domain as d
import security
from playwright.sync_api import sync_playwright, expect


def main():
    with tempfile.TemporaryDirectory() as tmp:
        d.DB = Path(tmp) / "office-test.db"
        d.init_db()
        password = secrets.token_urlsafe(24)
        with d.connect() as c:
            security.create_user(c, "socio_prueba", password)
            c.execute(
                "INSERT INTO prospects(business,contact) VALUES ('Negocio de prueba','Contacto de prueba')"
            )
        with socket.socket() as s:
            s.bind(("127.0.0.1", 0))
            port = s.getsockname()[1]
        origin = f"http://127.0.0.1:{port}"
        process = subprocess.Popen(
            [sys.executable, "server.py"],
            cwd=d.ROOT,
            env={
                **os.environ,
                "NFC_DB_PATH": str(d.DB),
                "PORT": str(port),
                "NFC_ORIGIN": origin,
            },
        )
        shots = Path(
            os.environ.get("NFC_SCREENSHOTS", "/workspace/scratch/pixel-office")
        )
        shots.mkdir(parents=True, exist_ok=True)
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(
                    executable_path="/usr/bin/chromium",
                    headless=True,
                    args=["--no-sandbox"],
                )
                page = browser.new_page(
                    viewport={"width": 1560, "height": 1100}, device_scale_factor=1
                )
                page.add_init_script("""
                    window.officePaints = 0;
                    const draw = CanvasRenderingContext2D.prototype.drawImage;
                    CanvasRenderingContext2D.prototype.drawImage = function(...args) {
                        if (this.canvas.classList.contains('office-canvas')) window.officePaints++;
                        return draw.apply(this, args);
                    };
                """)
                errors = []
                posts = []
                page.on("pageerror", lambda error: errors.append(str(error)))
                page.on(
                    "request",
                    lambda r: (
                        posts.append(r) if r.url.endswith("/api/agents/run") else None
                    ),
                )
                for _ in range(40):
                    try:
                        page.goto(origin)
                        break
                    except Exception:
                        time.sleep(0.1)

                def signin():
                    page.get_by_label("Usuario", exact=True).fill("socio_prueba")
                    page.get_by_label("Contraseña", exact=True).fill(password)
                    page.get_by_role(
                        "button", name="Iniciar sesión", exact=True
                    ).click()
                    expect(page.locator(".office-canvas")).to_be_visible()

                signin()
                assert not posts, "Entering office must not run agents"
                before = page.evaluate("window.officePaints")
                page.wait_for_timeout(1100)
                frames = page.evaluate("window.officePaints") - before
                assert 1 <= frames <= 10, f"Unexpected redraw rate: {frames}"
                print(f"Office animation: {frames} redraws in 1.1 seconds")
                expect(page.locator(".agent-hotspot")).to_have_count(4)
                expect(page.locator("[data-status=working]")).to_have_count(0)
                page.screenshot(path=str(shots / "desktop.png"), full_page=True)
                page.get_by_role(
                    "button", name="Finanzas: Disponible", exact=True
                ).click()
                expect(page.locator(".context-profile h2")).to_have_text("Finanzas")
                # Hold the actual request before forwarding to the real server to inspect pending UI.
                held = []
                page.route("**/api/agents/run", lambda route: held.append(route))
                page.get_by_role(
                    "button", name="Consultar finanzas →", exact=True
                ).click()
                expect(
                    page.locator(".agent-hotspot[data-agent=finanzas]")
                ).to_have_attribute("data-status", "working")
                expect(
                    page.get_by_role("button", name="Ejecutando solicitud…", exact=True)
                ).to_be_disabled()
                page.get_by_role(
                    "button", name="Prospectos y clientes", exact=True
                ).click()
                page.get_by_role("button", name="Oficina virtual", exact=True).click()
                expect(
                    page.locator(".agent-hotspot[data-agent=finanzas]")
                ).to_have_attribute("data-status", "working")
                assert len(posts) == 1 and len(held) == 1, "Duplicate request"
                page.screenshot(path=str(shots / "working.png"), full_page=True)
                response = held[0].fetch()
                assert response.ok
                held[0].fulfill(response=response)
                expect(
                    page.locator(".agent-hotspot[data-agent=finanzas]")
                ).to_have_attribute("data-status", "done")
                expect(page.locator(".office-output")).to_contain_text(
                    "Ventas confirmadas"
                )
                expect(page.locator(".result-meta")).to_contain_text("#1")
                page.screenshot(path=str(shots / "result.png"), full_page=True)
                page.unroute("**/api/agents/run")
                # A newer stored run must supersede the cached result from this tab.
                newer = page.evaluate("api('agents/run','POST',{agent:'finanzas'})")
                page.get_by_role("button", name="Actualizar", exact=True).click()
                expect(page.locator(".result-meta")).to_contain_text(
                    "#" + str(newer["id"])
                )

                # Actual coordinator and prospecting requests use the existing backend tools.
                for agent, action in [
                    ("Coordinador", "Consultar prioridades →"),
                    ("Prospección", "Analizar prospecto →"),
                ]:
                    page.get_by_role(
                        "button", name=agent + ": Disponible", exact=True
                    ).click()
                    if agent == "Prospección":
                        page.get_by_label("Negocio a trabajar").select_option("1")
                    page.get_by_role("button", name=action, exact=True).click()
                    expect(page.locator(".context-status")).to_have_text(
                        "Resultado listo"
                    )
                # Sales also uses the real backend (local model or explicit template fallback).
                page.get_by_role(
                    "button", name="Ventas: Disponible", exact=True
                ).click()
                page.get_by_label("Negocio a trabajar").select_option("1")
                page.get_by_role(
                    "button", name="Preparar borrador →", exact=True
                ).click()
                expect(page.locator(".context-status")).to_have_text(
                    "Resultado listo", timeout=75000
                )
                expect(page.locator(".office-output")).not_to_be_empty()
                # Network uncertainty must never render a success or invented output.
                page.get_by_role(
                    "button", name="Ventas: Resultado listo", exact=True
                ).click()
                page.get_by_label("Negocio a trabajar").select_option("1")
                page.route("**/api/agents/run", lambda route: route.abort())
                page.get_by_role(
                    "button", name="Preparar borrador →", exact=True
                ).click()
                expect(page.locator(".office-error")).to_contain_text(
                    "No se pudo confirmar"
                )
                expect(
                    page.locator(".agent-hotspot[data-agent=ventas]")
                ).to_have_attribute("data-status", "error")
                page.unroute("**/api/agents/run")
                # Object shortcuts and keyboard work without canvas hit-testing.
                page.get_by_role(
                    "button", name="Abrir tareas en el tablero", exact=True
                ).focus()
                page.keyboard.press("Enter")
                expect(
                    page.get_by_role("heading", name="Seguimiento", exact=True)
                ).to_be_visible()
                page.get_by_role("button", name="Oficina virtual", exact=True).click()
                page.get_by_role(
                    "button", name="Abrir CRM en el librero", exact=True
                ).click()
                expect(
                    page.get_by_role(
                        "heading", name="Prospectos y clientes", exact=True
                    )
                ).to_be_visible()
                page.get_by_role("button", name="Oficina virtual", exact=True).click()
                page.get_by_role(
                    "button", name="Coordinador: Resultado listo", exact=True
                ).click()
                page.set_viewport_size({"width": 390, "height": 844})
                assert page.evaluate(
                    "document.documentElement.scrollWidth <= innerWidth"
                ), "Mobile overflow"
                page.get_by_role(
                    "button", name="Finanzas: Resultado listo", exact=True
                ).click()
                expect(page.locator(".context-profile h2")).to_have_text("Finanzas")
                page.screenshot(path=str(shots / "mobile.png"), full_page=True)
                page.set_viewport_size({"width": 320, "height": 740})
                assert page.evaluate(
                    "document.documentElement.scrollWidth <= innerWidth"
                ), "Small mobile overflow"
                page.set_viewport_size({"width": 1024, "height": 768})
                assert page.evaluate(
                    "document.documentElement.scrollWidth <= innerWidth"
                ), "Tablet overflow"
                # Pause and reduced motion must produce identical canvas frames.
                page.get_by_role("button", name="Pausar animación", exact=True).click()
                before = page.locator(".office-canvas").evaluate("(c)=>c.toDataURL()")
                page.wait_for_timeout(350)
                assert before == page.locator(".office-canvas").evaluate(
                    "(c)=>c.toDataURL()"
                )
                page.emulate_media(reduced_motion="reduce")
                page.get_by_role(
                    "button", name="Reanudar animación", exact=True
                ).click()
                before = page.locator(".office-canvas").evaluate("(c)=>c.toDataURL()")
                page.wait_for_timeout(350)
                assert before == page.locator(".office-canvas").evaluate(
                    "(c)=>c.toDataURL()"
                )
                # Expired sessions close the office and discard in-memory agent state.
                with d.connect() as c:
                    c.execute("DELETE FROM sessions")
                page.get_by_role(
                    "button", name="Consultar finanzas →", exact=True
                ).click()
                expect(
                    page.get_by_role("button", name="Iniciar sesión", exact=True)
                ).to_be_visible()
                signin()
                expect(page.locator("[data-status=working]")).to_have_count(0)
                expect(page.locator(".context-status")).to_have_text("Disponible")
                page.get_by_role("button", name="Visión general", exact=True).click()
                before = page.evaluate("window.officePaints")
                page.wait_for_timeout(350)
                assert before == page.evaluate("window.officePaints"), (
                    "Animation leaked after navigation"
                )
                page.evaluate(
                    "CanvasRenderingContext2D; HTMLCanvasElement.prototype.getContext = () => null"
                )
                page.get_by_role("button", name="Oficina virtual", exact=True).click()
                page.get_by_role(
                    "button", name="Abrir vista administrativa", exact=True
                ).click()
                expect(
                    page.get_by_role("heading", name="Visión general", exact=True)
                ).to_be_visible()
                assert not errors, errors
                browser.close()
                print(
                    "Office browser PASS: entry without requests, 4 agents, real tools, in-flight state, no duplicates, result, network failure, navigation, keyboard, mobile, pause, reduced motion and expired session."
                )
        finally:
            process.terminate()
            process.wait(timeout=5)


if __name__ == "__main__":
    main()
