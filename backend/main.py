"""API REST para APEX_PRIME_X: catálogo, cotizaciones y gestión interna.

La versión de desarrollo no recibe pagos ni publica servicios externos.
"""
import ipaddress
import json
import os
import re
import secrets
import sqlite3
import time
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal
from urllib.parse import quote as urlquote, urlsplit

from fastapi import Depends, FastAPI, Header, HTTPException, Request, status
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field, field_validator

from .database import as_dict, audit_action, connect, initialize, transaction
from .rate_limit import SlidingWindowLimiter
from .security import issue_token, valid_password_hash, verify_password, verify_token

FRONTEND = Path(__file__).resolve().parent.parent / 'frontend'
ROOT = Path(__file__).resolve().parent.parent
PRIVACY_NOTICE_VERSION = '2026-10-draft-1'


@dataclass
class Settings:
    db_path: str = os.getenv('DB_PATH', str(ROOT / 'data' / 'apex.db'))
    admin_hash: str = os.getenv('ADMIN_PASSWORD_HASH', '')
    session_secret: str = os.getenv('SESSION_SECRET', '')
    whatsapp_number: str = os.getenv('WHATSAPP_NUMBER', '')
    demo_mode: bool = os.getenv('DEMO_MODE', 'true').lower() == 'true'
    environment: str = field(default_factory=lambda: os.getenv('APP_ENV', 'development'))
    privacy_approved: bool = os.getenv('PRIVACY_NOTICE_APPROVED', 'false').lower() == 'true'
    privacy_policy_url: str = os.getenv('PRIVACY_POLICY_URL', '')
    privacy_notice_version: str = os.getenv('PRIVACY_NOTICE_VERSION', PRIVACY_NOTICE_VERSION)
    quote_intake_enabled: bool = os.getenv('QUOTE_INTAKE_ENABLED', 'false').lower() == 'true'

    def __post_init__(self):
        """Normalize APP_ENV and reject unknown values before serving requests.

        Readiness, demo filtering and quote intake use exact environment
        comparisons. A typo such as 'Production' must never bypass them.
        """
        if not isinstance(self.environment, str):
            raise ValueError('APP_ENV debe ser development o production')
        self.environment = self.environment.strip().lower()
        if self.environment not in ('development', 'production'):
            raise ValueError('APP_ENV debe ser development o production')


def valid_contact_phone(value: str) -> bool:
    """Allow ASCII digits and common separators, with '+' only at the start.

    Unicode digits and embedded control characters are not dialable contact
    numbers; accepting them makes customer follow-up unreliable.
    """
    return (bool(re.fullmatch(r'\+?[0-9 ()-]{7,25}', value)) and
            7 <= len(re.sub(r'[^0-9]', '', value)) <= 15)



def valid_privacy_policy_url(value: str) -> bool:
    """Require an actionable HTTPS privacy notice before collecting customer data.

    urlsplit alone accepts strings such as 'https://' and malformed ports;
    reject credentials, whitespace, backslashes, and non-public hosts.
    DNS resolution and policy availability still require operator review.
    """
    if (not isinstance(value, str) or not value or value != value.strip() or
            any(char.isspace() or char == '\\' for char in value)):
        return False
    try:
        parts = urlsplit(value)
        host = parts.hostname
        if (parts.scheme != 'https' or not host or
                parts.username is not None or parts.password is not None or
                (parts.port is not None and not 1 <= parts.port <= 65535)):
            return False
        # A loopback, private or single-label host cannot serve a public
        # privacy notice. This is a syntactic check, not a DNS/uptime probe.
        try:
            address = ipaddress.ip_address(host)
        except ValueError:
            ascii_host = host.rstrip('.').encode('idna').decode('ascii')
            labels = ascii_host.split('.')
            if (len(ascii_host) > 253 or len(labels) < 2 or
                    labels[-1] in {'localhost', 'local', 'internal', 'test', 'invalid', 'example'} or
                    labels[-1].isdigit() or
                    any(not re.fullmatch(r'[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?', label)
                        for label in labels)):
                return False
            # RFC 2606 reserves example.com/.net/.org (and their subdomains)
            # for documentation. A placeholder must not unlock quote intake.
            if tuple(labels[-2:]) in {('example', 'com'), ('example', 'net'), ('example', 'org')}:
                return False
        else:
            if not address.is_global:
                return False
        return True
    except (ValueError, UnicodeError):
        return False


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
    consent: Literal[True]  # No aceptar silenciosamente ni omitir la autorización.

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
        # Los separadores son opcionales, pero el contacto debe contener
        # un número real. E.164 permite hasta 15 dígitos (incluido país).
        if not valid_contact_phone(value):
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

    @field_validator('phone')
    @classmethod
    def valid_phone(cls, value: str):
        value = value.strip()
        if not valid_contact_phone(value):
            raise ValueError('Teléfono no válido')
        return value


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

    @field_validator('title')
    @classmethod
    def nonblank_title(cls, value: str):
        value = value.strip()
        if len(value) < 3:
            raise ValueError('El título debe tener al menos 3 caracteres')
        return value

    @field_validator('customer_name')
    @classmethod
    def nonblank_customer_name(cls, value: str):
        value = value.strip()
        if len(value) < 2:
            raise ValueError('El nombre del cliente debe tener al menos 2 caracteres')
        return value


