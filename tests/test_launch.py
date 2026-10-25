"""Pruebas v0.3: privacidad, auditoría, continuidad y preparación de producción."""
import json
import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.main import Settings, create_app
from backend.security import hash_password
from scripts.backup_sqlite import create_backup, verify_backup


def configured(tmp_path, demo=True, environment='development', approved=False, whatsapp='51987654321'):
    return Settings(
        db_path=str(tmp_path/'apex.db'),
        admin_hash=hash_password('contraseña_segura_de_prueba_2026', salt=b'abcdefghijklmnop'),
        session_secret='test_only_pseudorandom_session_secret_at_least_32_characters',
        whatsapp_number=whatsapp,
        demo_mode=demo,
        environment=environment,
        privacy_approved=approved,
        quote_intake_enabled=True,
        privacy_policy_url='https://privacy.apex.pe/apex-policy' if approved else '',
        privacy_notice_version='2026-10-approved-v1' if approved else '2026-10-draft-1',
    )


def admin(client):
    token = client.post('/api/admin/login', json={'password':'contraseña_segura_de_prueba_2026'}).json()['access_token']
    return {'Authorization': 'Bearer '+token}


def payload(**kwargs):
    return {'customer_name':'Cliente Prueba','phone':'987654321','items':[{'product_id':1,'quantity':1}], 'consent':True, **kwargs}


def test_consent_required_and_recorded(tmp_path):
    with TestClient(create_app(configured(tmp_path))) as client:
        for invalid in ({}, {'consent':False}, {'consent':'not-true'}):
            q=payload()
            q.update(invalid)
            if 'consent' not in invalid:
                q.pop('consent')
            assert client.post('/api/quotes', json=q).status_code == 422
        response=client.post('/api/quotes', json=payload())
        assert response.status_code == 201
        data=client.get('/api/admin/quotes',headers=admin(client)).json()[0]
        assert data['privacy_notice_version']=='2026-10-draft-1'
        assert data['consent_at'] is not None
        assert client.get('/privacidad').status_code==200
        assert 'noindex' in client.get('/privacidad').text


def test_production_gate_blocks_customer_data_when_unready(tmp_path):
    settings=configured(tmp_path, demo=True, environment='production', approved=False)
    with TestClient(create_app(settings)) as client:
        assert client.get('/api/ready').status_code == 503
        assert client.get('/api/products').json() == []
        assert client.post('/api/quotes', json=payload()).status_code == 503
        with sqlite3.connect(settings.db_path) as db:
            assert db.execute('SELECT COUNT(*) FROM quotes').fetchone()[0]==0


def test_production_gate_allows_real_catalog_only_with_approvals(tmp_path):
    settings=configured(tmp_path, demo=False, environment='production', approved=True)
    with TestClient(create_app(settings)) as client:
        assert client.get('/api/ready').status_code == 503
        assert client.post('/api/quotes',json=payload()).status_code == 503
        headers=admin(client)
        r=client.post('/api/admin/products',headers=headers,json={
            'sku':'WEB-2026','name':'Desarrollo web personalizado','category':'Servicios','kind':'servicio','active':True})
        assert r.status_code==201
        assert client.get('/api/ready').status_code == 200
        q=payload(items=[{'product_id':r.json()['id'],'quantity':1}])
        assert client.post('/api/quotes',json=q).status_code == 201


def test_audit_authenticated_and_without_personal_data(tmp_path):
    with TestClient(create_app(configured(tmp_path))) as client:
        headers=admin(client)
        assert client.get('/api/admin/audit').status_code==401
        p=client.post('/api/admin/products', headers=headers,json={
            'sku':'API-1','name':'Consulta de software','category':'Software','kind':'servicio'})
        assert p.status_code==201
        q=client.post('/api/quotes',json=payload())
        quote=client.get('/api/admin/quotes',headers=headers).json()[0]
        client.patch(f"/api/admin/quotes/{quote['id']}/status",headers=headers,json={'status':'contactado'})
        records=client.get('/api/admin/audit',headers=headers).json()
        assert len(records)>=2
        assert records[0]['entity']=='quote'
        assert records[0]['details']=={'from':'nuevo','to':'contactado'}
        assert 'Cliente Prueba' not in json.dumps(records)
        assert client.get('/api/admin/audit?limit=201',headers=headers).status_code==422


def test_backup_verification_does_not_change_original(tmp_path):
    settings=configured(tmp_path)
    with TestClient(create_app(settings)) as client:
        assert client.post('/api/quotes',json=payload()).status_code==201
    database=Path(settings.db_path)
    before=database.stat().st_size
    dest,report=create_backup(database,tmp_path/'backups')
    assert report['valid'] is True and report['counts']['quotes']==1
    assert verify_backup(dest)['integrity']=='ok'
    assert dest.stat().st_mode & 0o077 == 0
    assert database.stat().st_size==before
    data=dest.read_bytes()
    corrupt=tmp_path/'corrupt.sqlite3';corrupt.write_bytes(data[:200])
    with pytest.raises((sqlite3.DatabaseError,ValueError)):
        verify_backup(corrupt)


def test_schema_migration_preserves_old_quotes(tmp_path):
    old=tmp_path/'old.db'
    from backend.database import SCHEMA, initialize, connect
    with connect(str(old)) as db:
        db.executescript(SCHEMA)
        db.execute("INSERT INTO quotes (code,customer_name,phone,items_json) VALUES ('COT-20260101-ABCDEF','Previo','987654321','[]')")
        db.commit()
    initialize(str(old),seed_demo=False)
    initialize(str(old),seed_demo=False)
    with connect(str(old)) as db:
        row=db.execute("SELECT consent_at,privacy_notice_version,customer_name FROM quotes").fetchone()
        assert row['customer_name']=='Previo' and row['consent_at'] is None


def test_no_intake_by_default_even_with_demo(tmp_path):
    settings=configured(tmp_path)
    settings.quote_intake_enabled=False
    with TestClient(create_app(settings)) as client:
        assert client.post('/api/quotes',json=payload()).status_code==503
        assert client.get('/api/ready').json()['checks']['quote_intake_enabled'] is False


def test_production_privacy_url_is_official(tmp_path):
    settings=configured(tmp_path, demo=False, environment='production', approved=True)
    with TestClient(create_app(settings)) as client:
        response=client.get('/privacidad', follow_redirects=False)
        assert response.status_code==302
        assert response.headers['location']=='https://privacy.apex.pe/apex-policy'
