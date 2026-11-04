"""Pruebas automáticas del servidor local usando únicamente la librería estándar."""
import json
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path
from http.server import ThreadingHTTPServer
from unittest.mock import patch

import server


class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        server.DB = Path(cls.tmp.name) / "test.db"
        server.init_db()
        cls.http = ThreadingHTTPServer(("127.0.0.1", 0), server.App)
        cls.thread = threading.Thread(target=cls.http.serve_forever, daemon=True)
        cls.thread.start()
        cls.root = "http://127.0.0.1:" + str(cls.http.server_port)

    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown()
        cls.http.server_close()
        cls.thread.join(timeout=5)
        cls.tmp.cleanup()

    def setUp(self):
        with server.connect() as c:
            c.execute("DELETE FROM agent_runs")
            c.execute("DELETE FROM quotes")
            c.execute("DELETE FROM prospects")

    def request(self, path, method="GET", payload=None):
        body = json.dumps(payload).encode() if payload is not None else None
        headers = {"Content-Type": "application/json"} if payload is not None else {}
        req = urllib.request.Request(
            self.root + path, data=body, headers=headers, method=method
        )
        try:
            with urllib.request.urlopen(req, timeout=5) as response:
                return response.status, json.load(response)
        except urllib.error.HTTPError as err:
            return err.code, json.load(err)

    def create_prospect(self):
        status, body = self.request("/api/prospects", "POST", {
            "business": "Café Ejemplo", "sector": "Cafetería",
            "contact": "Administración", "phone": "000"
        })
        self.assertEqual(status, 201)
        return body["id"]

    def test_health_and_empty_state(self):
        status, health = self.request("/api/health")
        self.assertEqual(status, 200)
        self.assertTrue(health["ok"])
        status, state = self.request("/api/state")
        self.assertEqual(status, 200)
        self.assertEqual(state["metrics"]["prospects"], 0)
        self.assertEqual(state["metrics"]["profit"], 0)

    def test_create_and_update_prospect(self):
        prospect_id = self.create_prospect()
        status, state = self.request("/api/state")
        self.assertEqual(state["prospects"][0]["business"], "Café Ejemplo")
        self.assertGreater(state["prospects"][0]["priority"], 20)
        status, result = self.request(
            "/api/prospects/" + str(prospect_id),
            "PATCH", {"stage": "contactado"}
        )
        self.assertEqual(status, 200)
        self.assertTrue(result["ok"])
        status, state = self.request("/api/state")
        self.assertEqual(state["prospects"][0]["stage"], "contactado")
        status, _ = self.request(
            "/api/prospects/" + str(prospect_id),
            "PATCH", {"stage": "no-valida"}
        )
        self.assertEqual(status, 400)

    def test_quote_accepted_financials(self):
        prospect_id = self.create_prospect()
        status, quote = self.request("/api/quotes", "POST", {
            "prospect_id": prospect_id, "quantity": 2,
            "total": 500, "unit_cost": 20
        })
        self.assertEqual(status, 201)
        status, state = self.request("/api/state")
        self.assertEqual(state["metrics"]["pending"], 1)
        self.assertEqual(state["metrics"]["revenue"], 0)
        status, _ = self.request(
            "/api/quotes/" + str(quote["id"]),
            "PATCH", {"status": "aceptada"}
        )
        self.assertEqual(status, 200)
        status, state = self.request("/api/state")
        self.assertEqual(state["metrics"]["revenue"], 500)
        self.assertEqual(state["metrics"]["profit"], 460)
        self.assertEqual(state["metrics"]["partner_share"], 230)

    def test_agents_store_results_and_fallback(self):
        prospect_id = self.create_prospect()
        for agent, prospect in (
            ("coordinador", None), ("prospeccion", prospect_id)
        ):
            status, result = self.request("/api/agents/run", "POST", {
                "agent": agent, "prospect_id": prospect
            })
            self.assertEqual(status, 200)
            self.assertEqual(result["mode"], "reglas")
            self.assertTrue(result["result"])
        with patch.object(server, "draft_with_ollama", side_effect=OSError("offline")):
            status, result = self.request("/api/agents/run", "POST", {
                "agent": "ventas", "prospect_id": prospect_id
            })
        self.assertEqual(status, 200)
        self.assertEqual(result["mode"], "plantilla")
        self.assertIn("tarjetas NFC", result["result"])
        status, state = self.request("/api/state")
        self.assertEqual(len(state["runs"]), 3)

    def test_invalid_inputs(self):
        status, _ = self.request("/api/prospects", "POST", {"business": ""})
        self.assertEqual(status, 400)
        status, _ = self.request("/api/quotes", "POST", {
            "prospect_id": 123456, "quantity": 1,
            "total": 400, "unit_cost": 30
        })
        self.assertEqual(status, 400)
        status, _ = self.request("/api/agents/run", "POST", {
            "agent": "ventas", "prospect_id": 99999
        })
        self.assertEqual(status, 400)
        status, _ = self.request("/api/nada")
        self.assertEqual(status, 404)


if __name__ == "__main__":
    unittest.main()
