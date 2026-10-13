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

from .database import as_dict, connect, initialize, transaction
from .security import issue_token, verify_password, verify_token

FRONTEND = Path(__file__).resolve().parent.parent / 'frontend'
ROOT = Path(__file__).resolve().parent.parent


@dataclass
class Settings:
    db_path: str = os.getenv('DB_PATH', str(ROOT / 'data' / 'apex.db'))
    admin_hash: str = os.getenv('ADMIN_PASSWORD_HASH', '')
    session_secret: str = os.getenv('SESSION_SECRET', '')
    whatsapp_number: str = os.getenv('WHATSAPP_NUMBER', '')
    demo_mode: bool = os.getenv('DEMO_MODE', 'true').lower() == 'true'


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


class JobUpdate(BaseModel):
    status: Literal['pendiente', 'en_proceso', 'finalizado', 'cancelado']
    notes: str | None = Field(default=None, max_length=1000)


def new_code(prefix: str) -> str:
    return f'{prefix}-{time.strftime("%Y%m%d", time.gmtime())}-{secrets.token_hex(3).upper()}'


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    initialize(settings.db_path, seed_demo=settings.demo_mode)
    app = FastAPI(title='APEX_PRIME_X API', version='0.2.0', docs_url='/api/docs', redoc_url=None)
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
        response.headers['Cache-Control'] = 'no-store' if (request.url.path.startswith('/api/admin') or request.url.path in ('/api/quotes', '/api/quote-status')) else 'public, max-age=60'
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

    @app.get('/api/health')
    def health():
        return {'status': 'ok', 'service': 'APEX_PRIME_X', 'version': '0.2.0'}

    @app.get('/api/config')
    def config():
        number = re.sub(r'\D', '', settings.whatsapp_number)
        return {'company': 'APEX_PRIME_X', 'currency': 'PEN', 'whatsapp_enabled': bool(8 <= len(number) <= 15),
                'demo_mode': settings.demo_mode}

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
                db.execute('''INSERT INTO quotes (code,customer_name,phone,email,notes,items_json,total_cents)
                           VALUES (?,?,?,?,?,?,?)''',
                           (code, payload.customer_name, payload.phone, payload.email, payload.notes,
                            json.dumps(records, ensure_ascii=False), total))
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
        return {'ok': True, 'id': quote_id, 'status': payload.status}

    @app.get('/api/admin/jobs', dependencies=[Depends(admin_auth)])
    def jobs():
        with connect(settings.db_path) as db:
            return [as_dict(row) for row in db.execute('SELECT * FROM service_jobs ORDER BY id DESC LIMIT 300').fetchall()]

    @app.post('/api/admin/jobs', dependencies=[Depends(admin_auth)], status_code=201)
    def add_job(payload: JobIn):
        with transaction(settings.db_path) as db:
            if payload.quote_id and not db.execute('SELECT 1 FROM quotes WHERE id=?', (payload.quote_id,)).fetchone():
                raise HTTPException(422, 'No existe la cotización asociada')
            code = new_code('SRV')
            cursor = db.execute('''INSERT INTO service_jobs
            (code,quote_id,title,customer_name,contact,notes) VALUES (?,?,?,?,?,?)''',
            (code, payload.quote_id, payload.title.strip(), payload.customer_name.strip(), payload.contact.strip(), payload.notes.strip()))
            row = db.execute('SELECT * FROM service_jobs WHERE id=?', (cursor.lastrowid,)).fetchone()
        return as_dict(row)

    @app.patch('/api/admin/jobs/{job_id}', dependencies=[Depends(admin_auth)])
    def update_job(job_id: int, payload: JobUpdate):
        with transaction(settings.db_path) as db:
            old = db.execute('SELECT * FROM service_jobs WHERE id=?', (job_id,)).fetchone()
            if not old:
                raise HTTPException(404, 'Servicio no encontrado')
            db.execute("UPDATE service_jobs SET status=?,notes=?,updated_at=datetime('now') WHERE id=?",
                       (payload.status, payload.notes if payload.notes is not None else old['notes'], job_id))
            row = db.execute('SELECT * FROM service_jobs WHERE id=?', (job_id,)).fetchone()
        return as_dict(row)

    # SPA y archivos estáticos sin CDN
    @app.get('/')
    def index():
        return FileResponse(FRONTEND / 'index.html')

    @app.get('/admin')
    def admin():
        return FileResponse(FRONTEND / 'admin.html')

    app.mount('/static', StaticFiles(directory=FRONTEND), name='static')
    return app


app = create_app()
