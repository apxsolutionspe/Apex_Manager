"""Regression tests for APEX quote consent, production readiness and audit privacy.

All requests use synthetic identities and a temporary SQLite database.
No external services, payments or production settings are touched.
"""

import json

import pytest
from fastapi.testclient import TestClient

from backend.database import connect
from backend.main import Settings, create_app
from backend.security import hash_password


SECRET = "local-privacy-test-secret-1234567890-long"
PASSWORD = "ContraseñaDePrueba!2026"


def quote_payload():
    return {
        "customer_name": "Cliente Sintetico",
        "phone": "987654321",
        "notes": "Solicitud de prueba confidencial",
        "items": [{"product_id": 1, "quantity": 1}],
        "consent": True,
    }


def test_quote_requires_explicit_consent_and_persists_notice_version(tmp_path):
    path = str(tmp_path / "consent.sqlite3")
    settings = Settings(
        db_path=path,
        demo_mode=True,
        quote_intake_enabled=True,
        privacy_notice_version="2026-10-synthetic-v2",
    )
    with TestClient(create_app(settings)) as client:
        payload = quote_payload()
        for invalid in ({k: v for k, v in payload.items() if k != "consent"},
                        {**payload, "consent": False},
                        {**payload, "consent": None}):
            assert client.post("/api/quotes", json=invalid).status_code == 422

        with connect(path) as db:
            assert db.execute("SELECT count(*) FROM quotes").fetchone()[0] == 0

        response = client.post("/api/quotes", json=payload)
        assert response.status_code == 201
        with connect(path) as db:
            record = db.execute(
                "SELECT consent_at, privacy_notice_version FROM quotes WHERE code=?",
                (response.json()["code"],),
            ).fetchone()
        assert record is not None
        assert record["consent_at"]
        assert record["privacy_notice_version"] == "2026-10-synthetic-v2"


def test_production_blocks_quotes_until_all_readiness_checks_pass(tmp_path):
    path = str(tmp_path / "production-synthetic.sqlite3")
    settings = Settings(
        db_path=path,
        admin_hash=hash_password(PASSWORD, salt=b"0123456789abcdef"),
        session_secret=SECRET,
        whatsapp_number="51987654321",
        demo_mode=False,
        environment="production",
        privacy_approved=True,
        privacy_policy_url="https://privacy.apex.pe/privacy-policy-synthetic",
        privacy_notice_version="2026-10-approved-test",
        quote_intake_enabled=True,
    )
    with TestClient(create_app(settings)) as client:
        readiness = client.get("/api/ready")
        assert readiness.status_code == 503
        assert readiness.json()["checks"]["business_catalog"] is False
        assert client.get("/api/config").json()["quote_intake_enabled"] is False
        assert client.post("/api/quotes", json=quote_payload()).status_code == 503

        login = client.post("/api/admin/login", json={"password": PASSWORD})
        assert login.status_code == 200
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
        created = client.post("/api/admin/products", headers=headers, json={
            "sku": "SYNTH-001",
            "name": "Servicio sintetico",
            "category": "Pruebas",
            "kind": "servicio",
            "description": "No es una oferta comercial",
            "price_cents": 10000,
            "active": True,
        })
        assert created.status_code == 201

        readiness = client.get("/api/ready")
        assert readiness.status_code == 200
        assert all(readiness.json()["checks"].values())
        assert client.get("/api/config").json()["quote_intake_enabled"] is True

        payload = {**quote_payload(), "items": [{"product_id": created.json()["id"], "quantity": 1}]}
        assert client.post("/api/quotes", json=payload).status_code == 201

        settings.privacy_approved = False
        assert client.get("/api/ready").status_code == 503
        assert client.get("/api/config").json()["quote_intake_enabled"] is False
        assert client.post("/api/quotes", json=payload).status_code == 503


def test_admin_audit_omits_customer_personal_data(tmp_path):
    path = str(tmp_path / "audit.sqlite3")
    settings = Settings(
        db_path=path,
        admin_hash=hash_password(PASSWORD, salt=b"0123456789abcdef"),
        session_secret=SECRET,
        demo_mode=True,
        quote_intake_enabled=True,
    )
    with TestClient(create_app(settings)) as client:
        login = client.post("/api/admin/login", json={"password": PASSWORD})
        assert login.status_code == 200
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
        quote = client.post("/api/quotes", json=quote_payload())
        assert quote.status_code == 201
        quote_id = client.get("/api/admin/quotes", headers=headers).json()[0]["id"]
        updated = client.patch(
            f"/api/admin/quotes/{quote_id}/status",
            json={"status": "contactado"},
            headers=headers,
        )
        assert updated.status_code == 200

        assert client.get("/api/admin/audit").status_code == 401
        audit = client.get("/api/admin/audit", headers=headers)
        assert audit.status_code == 200
        changes = [row for row in audit.json() if row["entity"] == "quote"]
        assert changes
        assert changes[0]["details"] == {"from": "nuevo", "to": "contactado"}
        encoded = json.dumps(audit.json(), ensure_ascii=False)
        for sensitive in ("Cliente Sintetico", "987654321", "Solicitud de prueba confidencial"):
            assert sensitive not in encoded
