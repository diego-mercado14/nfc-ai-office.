"""Optional real Chromium validation; run explicitly with Playwright installed."""

import os
import secrets
import socket
import subprocess
import tempfile
import time
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import domain as d
import security
from playwright.sync_api import sync_playwright


def main():
    with tempfile.TemporaryDirectory() as tmp:
        d.DB = Path(tmp) / "ui.db"
        d.init_db()
        password = secrets.token_urlsafe(24)
        with d.connect() as c:
            security.create_user(c, "partner", password)
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
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
        try:
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(
                    executable_path="/usr/bin/chromium",
                    headless=True,
                    args=["--no-sandbox"],
                )
                page = browser.new_page(viewport={"width": 1440, "height": 1000})
                errors = []
                page.on("pageerror", lambda error: errors.append(str(error)))
                for _ in range(50):
                    try:
                        page.goto(origin)
                        break
                    except Exception:
                        time.sleep(0.1)
                page.get_by_label("Usuario", exact=True).fill("partner")
                page.get_by_label("Contraseña", exact=True).fill(password)
                page.get_by_role("button", name="Iniciar sesión", exact=True).click()
                page.get_by_role(
                    "button", name="Prospectos y clientes", exact=True
                ).click()
                page.get_by_role("button", name="+ Agregar negocio", exact=True).click()
                page.get_by_label("Negocio", exact=True).fill("Negocio de prueba UI")
                page.get_by_label("Contacto", exact=True).fill("Persona de prueba")
                page.get_by_role("button", name="Guardar", exact=True).click()
                page.get_by_role("button", name="Historial", exact=True).click()
                page.get_by_label("Nota", exact=True).fill("Nota de prueba")
                page.get_by_role("button", name="Guardar", exact=True).click()
                page.get_by_text("Nota de prueba", exact=False).wait_for()
                page.get_by_role("button", name="Cerrar", exact=True).click()
                page.get_by_role("button", name="Seguimiento", exact=True).click()
                page.get_by_role("button", name="+ Nueva tarea", exact=True).click()
                page.get_by_label("Tarea", exact=True).fill("Revisar propuesta")
                page.get_by_label("Fecha límite", exact=True).fill("2027-01-01")
                page.get_by_role("button", name="Guardar", exact=True).click()
                page.get_by_role("button", name="Marcar completada", exact=True).click()
                page.get_by_role(
                    "button", name="Completada · reabrir", exact=True
                ).wait_for()
                page.get_by_role("button", name="Cotizaciones", exact=True).click()
                page.get_by_role(
                    "button", name="+ Nueva cotización", exact=True
                ).click()
                page.get_by_label(
                    "Total acordado (ajusta por cantidad)", exact=True
                ).fill("500")
                page.get_by_label("Costo por tarjeta", exact=True).fill("20")
                page.get_by_role("button", name="Guardar", exact=True).click()
                page.get_by_label("Estado", exact=True).select_option("aceptada")
                page.get_by_role("button", name="Crear pedido", exact=True).click()
                page.get_by_role("button", name="Guardar", exact=True).click()
                page.get_by_text("Aceptada · bloqueada", exact=True).wait_for()
                page.get_by_role(
                    "button", name="Pedidos y finanzas", exact=True
                ).click()
                page.get_by_role("button", name="Registrar pago", exact=True).click()
                page.get_by_label("Monto recibido MXN", exact=True).fill("200")
                page.get_by_label("Referencia o comprobante", exact=True).fill(
                    "Prueba UI"
                )
                page.get_by_role("button", name="Guardar", exact=True).click()
                page.get_by_text("Prueba UI", exact=True).wait_for()
                page.get_by_role("button", name="Agregar gasto", exact=True).click()
                page.get_by_label("Monto MXN", exact=True).fill("10")
                page.get_by_label("Concepto", exact=True).fill("Gasto de prueba")
                page.get_by_role("button", name="Guardar", exact=True).click()
                page.get_by_text("Gasto de prueba", exact=True).wait_for()
                screenshots = Path(
                    os.environ.get("NFC_SCREENSHOTS", "/tmp/nfc-office-ui")
                )
                screenshots.mkdir(exist_ok=True, parents=True)
                page.screenshot(path=str(screenshots / "desktop.png"), full_page=True)
                page.set_viewport_size({"width": 390, "height": 844})
                assert page.evaluate(
                    "document.documentElement.scrollWidth <= innerWidth"
                ), "Mobile page overflows"
                page.screenshot(path=str(screenshots / "mobile.png"), full_page=True)
                page.get_by_role("button", name="Centro de agentes", exact=True).click()
                page.get_by_label("Agente", exact=True).select_option("finanzas")
                with page.expect_response("**/api/agents/run") as response:
                    page.get_by_role(
                        "button", name="Generar análisis o borrador", exact=True
                    ).click()
                result = response.value
                assert result.ok, result.text()
                page.get_by_text("finanzas · reglas · #1", exact=True).wait_for()
                page.get_by_role("button", name="Salir", exact=True).click()
                page.get_by_role("button", name="Iniciar sesión", exact=True).wait_for()
                assert not errors, errors
                browser.close()
                print(
                    "Chromium: login, CRM, notes, tasks, quotes, orders, payments, expenses, finance agent, logout; desktop/mobile passed"
                )
        finally:
            process.terminate()
            process.wait(timeout=5)


if __name__ == "__main__":
    main()
