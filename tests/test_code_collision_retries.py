"""Regression coverage for generated quote/service codes colliding in SQLite.

Uses a temporary database, synthetic customers, and deterministic code stubs.
"""
import sqlite3

import pytest
from fastapi.testclient import TestClient

from backend import main as main_module
from backend.database import connect
from backend.main import Settings, create_app, insert_with_code
from backend.security import hash_password


@pytest.fixture()
def client(tmp_path):
    settings = Settings(
        db_path=str(tmp_path / "collisions.sqlite3"),
        admin_hash=hash_password("SyntheticAdminPassword!2026", salt=b"0123456789abcdef"),
        session_secret="synthetic-secret-at-least-thirty-two-chars",
        demo_mode=True,
        quote_intake_enabled=True,
    )
    with TestClient(create_app(settings)) as test_client:
        yield test_client, settings.db_path


def quote_payload():
    return {
        "customer_name": "Cliente Sintetico",
        "phone": "987654321",
        "consent": True,
        "items": [{"product_id": 1, "quantity": 1}],
    }


def stub_codes(monkeypatch, *codes):
    values = iter(codes)
    monkeypatch.setattr(main_module, "new_code", lambda prefix: next(values))


def test_quote_retries_duplicate_generated_code(client, monkeypatch):
    http, path = client
    first = http.post("/api/quotes", json=quote_payload())
    assert first.status_code == 201
    unique = "COT-20261024-ABCDEF"
    stub_codes(monkeypatch, first.json()["code"], unique)

    second = http.post("/api/quotes", json=quote_payload())
    assert second.status_code == 201
    assert second.json()["code"] == unique
    with connect(path) as db:
        assert db.execute("SELECT count(*) FROM quotes").fetchone()[0] == 2


def test_service_job_retries_duplicate_generated_code(client, monkeypatch):
    http, path = client
    login = http.post("/api/admin/login", json={"password": "SyntheticAdminPassword!2026"})
    assert login.status_code == 200
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    payload = {"title": "Servicio sintetico", "customer_name": "Cliente Sintetico"}
    first = http.post("/api/admin/jobs", json=payload, headers=headers)
    assert first.status_code == 201
    unique = "SRV-20261024-ABCDEF"
    stub_codes(monkeypatch, first.json()["code"], unique)

    second = http.post("/api/admin/jobs", json=payload, headers=headers)
    assert second.status_code == 201
    assert second.json()["code"] == unique
    with connect(path) as db:
        assert db.execute("SELECT count(*) FROM service_jobs").fetchone()[0] == 2


def test_exhausted_code_retries_return_503_without_extra_quote(client, monkeypatch):
    http, path = client
    first = http.post("/api/quotes", json=quote_payload())
    assert first.status_code == 201
    monkeypatch.setattr(main_module, "new_code", lambda prefix: first.json()["code"])

    response = http.post("/api/quotes", json=quote_payload())
    assert response.status_code == 503
    with connect(path) as db:
        assert db.execute("SELECT count(*) FROM quotes").fetchone()[0] == 1


def test_unrelated_integrity_errors_are_not_retried(monkeypatch):
    monkeypatch.setattr(main_module, "new_code", lambda prefix: "COT-20261024-ABCDEF")
    with sqlite3.connect(":memory:") as db:
        db.execute("CREATE TABLE quotes (code TEXT NOT NULL UNIQUE, customer_name TEXT NOT NULL)")
        with pytest.raises(sqlite3.IntegrityError, match="NOT NULL"):
            insert_with_code(
                db, "COT", "quotes",
                "INSERT INTO quotes (code, customer_name) VALUES (?, ?)",
                (None,),
            )
