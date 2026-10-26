"""Regression tests for single-line business fields and post-trim catalog bounds.

All records are synthetic; the API uses a temporary SQLite database.
Notes remain multiline by design, unlike customer names and catalog labels.
"""

import pytest
from fastapi.testclient import TestClient

from backend.database import connect
from backend.main import Settings, create_app
from backend.security import hash_password


@pytest.fixture
def client(tmp_path):
    settings = Settings(
        db_path=str(tmp_path / "single-line.sqlite3"),
        admin_hash=hash_password("SyntheticAdminPassword2026!", salt=b"0123456789abcdef"),
        session_secret="synthetic-session-secret-at-least-32-characters",
        demo_mode=True,
        quote_intake_enabled=True,
    )
    with TestClient(create_app(settings)) as api:
        yield api, settings.db_path


def admin_headers(api):
    response = api.post("/api/admin/login", json={"password": "SyntheticAdminPassword2026!"})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.mark.parametrize("name", [
    "Ana\nTorres",
    "Ana\tTorres",
    "Ana\x00Torres",
    "Ana\u0085Torres",
])
def test_quote_rejects_control_characters_without_writing(client, name):
    api, db_path = client
    response = api.post("/api/quotes", json={
        "customer_name": name, "phone": "987654321", "consent": True,
        "items": [{"product_id": 1, "quantity": 1}],
    })
    assert response.status_code == 422
    with connect(db_path) as db:
        assert db.execute("SELECT count(*) FROM quotes").fetchone()[0] == 0


@pytest.mark.parametrize("name,category", [
    ("  AB  ", "Servicios"),
    ("Servicio\nFalso", "Servicios"),
    ("Servicio válido", "Soporte\tTécnico"),
    ("Servicio válido", "A\x00B"),
])
def test_admin_product_rejects_invalid_labels_without_audit(client, name, category):
    api, db_path = client
    response = api.post("/api/admin/products", headers=admin_headers(api), json={
        "sku": "SYNTH-001", "name": name, "category": category,
        "kind": "servicio", "price_cents": 15000,
    })
    assert response.status_code == 422
    with connect(db_path) as db:
        assert db.execute("SELECT count(*) FROM products WHERE sku='SYNTH-001'").fetchone()[0] == 0
        assert db.execute("SELECT count(*) FROM admin_audit").fetchone()[0] == 0


@pytest.mark.parametrize("title,customer_name", [
    ("Instalación\nurgente", "Ana Torres"),
    ("Instalación de red", "Ana\u0085Torres"),
])
def test_admin_jobs_reject_control_characters_without_audit(client, title, customer_name):
    api, db_path = client
    response = api.post("/api/admin/jobs", headers=admin_headers(api), json={
        "title": title, "customer_name": customer_name,
    })
    assert response.status_code == 422
    with connect(db_path) as db:
        assert db.execute("SELECT count(*) FROM service_jobs").fetchone()[0] == 0
        assert db.execute("SELECT count(*) FROM admin_audit").fetchone()[0] == 0


def test_valid_unicode_names_and_multiline_notes_still_work(client):
    api, _ = client
    headers = admin_headers(api)
    product = api.post("/api/admin/products", headers=headers, json={
        "sku": "SYNTH-002", "name": "  Reparación de equipos  ",
        "category": "  Soporte técnico  ", "kind": "servicio",
    })
    assert product.status_code == 201
    assert product.json()["name"] == "Reparación de equipos"
    assert product.json()["category"] == "Soporte técnico"

    quote = api.post("/api/quotes", json={
        "customer_name": "  María José  ", "phone": "987654321",
        "notes": "Primera línea\nSegunda línea", "consent": True,
        "items": [{"product_id": product.json()["id"], "quantity": 1}],
    })
    assert quote.status_code == 201
    stored = api.get("/api/admin/quotes", headers=headers).json()[0]
    assert stored["customer_name"] == "María José"
    assert stored["notes"] == "Primera línea\nSegunda línea"

    job = api.post("/api/admin/jobs", headers=headers, json={
        "title": "  Instalación de cámaras  ",
        "customer_name": "  María José  ",
    })
    assert job.status_code == 201
    assert job.json()["title"] == "Instalación de cámaras"
    assert job.json()["customer_name"] == "María José"
