"""Pruebas reproducibles de permisos, flujo comercial, privacidad y respaldos."""
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.database import connect, initialize
from backend.main import Settings, create_app
from backend.security import hash_password, issue_token
from scripts.backup_sqlite import backup_database

ADMIN_PASSWORD = 'AdministradorSeguro!2026'
SECRET = 'test-secret-for-apex-team-with-adequate-entropy-12345'


@pytest.fixture
def env(tmp_path):
    db = tmp_path / 'team.sqlite'
    app = create_app(Settings(db_path=str(db), admin_hash=hash_password(ADMIN_PASSWORD),
                              session_secret=SECRET, whatsapp_number='', demo_mode=True))
    with TestClient(app) as client:
        token = client.post('/api/admin/login', json={'password': ADMIN_PASSWORD}).json()['access_token']
        yield client, {'Authorization': 'Bearer ' + token}, db


def add_member(client, admin, username, role):
    data = {'name': f'Operador {username}', 'username': username, 'role': role,
            'password': f'password-{username}-secure-2026'}
    result = client.post('/api/admin/team', json=data, headers=admin)
    assert result.status_code == 201, result.text
    user = client.post('/api/team/login', json={'username': username, 'password': data['password']})
    assert user.status_code == 200
    return result.json(), {'Authorization': 'Bearer ' + user.json()['access_token']}


def test_team_creation_roles_and_api_isolation(env):
    client, admin, _ = env
    assert client.get('/api/admin/team').status_code == 401
    tech, tech_token = add_member(client, admin, 'tecnico-1', 'tecnico')
    seller, sale_token = add_member(client, admin, 'vendedor-1', 'ventas')
    assert client.get('/api/admin/summary', headers=sale_token).status_code == 401
    assert client.get('/api/admin/products', headers=tech_token).status_code == 401
    assert client.get('/api/team/work', headers=admin).status_code == 401
    assert client.get('/api/team/me', headers=tech_token).json()['role'] == 'tecnico'
    assert client.get('/api/team/work', headers=tech_token).json() == {'type': 'jobs', 'records': []}
    assert client.get('/api/team/work', headers=sale_token).json()['type'] == 'quotes'
    assert 'password_hash' not in str(client.get('/api/admin/team', headers=admin).json())
    assert client.post('/api/admin/team', json={'name':'Dup','username':tech['username'],
        'role':'tecnico','password':'a-long-password-2026'}, headers=admin).status_code == 409
    assert client.patch(f"/api/admin/team/{seller['id']}", json={'active':False}, headers=sale_token).status_code == 401
    assert client.get('/api/admin/audit', headers=tech_token).status_code == 401


def test_approved_service_automatically_creates_one_job_and_restricts_access(env):
    client, admin, db = env
    tech, tech_token = add_member(client, admin, 't1test', 'tecnico')
    other, other_token = add_member(client, admin, 't2test', 'tecnico')
    sale, sale_token = add_member(client, admin, 'v1test', 'ventas')
    quote = client.post('/api/quotes', json={'customer_name':'Prueba flujo', 'phone':'987654321',
        'items':[{'product_id':1,'quantity':1}]}).json()
    quote_id = client.get('/api/admin/quotes', headers=admin).json()[0]['id']
    assert client.patch(f'/api/team/quotes/{quote_id}/status', json={'status':'aprobado'}, headers=tech_token).status_code == 403
    approved=client.patch(f'/api/team/quotes/{quote_id}/status', json={'status':'aprobado'},headers=sale_token)
    assert approved.status_code == 200 and approved.json()['service_order_created'] is True
    assert client.patch(f'/api/team/quotes/{quote_id}/status', json={'status':'aprobado'},headers=sale_token).json()['service_order_created'] is False
    jobs=client.get('/api/admin/jobs',headers=admin).json()
    assert len(jobs)==1 and jobs[0]['quote_id']==quote_id and jobs[0]['assigned_to'] is None
    job_id=jobs[0]['id']
    assert client.patch(f'/api/admin/jobs/{job_id}',json={'status':'pendiente','assigned_to':sale['id']},headers=admin).status_code==422
    assigned=client.patch(f'/api/admin/jobs/{job_id}',json={'status':'pendiente','assigned_to':tech['id']},headers=admin)
    assert assigned.status_code==200 and assigned.json()['assigned_to']==tech['id']
    assert len(client.get('/api/team/work',headers=tech_token).json()['records'])==1
    assert client.get('/api/team/work',headers=other_token).json()['records']==[]
    assert client.patch(f'/api/team/jobs/{job_id}',json={'status':'en_proceso'},headers=other_token).status_code==404
    assert client.patch(f'/api/team/jobs/{job_id}',json={'status':'en_proceso','assigned_to':other['id']},headers=tech_token).status_code==403
    assert client.patch(f'/api/team/jobs/{job_id}',json={'status':'finalizado'},headers=sale_token).status_code==403
    assert client.patch(f'/api/team/jobs/{job_id}',json={'status':'finalizado'},headers=tech_token).status_code==200
    audit=client.get('/api/admin/audit',headers=admin).json()
    assert any(e['actor']==f"team:{tech['id']}" for e in audit)
    assert not any('987654321' in str(e) for e in audit)
    assert client.get('/api/admin/summary',headers=admin).json()['active_jobs']==0


