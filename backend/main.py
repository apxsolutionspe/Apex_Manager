"""API REST para APEX_PRIME_X: catálogo, cotizaciones y gestión interna.

La versión de desarrollo no recibe pagos ni publica servicios externos.
"""
import json
import os
import re
import secrets
import sqlite3
import time
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Literal
from urllib.parse import quote as urlquote

from fastapi import Depends, FastAPI, Header, HTTPException, Request, status
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field, field_validator

from .database import as_dict, connect, initialize, transaction, log_event
from .security import hash_password, issue_token, token_claims, verify_password, verify_token

FRONTEND = Path(__file__).resolve().parent.parent / 'frontend'
ROOT = Path(__file__).resolve().parent.parent


@dataclass
class Settings:
    db_path: str = os.getenv('DB_PATH', str(ROOT / 'data' / 'apex.db'))
    admin_hash: str = os.getenv('ADMIN_PASSWORD_HASH', '')
    session_secret: str = os.getenv('SESSION_SECRET', '')
    whatsapp_number: str = os.getenv('WHATSAPP_NUMBER', '')
    demo_mode: bool = os.getenv('DEMO_MODE', 'true').lower() == 'true'
    privacy_notice_url: str = os.getenv('PRIVACY_NOTICE_URL', '')


class CartItem(BaseModel):
    model_config = ConfigDict(extra='forbid')
    product_id: int = Field(ge=1)
    quantity: int = Field(ge=1, le=50)


