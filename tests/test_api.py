import re

import pytest
from fastapi.testclient import TestClient

from backend.main import Settings, create_app
from backend.security import hash_password, issue_token, verify_password, verify_token


@pytest.fixture()
def client(tmp_path):
    settings = Settings(
        db_path=str(tmp_path / 'test.db'),
        admin_hash=hash_password('ContraseñaPrueba!2026', salt=b'0123456789abcdef'),
        session_secret='local-test-secret-very-long-at-least-thirty-two-chars',
        whatsapp_number='51987654321',
        demo_mode=True,
    )
    with TestClient(create_app(settings)) as c:
        yield c


@pytest.fixture()
def headers(client):
    res = client.post('/api/admin/login', json={'password': 'ContraseñaPrueba!2026'})
    assert res.status_code == 200
    return {'Authorization': f"Bearer {res.json()['access_token']}"}


def test_health_config_and_demo_catalog(client):
    assert client.get('/api/health').json()['status'] == 'ok'
    assert client.get('/api/config').json()['whatsapp_enabled'] is True
    products = client.get('/api/products').json()
    assert len(products) == 8
    assert len(client.get('/api/products?kind=servicio').json()) == 6
    assert client.get('/api/products?kind=producto').json()[0]['kind'] == 'producto'
    assert 'DENY' in client.get('/').headers['x-frame-options']
    assert 'Content-Security-Policy' in client.get('/').headers
    assert client.get('/static/app.js').status_code == 200
    assert client.get('/admin').status_code == 200


def test_public_cannot_access_admin(client):
    for resource in ['/api/admin/me', '/api/admin/quotes', '/api/admin/jobs', '/api/admin/products', '/api/admin/summary']:
        assert client.get(resource).status_code == 401
    assert client.post('/api/admin/products', json={}).status_code == 401
    assert client.get('/api/admin/summary', headers={'Authorization': 'Bearer bad.token'}).status_code == 401


def test_security_token_and_password():
    stored = hash_password('a_very_secure_password_2026', salt=b'abcdefghijklmnop')
    assert verify_password('a_very_secure_password_2026', stored)
    assert not verify_password('bad-password', stored)
    assert not verify_password('anything', 'broken')
    secret = 'really-long-secret-string-1234567890'
    assert verify_token(issue_token(secret), secret)
    assert not verify_token(issue_token(secret, ttl=-3), secret)
    assert not verify_token('invalid', secret)
    assert not verify_token(issue_token(secret), 'different-long-secret-123456789')


def test_login_wrong_password_and_bruteforce(client):
    assert client.post('/api/admin/login', json={'password': 'wrong'}).status_code == 401
    for _ in range(7):
        client.post('/api/admin/login', json={'password': 'wrong'})
    assert client.post('/api/admin/login', json={'password': 'wrong'}).status_code == 429


def test_create_quote_snapshot_and_whatsapp(client, headers):
    first = client.get('/api/products').json()[0]
    payload = {'customer_name': 'Ana Torres', 'phone': '987654321', 'notes': 'Necesito una página web', 'items': [{'product_id': first['id'], 'quantity': 2}]}
    response = client.post('/api/quotes', json=payload)
    assert response.status_code == 201
    data = response.json()
    assert re.match(r'COT-\d{8}-[A-F0-9]{6}', data['code'])
    assert 'wa.me/51987654321?text=' in data['whatsapp_url']
    assert 'Ana Torres' in data['message']
    assert data['total_cents'] is None
    assert 'precio' not in data['message'].lower()
    saved = client.get('/api/admin/quotes', headers=headers).json()[0]
    assert saved['code'] == data['code']
    assert saved['status'] == 'nuevo'
    assert saved['items'][0]['name'] == first['name']
    assert saved['customer_name'] == 'Ana Torres'
    assert client.get('/api/admin/summary', headers=headers).json()['pending_quotes'] == 1


def test_quote_rejects_invalid_items_and_input(client):
    base = {'customer_name': 'Luis Pérez', 'phone': '+51 999 555 222', 'items': [{'product_id': 98765432, 'quantity': 1}]}
    assert client.post('/api/quotes', json=base).status_code == 422
    assert client.post('/api/quotes', json={**base, 'items': []}).status_code == 422
    assert client.post('/api/quotes', json={**base, 'items': [{'product_id':1, 'quantity': 51}]}).status_code == 422
    assert client.post('/api/quotes', json={**base, 'phone': '<script>alert(1)</script>'}).status_code == 422
    assert client.post('/api/quotes', json={**base, 'items': [{'product_id':1, 'quantity': 30}, {'product_id':1, 'quantity': 30}]}).status_code == 422
    assert client.get('/api/products?category=x%27%20OR%201=1--').json() == []