def test_revoked_team_member_and_password_reset(env):
    client,admin,_=env
    member, token=add_member(client,admin,'t3test','tecnico')
    assert client.post(f"/api/admin/team/{member['id']}/password",json={'password':'new-secure-password-2026'},headers=admin).status_code==200
    assert client.patch(f"/api/admin/team/{member['id']}",json={'active':False},headers=admin).status_code==200
    assert client.get('/api/team/me',headers=token).status_code==401
    assert client.post('/api/team/login',json={'username':'t3test','password':'new-secure-password-2026'}).status_code==401
    assert client.patch(f"/api/admin/team/{member['id']}",json={'active':True},headers=admin).status_code==200
    assert client.post('/api/team/login',json={'username':'t3test','password':'new-secure-password-2026'}).status_code==200
    assert client.post('/api/team/login',json={'username':'t3test','password':'password-t3test-secure-2026'}).status_code==401


def test_privacy_guard_and_preflight_before_collecting_real_data(tmp_path):
    settings=Settings(db_path=str(tmp_path/'real.sqlite'),admin_hash='',session_secret='',
                      demo_mode=False,privacy_notice_url='')
    with TestClient(create_app(settings)) as client:
        assert client.get('/api/readiness').status_code==503
        response=client.post('/api/quotes',json={'customer_name':'Prueba real','phone':'987654321',
                                                  'privacy_accepted':True,'items':[{'product_id':1,'quantity':1}]})
        assert response.status_code==503
    settings=Settings(db_path=str(tmp_path/'ready.sqlite'),admin_hash=hash_password(ADMIN_PASSWORD),
                      session_secret=SECRET,demo_mode=False,privacy_notice_url='https://example.org/aviso-privacidad')
    with TestClient(create_app(settings)) as client:
        assert client.get('/api/readiness').status_code==200
        assert client.get('/api/config').json()['privacy_notice_url'].startswith('https://')
        admin={'Authorization':'Bearer '+issue_token(SECRET)}
        product={'sku':'REAL-SRV','name':'Soporte informático','category':'Soporte','kind':'servicio'}
        item=client.post('/api/admin/products',json=product,headers=admin).json()
        payload={'customer_name':'Cliente ejemplo','phone':'987654321','items':[{'product_id':item['id'],'quantity':1}]}
        assert client.post('/api/quotes',json=payload).status_code==422
        accepted=client.post('/api/quotes',json={**payload,'privacy_accepted':True})
        assert accepted.status_code==201,accepted.text
        with connect(settings.db_path) as db:
            quote=db.execute('SELECT privacy_accepted_at,privacy_notice_url FROM quotes').fetchone()
            assert quote['privacy_accepted_at'] and quote['privacy_notice_url']==settings.privacy_notice_url


def test_backup_is_complete_and_restorable(env,tmp_path):
    client,admin,db=env
    response=client.post('/api/quotes',json={'customer_name':'Respaldo Test','phone':'987654321',
                                              'items':[{'product_id':1,'quantity':1}]})
    assert response.status_code==201
    target=backup_database(db,tmp_path/'secure-backups')
    assert target.is_file() and target.stat().st_mode & 0o077 == 0
    with connect(str(target)) as snapshot:
        assert snapshot.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
        assert snapshot.execute('SELECT count(*) FROM quotes').fetchone()[0]==1
        assert snapshot.execute('SELECT count(*) FROM products').fetchone()[0]==8


def test_migration_keeps_data_and_idempotent(env):
    client,admin,db=env
    record=client.post('/api/admin/products',json={'sku':'NEW-1','name':'Prueba persistencia',
                    'category':'Técnico','kind':'producto'},headers=admin)
    assert record.status_code==201
    initialize(str(db),seed_demo=True)
    initialize(str(db),seed_demo=True)
    assert any(p['sku']=='NEW-1' for p in client.get('/api/products').json())
    with connect(str(db)) as db_conn:
        assert 'assigned_to' in {c['name'] for c in db_conn.execute('PRAGMA table_info(service_jobs)')}