class QuoteIn(BaseModel):
    model_config = ConfigDict(extra='forbid')
    customer_name: str = Field(min_length=2, max_length=100)
    phone: str = Field(min_length=7, max_length=25)
    email: str = Field(default='', max_length=160)
    notes: str = Field(default='', max_length=1000)
    items: list[CartItem] = Field(min_length=1, max_length=30)
    privacy_accepted: bool = False

    @field_validator('customer_name', 'phone', 'email', 'notes')
    @classmethod
    def clean(cls, value: str):
        return value.strip()

    @field_validator('customer_name')
    @classmethod
    def valid_name(cls, value: str):
        if len(value) < 2:
            raise ValueError('El nombre debe tener al menos 2 caracteres')
        return value

    @field_validator('phone')
    @classmethod
    def phone_format(cls, value: str):
        if not re.fullmatch(r'[\d\s+()\-]{7,25}', value):
            raise ValueError('Teléfono no válido')
        return value

    @field_validator('email')
    @classmethod
    def email_format(cls, value: str):
        if value and (not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', value)):
            raise ValueError('Correo no válido')
        return value


class QuoteLookupIn(BaseModel):
    code: str = Field(min_length=12, max_length=40, pattern=r'^COT-[0-9]{8}-[A-Fa-f0-9]{6}$')
    phone: str = Field(min_length=7, max_length=25)


class LoginIn(BaseModel):
    password: str = Field(min_length=1, max_length=512)


class ProductIn(BaseModel):
    model_config = ConfigDict(extra='forbid')
    sku: str = Field(min_length=3, max_length=32, pattern=r'^[A-Za-z0-9_-]+$')
    name: str = Field(min_length=3, max_length=120)
    description: str = Field(default='', max_length=600)
    category: str = Field(min_length=2, max_length=70)
    kind: Literal['producto', 'servicio']
    price_cents: int | None = Field(default=None, ge=0, le=1_000_000_000)
    emoji: str = Field(default='◈', max_length=8)
    featured: bool = False
    active: bool = True
    stock: int | None = Field(default=None, ge=0)

    @field_validator('name', 'category')
    @classmethod
    def not_blank(cls, value: str):
        if len(value.strip()) < 2:
            raise ValueError('Este campo es obligatorio')
        return value.strip()


class QuoteStatusIn(BaseModel):
    status: Literal['nuevo', 'contactado', 'cotizado', 'aprobado', 'rechazado']


class JobIn(BaseModel):
    title: str = Field(min_length=3, max_length=140)
    customer_name: str = Field(min_length=2, max_length=100)
    contact: str = Field(default='', max_length=100)
    notes: str = Field(default='', max_length=1000)
    quote_id: int | None = Field(default=None, ge=1)
    assigned_to: int | None = Field(default=None, ge=1)


class JobUpdate(BaseModel):
    status: Literal['pendiente', 'en_proceso', 'finalizado', 'cancelado']
    notes: str | None = Field(default=None, max_length=1000)
    assigned_to: int | None = Field(default=None, ge=1)


class TeamIn(BaseModel):
    model_config = ConfigDict(extra='forbid')
    name: str = Field(min_length=2, max_length=100)
    username: str = Field(min_length=3, max_length=40, pattern=r'^[a-zA-Z0-9._-]+$')
    password: str = Field(min_length=12, max_length=256)
    role: Literal['ventas', 'tecnico']


class TeamLoginIn(BaseModel):
    username: str = Field(min_length=3, max_length=40)
    password: str = Field(min_length=1, max_length=256)


class TeamStatusIn(BaseModel):
    active: bool


class TeamPasswordIn(BaseModel):
    password: str = Field(min_length=12, max_length=256)


class SalesQuoteStatusIn(BaseModel):
    status: Literal['contactado', 'cotizado', 'aprobado', 'rechazado']


def new_code(prefix: str) -> str:
    return f'{prefix}-{time.strftime("%Y%m%d", time.gmtime())}-{secrets.token_hex(3).upper()}'


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    initialize(settings.db_path, seed_demo=settings.demo_mode)
    app = FastAPI(title='APEX_PRIME_X API', version='0.3.0', docs_url='/api/docs', redoc_url=None)
    app.state.settings = settings
    # Límite sencillo en memoria por proceso. En producción distribuir con Redis/WAF.
    app.state.attempts = defaultdict(list)

    @app.middleware('http')
    async def secure_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        response.headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=()'
        response.headers['Content-Security-Policy'] = ("default-src 'self'; script-src 'self'; style-src 'self'; "
                                                      "img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
        response.headers['Cache-Control'] = 'no-store' if (request.url.path.startswith(('/api/admin', '/api/team')) or request.url.path in ('/api/quotes', '/api/quote-status', '/api/config', '/api/readiness')) else 'public, max-age=60'
        return response

    def throttle(request: Request, group: str, limit: int, window: int):
        remote = request.client.host if request.client else 'unknown'
        key = f'{group}:{remote}'
        now = time.monotonic()
        attempts = app.state.attempts[key]
        app.state.attempts[key] = [v for v in attempts if now - v < window]
        if len(app.state.attempts[key]) >= limit:
            raise HTTPException(429, 'Demasiados intentos. Intenta más tarde.')
        app.state.attempts[key].append(now)

    def admin_auth(authorization: str = Header(default='')):
        if not settings.session_secret or len(settings.session_secret) < 32:
            raise HTTPException(503, 'Configuración de administración pendiente')
        token = authorization[7:] if authorization.startswith('Bearer ') else ''
        if not token or not verify_token(token, settings.session_secret):
            raise HTTPException(401, 'Se requiere una sesión de administrador válida', headers={'WWW-Authenticate': 'Bearer'})

    def team_auth(authorization: str = Header(default='')):
        if len(settings.session_secret) < 32:
            raise HTTPException(503, 'Autenticación no configurada')
        token = authorization[7:] if authorization.startswith('Bearer ') else ''
        claims = token_claims(token, settings.session_secret)
        if not claims or not claims['sub'].startswith('team:'):
            raise HTTPException(401, 'Credenciales de equipo inválidas')
        try:
            member_id = int(claims['sub'].split(':', 1)[1])
        except ValueError:
            raise HTTPException(401, 'Credenciales de equipo inválidas')
        with connect(settings.db_path) as db:
            member = db.execute('SELECT id,name,username,role,active FROM team_members WHERE id=?', (member_id,)).fetchone()
        if not member or not member['active']:
            raise HTTPException(401, 'La cuenta de equipo no está activa')
        return as_dict(member)

    def validate_assignee(db, member_id: int | None):
        if member_id is None:
            return
        member = db.execute('SELECT role,active FROM team_members WHERE id=?', (member_id,)).fetchone()
        if not member or not member['active'] or member['role'] != 'tecnico':
            raise HTTPException(422, 'Asigna un técnico activo')

    def approve_service_quote(db, quote_id: int, actor: str):
        quote = db.execute('SELECT * FROM quotes WHERE id=?', (quote_id,)).fetchone()
        if not quote or db.execute('SELECT 1 FROM service_jobs WHERE quote_id=?', (quote_id,)).fetchone():
            return False
        services = [item for item in json.loads(quote['items_json']) if item['kind'] == 'servicio']
        if not services:
            return False
        new = db.execute('''INSERT INTO service_jobs(code,quote_id,title,customer_name,contact,notes)
                            VALUES (?,?,?,?,?,?)''',
                         (new_code('SRV'), quote_id, ('Atender: ' + services[0]['name'])[:140],
                          quote['customer_name'], quote['phone'],
                          'Generada automáticamente al aprobar cotización; confirmar alcance.'))
        log_event(db, actor, 'autocreate', 'service_job', new.lastrowid)
        return True

    @app.get('/api/health')
    def health():
        return {'status': 'ok', 'service': 'APEX_PRIME_X', 'version': '0.3.0'}

    @app.get('/api/config')
    def config():
        number = re.sub(r'\D', '', settings.whatsapp_number)
        return {'company': 'APEX_PRIME_X', 'currency': 'PEN', 'whatsapp_enabled': bool(8 <= len(number) <= 15),
                'demo_mode': settings.demo_mode,
                'privacy_notice_url': settings.privacy_notice_url if settings.privacy_notice_url.startswith('https://') else None}

    @app.get('/api/readiness')
    def readiness():
        checks = {'admin_configured': bool(settings.admin_hash and len(settings.session_secret) >= 32),
                  'privacy_notice_configured': settings.privacy_notice_url.startswith('https://'),
                  'demo_disabled': not settings.demo_mode,
                  'whatsapp_configured': 8 <= len(re.sub(r'\D', '', settings.whatsapp_number)) <= 15}
        # WhatsApp puede permanecer desactivado sin impedir el catálogo.
        ready = all(checks[key] for key in ('admin_configured', 'privacy_notice_configured', 'demo_disabled'))
        return JSONResponse({'ready': ready, 'checks': checks}, status_code=200 if ready else 503)

    @app.get('/api/products')
    def products(category: str | None = None, kind: str | None = None):
        sql = 'SELECT * FROM products WHERE active=1'
        params = []
        if category:
            sql += ' AND category=?'
            params.append(category)
        if kind in ('producto', 'servicio'):
            sql += ' AND kind=?'
            params.append(kind)
        sql += ' ORDER BY featured DESC, id ASC'
        with connect(settings.db_path) as db:
            return [as_dict(row) for row in db.execute(sql, params).fetchall()]

    @app.post('/api/quotes', status_code=201)
    def create_quote(payload: QuoteIn, request: Request):
        throttle(request, 'quote', 12, 3600)
        if not settings.demo_mode and not settings.privacy_notice_url.startswith('https://'):
            raise HTTPException(503, 'Solicitudes desactivadas hasta aprobar el aviso de privacidad')
        if not settings.demo_mode and not payload.privacy_accepted:
            raise HTTPException(422, 'Debes aceptar el aviso de privacidad')
        counts = defaultdict(int)
        for item in payload.items:
            counts[item.product_id] += item.quantity
            if counts[item.product_id] > 50:
                raise HTTPException(422, 'Cantidad máxima por artículo: 50')
        if len(counts) > 30:
            raise HTTPException(422, 'Demasiados artículos')
        with transaction(settings.db_path) as db:
            placeholders = ','.join('?' for _ in counts)
            rows = db.execute(f'SELECT * FROM products WHERE active=1 AND id IN ({placeholders})', tuple(counts)).fetchall()
            if len(rows) != len(counts):
                raise HTTPException(422, 'Uno o varios artículos no están disponibles')
            records = []
            prices = []
            for row in rows:
                product = as_dict(row)
                quantity = counts[product['id']]
                if product['stock'] is not None and quantity > product['stock']:
                    raise HTTPException(422, f"Stock insuficiente: {product['name']}")
                unit_price = product['price_cents']
                records.append({'product_id': product['id'], 'sku': product['sku'], 'name': product['name'],
                                'kind': product['kind'], 'quantity': quantity, 'unit_price_cents': unit_price})
                prices.append(None if unit_price is None else unit_price * quantity)
            total = sum(prices) if all(value is not None for value in prices) else None
            code = new_code('COT')
            try:
                db.execute('''INSERT INTO quotes (code,customer_name,phone,email,notes,items_json,total_cents,
                             privacy_accepted_at,privacy_notice_url)
                           VALUES (?,?,?,?,?,?,?,?,?)''',
                           (code, payload.customer_name, payload.phone, payload.email, payload.notes,
                            json.dumps(records, ensure_ascii=False), total,
                            time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()) if payload.privacy_accepted else None,
                            settings.privacy_notice_url if payload.privacy_accepted else None))
            except sqlite3.IntegrityError:
                raise HTTPException(503, 'Intenta nuevamente')
        lines = [f'Hola, APEX_PRIME_X. Solicito la cotización {code}:']
        lines += [f"• {i['name']} x{i['quantity']}" for i in records]
        lines += [f'Cliente: {payload.customer_name}', f'Contacto: {payload.phone}']
        if payload.notes:
            lines.append(f'Detalles: {payload.notes}')
        lines.append('Quedo atento/a a su propuesta. Gracias.')
        message = '\n'.join(lines)
        number = re.sub(r'\D', '', settings.whatsapp_number)
        whatsapp_url = f'https://wa.me/{number}?text={urlquote(message)}' if 8 <= len(number) <= 15 else None
        return {'code': code, 'total_cents': total, 'whatsapp_url': whatsapp_url, 'message': message,
                'state': 'registrado', 'notice': 'La solicitud quedó registrada. WhatsApp se abre únicamente si el cliente lo confirma.'}

    @app.post('/api/quote-status')
    def lookup_quote(payload: QuoteLookupIn, request: Request):
        # Consulta de estado sin publicar datos de clientes ni crear un portal abierto.
        throttle(request, 'status', 20, 3600)
        digits = re.sub(r'\D', '', payload.phone)
        if len(digits) < 7:
            raise HTTPException(422, 'Teléfono no válido')
        with connect(settings.db_path) as db:
            row = db.execute('SELECT * FROM quotes WHERE code=?', (payload.code.upper(),)).fetchone()
            if not row or re.sub(r'\D', '', row['phone']) != digits:
                raise HTTPException(404, 'No se encontró una solicitud con esos datos')
            record = as_dict(row)
        return {'code': record['code'], 'status': record['status'],
                'created_at': record['created_at'], 'updated_at': record['updated_at'],
                'items': [{'name': item['name'], 'quantity': item['quantity']}
                          for item in json.loads(record['items_json'])],
                'total_cents': record['total_cents']}

    @app.post('/api/admin/login')
    def login(payload: LoginIn, request: Request):
        throttle(request, 'login', 8, 15 * 60)
        if not settings.admin_hash or len(settings.session_secret) < 32:
            raise HTTPException(503, 'Configura ADMIN_PASSWORD_HASH y SESSION_SECRET en el servidor')
        if not verify_password(payload.password, settings.admin_hash):
            raise HTTPException(401, 'Credenciales inválidas')
        return {'access_token': issue_token(settings.session_secret), 'token_type': 'bearer', 'expires_in': 8 * 3600}

    @app.get('/api/admin/me', dependencies=[Depends(admin_auth)])
    def me():
        return {'role': 'admin', 'company': 'APEX_PRIME_X'}

    @app.get('/api/admin/summary', dependencies=[Depends(admin_auth)])
    def summary():
        with connect(settings.db_path) as db:
            return {
                'active_products': db.execute('SELECT count(*) FROM products WHERE active=1').fetchone()[0],
                'total_quotes': db.execute('SELECT count(*) FROM quotes').fetchone()[0],
                'pending_quotes': db.execute("SELECT count(*) FROM quotes WHERE status IN ('nuevo','contactado')").fetchone()[0],
                'active_jobs': db.execute("SELECT count(*) FROM service_jobs WHERE status IN ('pendiente','en_proceso')").fetchone()[0],
                'approved_quotes': db.execute("SELECT count(*) FROM quotes WHERE status='aprobado'").fetchone()[0],
                'team_members': db.execute('SELECT count(*) FROM team_members WHERE active=1').fetchone()[0],
                'unassigned_jobs': db.execute("SELECT count(*) FROM service_jobs WHERE assigned_to IS NULL AND status IN ('pendiente','en_proceso')").fetchone()[0],
            }

    @app.get('/api/admin/products', dependencies=[Depends(admin_auth)])
    def all_products():
        with connect(settings.db_path) as db:
            return [as_dict(row) for row in db.execute('SELECT * FROM products ORDER BY id DESC').fetchall()]

    @app.post('/api/admin/products', dependencies=[Depends(admin_auth)], status_code=201)
    def add_product(payload: ProductIn):
        with transaction(settings.db_path) as db:
            try:
                cursor = db.execute('''INSERT INTO products
                (sku,name,description,category,kind,price_cents,emoji,featured,active,stock)
                VALUES (?,?,?,?,?,?,?,?,?,?)''',
                (payload.sku, payload.name.strip(), payload.description.strip(), payload.category.strip(), payload.kind,
                 payload.price_cents, payload.emoji, int(payload.featured), int(payload.active), payload.stock))
            except sqlite3.IntegrityError:
                raise HTTPException(409, 'El SKU ya está registrado')
            log_event(db, 'admin', 'create', 'product', cursor.lastrowid)
            row = db.execute('SELECT * FROM products WHERE id=?', (cursor.lastrowid,)).fetchone()
        return as_dict(row)

    @app.put('/api/admin/products/{product_id}', dependencies=[Depends(admin_auth)])
    def update_product(product_id: int, payload: ProductIn):
        with transaction(settings.db_path) as db:
            if not db.execute('SELECT 1 FROM products WHERE id=?', (product_id,)).fetchone():
                raise HTTPException(404, 'Artículo no encontrado')
            try:
                db.execute('''UPDATE products SET sku=?,name=?,description=?,category=?,kind=?,
                price_cents=?,emoji=?,featured=?,active=?,stock=? WHERE id=?''',
                (payload.sku, payload.name.strip(), payload.description.strip(), payload.category.strip(), payload.kind,
                 payload.price_cents, payload.emoji, int(payload.featured), int(payload.active), payload.stock, product_id))
            except sqlite3.IntegrityError:
                raise HTTPException(409, 'El SKU ya está registrado')
            log_event(db, 'admin', 'update', 'product', product_id)
            row = db.execute('SELECT * FROM products WHERE id=?', (product_id,)).fetchone()
        return as_dict(row)

    @app.get('/api/admin/quotes', dependencies=[Depends(admin_auth)])
    def quotes():
        with connect(settings.db_path) as db:
            rows = [as_dict(row) for row in db.execute('SELECT * FROM quotes ORDER BY id DESC LIMIT 300').fetchall()]
        for row in rows:
            row['items'] = json.loads(row.pop('items_json'))
        return rows

    @app.patch('/api/admin/quotes/{quote_id}/status', dependencies=[Depends(admin_auth)])
    def update_quote_status(quote_id: int, payload: QuoteStatusIn):
        with transaction(settings.db_path) as db:
            row = db.execute('SELECT id FROM quotes WHERE id=?', (quote_id,)).fetchone()
            if not row:
                raise HTTPException(404, 'Cotización no encontrada')
            db.execute("UPDATE quotes SET status=?,updated_at=datetime('now') WHERE id=?", (payload.status, quote_id))
            log_event(db, 'admin', 'status', 'quote', quote_id)
            autogenerated = approve_service_quote(db, quote_id, 'admin') if payload.status == 'aprobado' else False
        return {'ok': True, 'id': quote_id, 'status': payload.status, 'service_order_created': autogenerated}

    @app.get('/api/admin/jobs', dependencies=[Depends(admin_auth)])
    def jobs():
        with connect(settings.db_path) as db:
            return [as_dict(row) for row in db.execute('SELECT * FROM service_jobs ORDER BY id DESC LIMIT 300').fetchall()]

    @app.post('/api/admin/jobs', dependencies=[Depends(admin_auth)], status_code=201)
    def add_job(payload: JobIn):
        with transaction(settings.db_path) as db:
            if payload.quote_id and not db.execute('SELECT 1 FROM quotes WHERE id=?', (payload.quote_id,)).fetchone():
                raise HTTPException(422, 'No existe la cotización asociada')
            validate_assignee(db, payload.assigned_to)
            code = new_code('SRV')
            cursor = db.execute('''INSERT INTO service_jobs
            (code,quote_id,title,customer_name,contact,notes) VALUES (?,?,?,?,?,?)''',
            (code, payload.quote_id, payload.title.strip(), payload.customer_name.strip(), payload.contact.strip(), payload.notes.strip()))
            if payload.assigned_to is not None:
                db.execute('UPDATE service_jobs SET assigned_to=? WHERE id=?', (payload.assigned_to, cursor.lastrowid))
            log_event(db, 'admin', 'create', 'service_job', cursor.lastrowid)
            row = db.execute('SELECT * FROM service_jobs WHERE id=?', (cursor.lastrowid,)).fetchone()
        return as_dict(row)

    @app.patch('/api/admin/jobs/{job_id}', dependencies=[Depends(admin_auth)])
    def update_job(job_id: int, payload: JobUpdate):
        with transaction(settings.db_path) as db:
            old = db.execute('SELECT * FROM service_jobs WHERE id=?', (job_id,)).fetchone()
            if not old:
                raise HTTPException(404, 'Servicio no encontrado')
            assignee = payload.assigned_to if 'assigned_to' in payload.model_fields_set else old['assigned_to']
            validate_assignee(db, assignee)
            db.execute("UPDATE service_jobs SET status=?,notes=?,assigned_to=?,updated_at=datetime('now') WHERE id=?",
                       (payload.status, payload.notes if payload.notes is not None else old['notes'], assignee, job_id))
            log_event(db, 'admin', 'update', 'service_job', job_id)
            row = db.execute('SELECT * FROM service_jobs WHERE id=?', (job_id,)).fetchone()
        return as_dict(row)

    @app.get('/api/admin/team', dependencies=[Depends(admin_auth)])
    def all_team():
        with connect(settings.db_path) as db:
            return [as_dict(row) for row in db.execute(
                'SELECT id,name,username,role,active,created_at FROM team_members ORDER BY id DESC').fetchall()]

    @app.post('/api/admin/team', dependencies=[Depends(admin_auth)], status_code=201)
    def add_team_member(payload: TeamIn):
        with transaction(settings.db_path) as db:
            try:
                cursor = db.execute('INSERT INTO team_members(name,username,role,password_hash) VALUES (?,?,?,?)',
                                    (payload.name.strip(), payload.username.lower(), payload.role,
                                     hash_password(payload.password)))
            except sqlite3.IntegrityError:
                raise HTTPException(409, 'El usuario ya existe')
            log_event(db, 'admin', 'create', 'team_member', cursor.lastrowid)
            member = db.execute('SELECT id,name,username,role,active,created_at FROM team_members WHERE id=?',
                                (cursor.lastrowid,)).fetchone()
        return as_dict(member)

    @app.patch('/api/admin/team/{member_id}', dependencies=[Depends(admin_auth)])
    def update_team_status(member_id: int, payload: TeamStatusIn):
        with transaction(settings.db_path) as db:
            if not db.execute('SELECT 1 FROM team_members WHERE id=?', (member_id,)).fetchone():
                raise HTTPException(404, 'Miembro no encontrado')
            db.execute('UPDATE team_members SET active=? WHERE id=?', (int(payload.active), member_id))
            log_event(db, 'admin', 'activate' if payload.active else 'deactivate', 'team_member', member_id)
        return {'id': member_id, 'active': payload.active}

    @app.post('/api/admin/team/{member_id}/password', dependencies=[Depends(admin_auth)])
    def reset_team_password(member_id: int, payload: TeamPasswordIn):
        with transaction(settings.db_path) as db:
            if not db.execute('SELECT 1 FROM team_members WHERE id=?', (member_id,)).fetchone():
                raise HTTPException(404, 'Miembro no encontrado')
            db.execute('UPDATE team_members SET password_hash=? WHERE id=?', (hash_password(payload.password), member_id))
            log_event(db, 'admin', 'password_reset', 'team_member', member_id)
        return {'ok': True, 'note': 'Para revocar tokens ya emitidos, desactiva la cuenta; los tokens anteriores expiran en ocho horas.'}

    @app.get('/api/admin/audit', dependencies=[Depends(admin_auth)])
    def audit_log():
        with connect(settings.db_path) as db:
            return [as_dict(row) for row in db.execute('SELECT * FROM audit_events ORDER BY id DESC LIMIT 200').fetchall()]

    @app.post('/api/team/login')
    def member_login(payload: TeamLoginIn, request: Request):
        throttle(request, 'team-login', 8, 900)
        if len(settings.session_secret) < 32:
            raise HTTPException(503, 'Autenticación no configurada')
        with connect(settings.db_path) as db:
            member = db.execute('SELECT * FROM team_members WHERE username=? AND active=1',
                                (payload.username.lower(),)).fetchone()
        if not member or not verify_password(payload.password, member['password_hash']):
            raise HTTPException(401, 'Credenciales inválidas')
        return {'access_token': issue_token(settings.session_secret, subject=f"team:{member['id']}"),
                'role': member['role'], 'name': member['name'], 'expires_in': 8 * 3600}

    @app.get('/api/team/me')
    def team_me(member: dict = Depends(team_auth)):
        return member

    @app.get('/api/team/work')
    def team_work(member: dict = Depends(team_auth)):
        with connect(settings.db_path) as db:
            if member['role'] == 'tecnico':
                records = [as_dict(r) for r in db.execute('''SELECT id,code,title,customer_name,contact,notes,status,created_at,
                    updated_at FROM service_jobs WHERE assigned_to=? ORDER BY id DESC LIMIT 100''',
                    (member['id'],)).fetchall()]
                return {'type': 'jobs', 'records': records}
            records = [as_dict(r) for r in db.execute('''SELECT id,code,customer_name,phone,status,created_at,updated_at
                FROM quotes ORDER BY id DESC LIMIT 100''').fetchall()]
            return {'type': 'quotes', 'records': records}

    @app.patch('/api/team/jobs/{job_id}')
    def team_job_update(job_id: int, payload: JobUpdate, member: dict = Depends(team_auth)):
        if member['role'] != 'tecnico':
            raise HTTPException(403, 'Acceso exclusivo del personal técnico')
        if 'assigned_to' in payload.model_fields_set:
            raise HTTPException(403, 'Solo administración asigna técnicos')
        with transaction(settings.db_path) as db:
            row = db.execute('SELECT * FROM service_jobs WHERE id=? AND assigned_to=?',
                             (job_id, member['id'])).fetchone()
            if not row:
                raise HTTPException(404, 'Orden no asignada')
            db.execute("UPDATE service_jobs SET status=?,notes=?,updated_at=datetime('now') WHERE id=?",
                       (payload.status, payload.notes if payload.notes is not None else row['notes'], job_id))
            log_event(db, f"team:{member['id']}", 'update', 'service_job', job_id)
        return {'ok': True, 'id': job_id, 'status': payload.status}

    @app.patch('/api/team/quotes/{quote_id}/status')
    def team_quote_update(quote_id: int, payload: SalesQuoteStatusIn, member: dict = Depends(team_auth)):
        if member['role'] != 'ventas':
            raise HTTPException(403, 'Acceso exclusivo del personal de ventas')
        with transaction(settings.db_path) as db:
            if not db.execute('SELECT 1 FROM quotes WHERE id=?', (quote_id,)).fetchone():
                raise HTTPException(404, 'Cotización no encontrada')
            db.execute("UPDATE quotes SET status=?,updated_at=datetime('now') WHERE id=?", (payload.status, quote_id))
            actor = f"team:{member['id']}"
            log_event(db, actor, 'status', 'quote', quote_id)
            autogenerated = approve_service_quote(db, quote_id, actor) if payload.status == 'aprobado' else False
        return {'ok': True, 'service_order_created': autogenerated}

    # SPA y archivos estáticos sin CDN
    @app.get('/equipo')
    def team_portal():
        return FileResponse(FRONTEND / 'team.html')
    @app.get('/')
    def index():
        return FileResponse(FRONTEND / 'index.html')

    @app.get('/admin')
    def admin():
        return FileResponse(FRONTEND / 'admin.html')

    app.mount('/static', StaticFiles(directory=FRONTEND), name='static')
    return app


app = create_app()