class JobUpdate(BaseModel):
    status: Literal['pendiente', 'en_proceso', 'finalizado', 'cancelado']
    notes: str | None = Field(default=None, max_length=1000)


def new_code(prefix: str) -> str:
    return f'{prefix}-{time.strftime("%Y%m%d", time.gmtime())}-{secrets.token_hex(3).upper()}'


def insert_with_code(db, prefix: str, table: str, sql: str, values: tuple):
    """Retry only generated-code collisions, never unrelated database failures.

    Both target tables have a UNIQUE constraint on code. A rare random-code
    collision must not turn a valid customer request into a failed request.
    """
    for _ in range(5):
        code = new_code(prefix)
        try:
            cursor = db.execute(sql, (code, *values))
        except sqlite3.IntegrityError as exc:
            if str(exc) != f'UNIQUE constraint failed: {table}.code':
                raise
        else:
            return code, cursor
    raise HTTPException(503, 'No se pudo generar un código único. Intenta nuevamente.')


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    initialize(settings.db_path, seed_demo=settings.demo_mode)
    app = FastAPI(title='APEX_PRIME_X API', version='0.3.0', docs_url='/api/docs', redoc_url=None)
    app.state.settings = settings
    # Limitar memoria por proceso y sincronizar peticiones concurrentes.
    # En producción, añadir control distribuido en el proxy/WAF.
    app.state.rate_limiter = SlidingWindowLimiter(max_keys=4096)

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
        if not app.state.rate_limiter.allow(group, remote, limit, window):
            raise HTTPException(429, 'Demasiados intentos. Intenta más tarde.')

    def admin_auth(authorization: str = Header(default='')):
        if not settings.session_secret or len(settings.session_secret) < 32:
            raise HTTPException(503, 'Configuración de administración pendiente')
        token = authorization[7:] if authorization.startswith('Bearer ') else ''
        if not token or not verify_token(token, settings.session_secret):
            raise HTTPException(401, 'Se requiere una sesión de administrador válida', headers={'WWW-Authenticate': 'Bearer'})

    def readiness_checks():
        number = re.sub(r'\D', '', settings.whatsapp_number)
        with connect(settings.db_path) as db:
            real_products = db.execute("SELECT count(*) FROM products WHERE active=1 AND sku NOT LIKE 'DEMO-%'").fetchone()[0]
        return {
            'admin_credentials': valid_password_hash(settings.admin_hash) and len(settings.session_secret) >= 32,
            'demo_disabled': not settings.demo_mode,
            'business_catalog': real_products > 0,
            'whatsapp_configured': bool(8 <= len(number) <= 15),
            'privacy_notice_approved': (settings.privacy_approved and
                valid_privacy_policy_url(settings.privacy_policy_url) and
                len(settings.privacy_notice_version.strip()) >= 3 and
                'draft' not in settings.privacy_notice_version.lower()),
            'quote_intake_enabled': settings.quote_intake_enabled,
        }

    @app.get('/api/health')
    def health():
        return {'status': 'ok', 'service': 'APEX_PRIME_X', 'version': '0.3.0'}

    @app.get('/api/ready')
    def ready():
        checks = readiness_checks()
        readiness = all(checks.values())
        return JSONResponse(status_code=200 if readiness else 503, content={'ready': readiness, 'checks': checks})

    @app.get('/api/config')
    def config():
        number = re.sub(r'\D', '', settings.whatsapp_number)
        active_intake = settings.quote_intake_enabled and (settings.environment != 'production' or all(readiness_checks().values()))
        return {'company': 'APEX_PRIME_X', 'currency': 'PEN', 'whatsapp_enabled': bool(8 <= len(number) <= 15),
                'demo_mode': settings.demo_mode, 'quote_intake_enabled': active_intake}

    @app.get('/api/products')
    def products(category: str | None = None, kind: str | None = None):
        if settings.environment == 'production' and settings.demo_mode:
            return []  # Nunca ofrecer artículos DEMO con un despliegue marcado como producción.
        sql = 'SELECT * FROM products WHERE active=1'
        if settings.environment == 'production':
            # Old DEMO rows may remain after a database is switched to production.
            sql += " AND sku NOT LIKE 'DEMO-%'"
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
        if not settings.quote_intake_enabled:
            raise HTTPException(503, 'Recepción de solicitudes deshabilitada hasta autorizar su puesta en servicio')
        if settings.environment == 'production' and not all(readiness_checks().values()):
            raise HTTPException(503, 'Tienda en preparación: no se reciben cotizaciones todavía')
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
            product_sql = f'SELECT * FROM products WHERE active=1 AND id IN ({placeholders})'
            if settings.environment == 'production':
                product_sql += " AND sku NOT LIKE 'DEMO-%'"
            rows = db.execute(product_sql, tuple(counts)).fetchall()
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
            code, _ = insert_with_code(
                db, 'COT', 'quotes',
                '''INSERT INTO quotes (code,customer_name,phone,email,notes,items_json,total_cents,consent_at,privacy_notice_version)
                           VALUES (?,?,?,?,?,?,?,datetime('now'),?)''',
                (payload.customer_name, payload.phone, payload.email, payload.notes,
                 json.dumps(records, ensure_ascii=False), total, settings.privacy_notice_version))
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
        if not valid_password_hash(settings.admin_hash) or len(settings.session_secret) < 32:
            raise HTTPException(503, 'Configura ADMIN_PASSWORD_HASH y SESSION_SECRET en el servidor')
        if not verify_password(payload.password, settings.admin_hash):
            raise HTTPException(401, 'Credenciales inválidas')
        return {'access_token': issue_token(settings.session_secret), 'token_type': 'bearer', 'expires_in': 8 * 3600}

    @app.get('/api/admin/me', dependencies=[Depends(admin_auth)])
    def me():
        return {'role': 'admin', 'company': 'APEX_PRIME_X'}

    @app.get('/api/admin/summary', dependencies=[Depends(admin_auth)])
    def summary():
        # Keep the commercial KPI aligned with the production catalog:
        # migrated DEMO rows remain editable in admin but are not sellable.
        active_products_sql = 'SELECT count(*) FROM products WHERE active=1'
        if settings.environment == 'production':
            active_products_sql += " AND sku NOT LIKE 'DEMO-%'"
        with connect(settings.db_path) as db:
            return {
                'active_products': db.execute(active_products_sql).fetchone()[0],
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
            audit_action(db, 'create', 'product', row['id'], {'sku': payload.sku})
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
            audit_action(db, 'update', 'product', product_id, {'sku': payload.sku})
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
            row = db.execute('SELECT id,status FROM quotes WHERE id=?', (quote_id,)).fetchone()
            if not row:
                raise HTTPException(404, 'Cotización no encontrada')
            db.execute("UPDATE quotes SET status=?,updated_at=datetime('now') WHERE id=?", (payload.status, quote_id))
            audit_action(db, 'status_change', 'quote', quote_id, {'from': row['status'], 'to': payload.status})
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
            code, cursor = insert_with_code(
                db, 'SRV', 'service_jobs',
                '''INSERT INTO service_jobs
            (code,quote_id,title,customer_name,contact,notes) VALUES (?,?,?,?,?,?)''',
                (payload.quote_id, payload.title.strip(), payload.customer_name.strip(),
                 payload.contact.strip(), payload.notes.strip()))
            row = db.execute('SELECT * FROM service_jobs WHERE id=?', (cursor.lastrowid,)).fetchone()
            audit_action(db, 'create', 'service_job', row['id'])
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
            audit_action(db, 'status_change', 'service_job', job_id, {'from': old['status'], 'to': payload.status})
        return as_dict(row)

    @app.get('/api/admin/audit', dependencies=[Depends(admin_auth)])
    def audit(limit: int = 50):
        if not 1 <= limit <= 200:
            raise HTTPException(422, 'Límite permitido: 1 a 200')
        with connect(settings.db_path) as db:
            rows = [as_dict(row) for row in db.execute(
                'SELECT * FROM admin_audit ORDER BY id DESC LIMIT ?', (limit,)).fetchall()]
        for row in rows:
            row['details'] = json.loads(row.pop('details_json'))
        return rows

    @app.get('/privacidad')
    def privacy_notice():
        if (settings.environment == 'production' and settings.privacy_approved and
                valid_privacy_policy_url(settings.privacy_policy_url)):
            return RedirectResponse(settings.privacy_policy_url, status_code=302)
        return FileResponse(FRONTEND / 'privacy.html')

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
