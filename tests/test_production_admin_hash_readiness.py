"""Production readiness must not enable intake with an unusable admin hash.

All data is synthetic, and the database is a temporary local SQLite file.
No external services or production settings are used.
"""

import pytest
from fastapi.testclient import TestClient

from backend.database import connect
from backend.main import Settings, create_app
from backend.security import hash_password, valid_password_hash


PASSWORD = "ContraseñaDePrueba!2026"
SALT = b"0123456789abcdef"
GOOD_HASH = hash_password(PASSWORD, salt=SALT)


@pytest.mark.parametrize("invalid", [
    "", "not-a-hash",
    "pbkdf2_sha256$99999$" + "ab" * 16 + "$" + "cd" * 32,
    "pbkdf2_sha256$500000$" + "ab" * 15 + "$" + "cd" * 32,
    "pbkdf2_sha256$500000$" + "ab" * 16 + "$" + "cd" * 31,
    "pbkdf2_sha256$500000$" + "zz" * 16 + "$" + "cd" * 32,
    "pbkdf2_sha256$999999999999999999999$" + "ab" * 16 + "$" + "cd" * 32,
    "pbkdf2_sha256$500000$" + "ab" * 16 + "$" + "cd" * 32 + "$extra",
    None,
])
def test_invalid_admin_password_hash_metadata(invalid):
    assert not valid_password_hash(invalid)


def test_production_readiness_requires_usable_admin_hash(tmp_path):
    settings = Settings(
        db_path=str(tmp_path / "production.sqlite3"),
        admin_hash="not-a-hash",
        session_secret="local-readiness-secret-at-least-32-characters",
        whatsapp_number="51987654321",
        demo_mode=False,
        environment="production",
        privacy_approved=True,
        privacy_policy_url="https://privacy.apex.pe/synthetic-privacy",
        privacy_notice_version="2026-10-approved-test",
        quote_intake_enabled=True,
    )
    with TestClient(create_app(settings)) as client:
        with connect(settings.db_path) as db:
            db.execute(
                """INSERT INTO products
                   (sku,name,description,category,kind,price_cents)
                   VALUES (?,?,?,?,?,?)""",
                ("SYNTH-001", "Servicio de prueba", "No comercial", "Pruebas",
                 "servicio", 10000),
            )
        payload = {
            "customer_name": "Cliente Sintetico",
            "phone": "987654321",
            "consent": True,
            "items": [{"product_id": 1, "quantity": 1}],
        }

        ready = client.get("/api/ready")
        assert ready.status_code == 503
        assert ready.json()["checks"]["admin_credentials"] is False
        assert ready.json()["checks"]["business_catalog"] is True
        assert client.get("/api/config").json()["quote_intake_enabled"] is False
        assert client.post("/api/admin/login", json={"password": PASSWORD}).status_code == 503
        assert client.post("/api/quotes", json=payload).status_code == 503

        settings.admin_hash = GOOD_HASH
        assert valid_password_hash(settings.admin_hash)
        ready = client.get("/api/ready")
        assert ready.status_code == 200
        assert all(ready.json()["checks"].values())
        assert client.get("/api/config").json()["quote_intake_enabled"] is True
        assert client.post("/api/admin/login", json={"password": PASSWORD}).status_code == 200
        assert client.post("/api/quotes", json=payload).status_code == 201
