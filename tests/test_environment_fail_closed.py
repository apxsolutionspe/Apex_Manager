"""APP_ENV typos must not silently disable production privacy safeguards.

Synthetic inputs only; tests use isolated temporary SQLite databases.
"""
import sqlite3

import pytest
from fastapi.testclient import TestClient

from backend.main import Settings, create_app


@pytest.mark.parametrize('raw', ['Production', ' production ', 'PRODUCTION'])
def test_production_aliases_cannot_bypass_readiness_or_show_demo(tmp_path, raw):
    settings = Settings(
        db_path=str(tmp_path / 'isolated.sqlite3'),
        environment=raw,
        demo_mode=True,
        quote_intake_enabled=True,
    )
    assert settings.environment == 'production'
    with TestClient(create_app(settings)) as client:
        assert client.get('/api/products').json() == []
        assert client.get('/api/config').json()['quote_intake_enabled'] is False
        assert client.get('/api/ready').status_code == 503
        response = client.post('/api/quotes', json={
            'customer_name': 'Cliente Sintetico',
            'phone': '987654321',
            'consent': True,
            'items': [{'product_id': 1, 'quantity': 1}],
        })
        assert response.status_code == 503
    with sqlite3.connect(settings.db_path) as db:
        assert db.execute('SELECT count(*) FROM quotes').fetchone()[0] == 0


@pytest.mark.parametrize('raw', ['prod', 'staging', '', 'production-dev', None])
def test_unknown_environment_rejected_before_app_starts(raw):
    with pytest.raises(ValueError, match='APP_ENV'):
        Settings(environment=raw)


def test_development_variants_and_env_var_are_normalized(monkeypatch):
    assert Settings(environment=' DEVELOPMENT ').environment == 'development'
    monkeypatch.setenv('APP_ENV', ' Production ')
    assert Settings().environment == 'production'


def test_settings_read_runtime_environment_on_each_construction(monkeypatch, tmp_path):
    """Los ajustes nuevos deben captar el entorno actual, no el de importación."""
    db_path = str(tmp_path / 'fresh.sqlite3')
    monkeypatch.setenv('DB_PATH', db_path)
    monkeypatch.setenv('ADMIN_PASSWORD_HASH', 'test-hash-from-environment')
    monkeypatch.setenv('SESSION_SECRET', 'test-session-secret-from-environment')
    monkeypatch.setenv('WHATSAPP_NUMBER', '51911111111')
    monkeypatch.setenv('DEMO_MODE', 'false')
    monkeypatch.setenv('PRIVACY_NOTICE_APPROVED', 'true')
    monkeypatch.setenv('PRIVACY_POLICY_URL', 'https://privacy.apex.pe/politica')
    monkeypatch.setenv('PRIVACY_NOTICE_VERSION', '2026-11-approved-v1')
    monkeypatch.setenv('QUOTE_INTAKE_ENABLED', 'true')

    first = Settings()
    assert first.db_path == db_path
    assert first.admin_hash == 'test-hash-from-environment'
    assert first.session_secret == 'test-session-secret-from-environment'
    assert first.whatsapp_number == '51911111111'
    assert first.demo_mode is False
    assert first.privacy_approved is True
    assert first.privacy_policy_url == 'https://privacy.apex.pe/politica'
    assert first.privacy_notice_version == '2026-11-approved-v1'
    assert first.quote_intake_enabled is True

    monkeypatch.setenv('WHATSAPP_NUMBER', '')
    monkeypatch.setenv('QUOTE_INTAKE_ENABLED', 'false')
    second = Settings()
    assert second.whatsapp_number == ''
    assert second.quote_intake_enabled is False
    assert first.whatsapp_number == '51911111111'
    assert first.quote_intake_enabled is True
