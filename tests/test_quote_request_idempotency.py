"""Keyed quote submissions are exactly-once within the SQLite database.

Uses synthetic customer details, no external services, and a temporary DB.
Legacy clients without request_id remain backward compatible.
"""
from concurrent.futures import ThreadPoolExecutor
import sqlite3

from fastapi.testclient import TestClient

from backend.database import connect
from backend.main import Settings, create_app


def test_idempotent_quote_retry_returns_original_snapshot(tmp_path):
    path = str(tmp_path / 'quotes.sqlite3')
    with TestClient(create_app(Settings(
        db_path=path, demo_mode=True, quote_intake_enabled=True,
        whatsapp_number='51987654321',
    ))) as client:
        payload = {
            'request_id': '0123456789abcdef0123456789abcdef',
            'customer_name': 'Cliente de prueba',
            'phone': '987654321',
            'consent': True,
            'items': [{'product_id': 1, 'quantity': 2}],
        }
        first = client.post('/api/quotes', json=payload)
        assert first.status_code == 201, first.text
        with connect(path) as db:
            db.execute("UPDATE products SET name='Nombre modificado', price_cents=12500 WHERE id=1")
            db.commit()

        second = client.post('/api/quotes', json=payload)
        assert second.status_code == 201, second.text
        assert second.json() == first.json()
        assert 'Nombre modificado' not in second.json()['message']
        with connect(path) as db:
            assert db.execute('SELECT count(*) FROM quotes').fetchone()[0] == 1
            assert db.execute('SELECT request_id FROM quotes').fetchone()[0] == payload['request_id']

        changed = client.post('/api/quotes', json={**payload, 'notes': 'Una solicitud distinta'})
        assert changed.status_code == 409
        assert 'reutilizado' in changed.json()['detail']
        with connect(path) as db:
            assert db.execute('SELECT count(*) FROM quotes').fetchone()[0] == 1


def test_concurrent_keyed_requests_do_not_duplicate_records(tmp_path):
    path = str(tmp_path / 'concurrent.sqlite3')
    with TestClient(create_app(Settings(
        db_path=path, demo_mode=True, quote_intake_enabled=True,
    ))) as client:
        payload = {
            'request_id': 'abcdef0123456789abcdef0123456789',
            'customer_name': 'Cliente simultáneo',
            'phone': '999888777',
            'consent': True,
            'items': [{'product_id': 2, 'quantity': 1}],
        }
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: client.post('/api/quotes', json=payload), range(2)))
        assert [r.status_code for r in results] == [201, 201]
        assert results[0].json()['code'] == results[1].json()['code']
        with connect(path) as db:
            assert db.execute('SELECT count(*) FROM quotes').fetchone()[0] == 1


def test_legacy_requests_and_invalid_keys(tmp_path):
    path = str(tmp_path / 'legacy.sqlite3')
    with TestClient(create_app(Settings(
        db_path=path, demo_mode=True, quote_intake_enabled=True,
    ))) as client:
        payload = {
            'customer_name': 'Cliente legado',
            'phone': '987654321',
            'consent': True,
            'items': [{'product_id': 1, 'quantity': 1}],
        }
        assert client.post('/api/quotes', json={**payload, 'request_id': 'not-a-key'}).status_code == 422
        a = client.post('/api/quotes', json=payload)
        b = client.post('/api/quotes', json=payload)
        assert a.status_code == b.status_code == 201
        assert a.json()['code'] != b.json()['code']
        with connect(path) as db:
            assert db.execute('SELECT count(*) FROM quotes').fetchone()[0] == 2
            assert db.execute('SELECT count(request_id) FROM quotes').fetchone()[0] == 0


def test_existing_quote_table_is_migrated_without_dropping_rows(tmp_path):
    path = str(tmp_path / 'existing.sqlite3')
    with sqlite3.connect(path) as db:
        db.execute("""CREATE TABLE quotes (
            id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE,
            status TEXT NOT NULL DEFAULT 'nuevo',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            consent_at TEXT, privacy_notice_version TEXT
        )""")
        db.execute("INSERT INTO quotes(code) VALUES ('COT-20261026-ABCDEF')")
    with TestClient(create_app(Settings(
        db_path=path, demo_mode=False, quote_intake_enabled=False,
    ))) as client:
        assert client.get('/api/health').status_code == 200
    with connect(path) as db:
        columns = {row['name'] for row in db.execute('PRAGMA table_info(quotes)')}
        assert {'request_id', 'request_fingerprint'} <= columns
        assert db.execute('SELECT code FROM quotes').fetchone()[0] == 'COT-20261026-ABCDEF'