def test_admin_create_edit_and_price_validation(client, headers):
    item = {'sku':'CAM-100','name':'Cámara IP Full HD','category':'Videovigilancia','kind':'producto',
            'description':'Modelo de ejemplo','price_cents':24990,'stock':3,'active':True,'featured':True}
    created = client.post('/api/admin/products', json=item, headers=headers)
    assert created.status_code == 201
    product_id = created.json()['id']
    assert client.post('/api/admin/products', json=item, headers=headers).status_code == 409
    assert client.post('/api/admin/products', json={**item,'sku':'CAM-101','price_cents':-1}, headers=headers).status_code == 422
    assert client.post('/api/quotes', json={'customer_name':'Sara','phone':'987654321','items':[{'product_id':product_id,'quantity':4}]}).status_code == 422
    quote = client.post('/api/quotes', json={'customer_name':'Sara','phone':'987654321','items':[{'product_id':product_id,'quantity':2}]})
    assert quote.status_code == 201
    assert quote.json()['total_cents'] == 49980
    edited = client.put(f'/api/admin/products/{product_id}', json={**item,'active':False}, headers=headers)
    assert edited.status_code == 200
    assert not any(p['id']==product_id for p in client.get('/api/products').json())
    assert client.post('/api/quotes', json={'customer_name':'Sara','phone':'987654321','items':[{'product_id':product_id,'quantity':1}]}).status_code == 422
    assert client.get('/api/admin/quotes', headers=headers).json()[0]['items'][0]['unit_price_cents'] == 24990


def test_quote_status_and_service_workflow(client, headers):
    quote = client.post('/api/quotes', json={'customer_name':'Ana Pérez','phone':'999888777','items':[{'product_id':1,'quantity':1}]})
    assert quote.status_code == 201
    quote_id = client.get('/api/admin/quotes', headers=headers).json()[0]['id']
    response = client.patch(f'/api/admin/quotes/{quote_id}/status', json={'status':'aprobado'}, headers=headers)
    assert response.status_code == 200
    assert client.patch(f'/api/admin/quotes/{quote_id}/status', json={'status':'cualquier_cosa'}, headers=headers).status_code == 422
    job = client.post('/api/admin/jobs', json={'title':'Mantenimiento preventivo','customer_name':'Ana Pérez','contact':'999888777','quote_id':quote_id}, headers=headers)
    assert job.status_code == 201
    assert job.json()['status'] == 'pendiente'
    job_id = job.json()['id']
    assert client.patch(f'/api/admin/jobs/{job_id}', json={'status':'en_proceso'}, headers=headers).status_code == 200
    assert client.patch(f'/api/admin/jobs/{job_id}', json={'status':'finalizado','notes':'Trabajo realizado'}, headers=headers).json()['notes'] == 'Trabajo realizado'
    summary = client.get('/api/admin/summary', headers=headers).json()
    assert summary['approved_quotes'] == 1
    assert summary['active_jobs'] == 0
    assert client.post('/api/admin/jobs', json={'title':'Trabajo válido','customer_name':'Ana','quote_id':999999}, headers=headers).status_code == 422


def test_unconfigured_whatsapp_and_auth(tmp_path):
    app = create_app(Settings(db_path=str(tmp_path / 'other.db'), admin_hash='', session_secret='', whatsapp_number=''))
    with TestClient(app) as client:
        assert client.get('/api/config').json()['whatsapp_enabled'] is False
        assert client.post('/api/admin/login', json={'password':'nonempty'}).status_code == 503
        assert client.get('/api/admin/summary').status_code == 503
        data = client.post('/api/quotes', json={'customer_name':'Ana Torres','phone':'987654321','items':[{'product_id':1,'quantity':1}]}).json()
        assert data['whatsapp_url'] is None
        assert data['message']


def test_public_tracking_protects_contact_data(client, headers):
    response = client.post('/api/quotes', json={'customer_name':'Ana Torres','phone':'+51 987 654 321','email':'ana@example.com','notes':'Privado','items':[{'product_id':1,'quantity':1}]})
    code = response.json()['code']
    assert client.post('/api/quote-status', json={'code':code,'phone':'111111111'}).status_code == 404
    state = client.post('/api/quote-status', json={'code':code,'phone':'+51 987 654 321'})
    assert state.status_code == 200
    record = state.json()
    assert record['status'] == 'nuevo' and record['code'] == code
    assert record['items'] and 'customer_name' not in record and 'phone' not in record and 'notes' not in record
    quote_id = client.get('/api/admin/quotes', headers=headers).json()[0]['id']
    client.patch(f'/api/admin/quotes/{quote_id}/status', json={'status':'cotizado'}, headers=headers)
    assert client.post('/api/quote-status', json={'code':code,'phone':'+51 987 654 321'}).json()['status']=='cotizado'
    assert client.post('/api/quote-status', json={'code':'COT-20261013-AAAAAA','phone':'987654321'}).status_code == 404
    assert client.post('/api/quote-status', json={'code':code,'phone':'+51 987 654 321'}).headers['cache-control'] == 'no-store'


def test_non_demo_configuration_does_not_seed_examples(tmp_path):
    settings = Settings(db_path=str(tmp_path / 'production-like.db'),
                        admin_hash='', session_secret='', whatsapp_number='', demo_mode=False)
    with TestClient(create_app(settings)) as client:
        assert client.get('/api/config').json()['demo_mode'] is False
        assert client.get('/api/products').json() == []
        assert client.get('/api/health').json()['version'] == '0.2.0'


def test_security_headers_on_quote_responses(client):
    response = client.post('/api/quotes', json={
        'customer_name':'Prueba Local', 'phone':'987654321',
        'items':[{'product_id':1,'quantity':1}]
    })
    assert response.status_code == 201
    assert response.headers['cache-control'] == 'no-store'
    assert 'default-src' in response.headers['content-security-policy']
    assert response.json()['state'] == 'registrado'
