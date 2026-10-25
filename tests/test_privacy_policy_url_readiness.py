"""Production must not accept customer data behind an unusable privacy URL."""

import sqlite3

import pytest
from fastapi.testclient import TestClient

from backend.main import Settings, create_app, valid_privacy_policy_url
from backend.security import hash_password


INVALID_URLS = [
    'https://',
    'https://?notice=1',
    'http://privacy.apex.pe/privacy',
    'https://user:pass@privacy.apex.pe/privacy',
    'https://privacy.apex.pe\n',
    'https://privacy.apex.pe:invalid/privacy',
    'https://privacy.apex.pe\\\\other.example',
    'https://[broken',
    'https://privacy.apex.pe:0/privacy',
    'https://localhost/privacy',
    'https://app.localhost/privacy',
    'https://intranet/privacy',
    'https://192.168.1.1/privacy',
    'https://127.0.0.1/privacy',
    'https://[::1]/privacy',
    'https://10.0.0.5/privacy',
    'https://example.invalid/privacy',
    'https://example..org/privacy',
    'https://-bad.privacy.apex.pe/privacy',
    'https://foo.local/privacy',
    'https://127.1/privacy',
    # RFC 2606 examples are documentation-only, not real privacy notices.
    'https://example.com/privacy',
    'https://example.net/privacy',
    'https://example.org/privacy',
    'https://www.example.org/privacy',
    'https://sub.example.com/privacy',
    'https://example.com./privacy',
]


@pytest.mark.parametrize('url', INVALID_URLS)
def test_invalid_privacy_urls_fail_validation(url):
    assert not valid_privacy_policy_url(url)


@pytest.mark.parametrize('url', [
    'https://privacy.apex.pe/privacy',
    'https://privacy.apex.pe:443/privacy',
    'https://sub.privacy.apex.pe/privacy?version=2',
    'https://8.8.8.8/privacy',
    'https://www.café.pe/politica',
])
def test_valid_privacy_urls_are_accepted(url):
    assert valid_privacy_policy_url(url)


@pytest.mark.parametrize('url', [
    'https://', 'https://user:pass@privacy.apex.pe/privacy',
    'https://privacy.apex.pe:invalid/privacy', 'https://localhost/privacy',
    'https://127.0.0.1/privacy', 'https://example.invalid/privacy',
    'https://example.org/privacy', 'https://sub.example.com/privacy',
])
def test_production_rejects_quote_intake_when_privacy_notice_is_unusable(tmp_path, url):
    settings = Settings(
        db_path=str(tmp_path / 'isolated.sqlite3'),
        admin_hash=hash_password('only-a-synthetic-test-password', salt=b'0123456789abcdef'),
        session_secret='synthetic-test-secret-at-least-thirty-two-characters',
        whatsapp_number='51987654321',
        demo_mode=False,
        environment='production',
        privacy_approved=True,
        privacy_policy_url=url,
        privacy_notice_version='2026-10-approved-v1',
        quote_intake_enabled=True,
    )
    with TestClient(create_app(settings)) as client:
        with sqlite3.connect(settings.db_path) as db:
            db.execute("""INSERT INTO products
                (sku,name,category,kind,active) VALUES
                ('REAL-1','Servicio sintético','Servicios','servicio',1)""")
            db.commit()
        ready = client.get('/api/ready')
        assert ready.status_code == 503
        assert ready.json()['checks']['privacy_notice_approved'] is False
        assert client.get('/api/config').json()['quote_intake_enabled'] is False
        assert client.get('/privacidad', follow_redirects=False).status_code == 200
        response = client.post('/api/quotes', json={
            'customer_name': 'Cliente Sintético', 'phone': '987654321',
            'consent': True, 'items': [{'product_id': 1, 'quantity': 1}],
        })
        assert response.status_code == 503
        with sqlite3.connect(settings.db_path) as db:
            assert db.execute('SELECT COUNT(*) FROM quotes').fetchone()[0] == 0
