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
