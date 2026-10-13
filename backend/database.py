"""Esquema SQLite, transacciones y catálogo inicial identificable como DEMO."""
import sqlite3
import json
from contextlib import contextmanager
from pathlib import Path

SCHEMA = """
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS products (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 sku TEXT NOT NULL UNIQUE,
 name TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 category TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('producto','servicio')),
 price_cents INTEGER CHECK(price_cents IS NULL OR price_cents >= 0),
 emoji TEXT NOT NULL DEFAULT '◈',
 featured INTEGER NOT NULL DEFAULT 0 CHECK(featured IN (0,1)),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 stock INTEGER CHECK(stock IS NULL OR stock >= 0),
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS quotes (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 code TEXT NOT NULL UNIQUE,
 customer_name TEXT NOT NULL,
 phone TEXT NOT NULL,
 email TEXT NOT NULL DEFAULT '',
 notes TEXT NOT NULL DEFAULT '',
 items_json TEXT NOT NULL,
 total_cents INTEGER,
 status TEXT NOT NULL DEFAULT 'nuevo' CHECK(status IN ('nuevo','contactado','cotizado','aprobado','rechazado')),
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS service_jobs (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 code TEXT NOT NULL UNIQUE,
 quote_id INTEGER REFERENCES quotes(id) ON DELETE SET NULL,
 title TEXT NOT NULL,
 customer_name TEXT NOT NULL,
 contact TEXT NOT NULL DEFAULT '',
 notes TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'pendiente' CHECK(status IN ('pendiente','en_proceso','finalizado','cancelado')),
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS team_members (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 username TEXT NOT NULL UNIQUE,
 role TEXT NOT NULL CHECK(role IN ('ventas', 'tecnico')),
 password_hash TEXT NOT NULL,
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS audit_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 actor TEXT NOT NULL,
 event TEXT NOT NULL,
 entity_type TEXT NOT NULL,
 entity_id INTEGER,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_events_created ON audit_events(id DESC);
CREATE INDEX IF NOT EXISTS idx_team_members_active_role ON team_members(active, role);
CREATE INDEX IF NOT EXISTS idx_quotes_status_created ON quotes(status, created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_status_created ON service_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(active, category);
"""

DEMO_ITEMS = [
 ("DEMO-WEB", "Desarrollo de páginas web", "Sitios web empresariales, tiendas y páginas de presentación adaptables a móviles.", "Desarrollo digital", "servicio", None, "🌐", 1, None),
 ("DEMO-SOFT", "Software a medida", "Sistemas para ventas, inventarios, reservas y automatizaciones según requerimientos.", "Desarrollo digital", "servicio", None, "⌘", 1, None),
 ("DEMO-CAM", "Instalación de cámaras de seguridad", "Evaluación, instalación y configuración de sistemas de videovigilancia.", "Instalaciones", "servicio", None, "◉", 1, None),
 ("DEMO-WIFI", "Redes WiFi y cableado", "Implementación y optimización de redes para hogares, oficinas y negocios.", "Instalaciones", "servicio", None, "📡", 0, None),
 ("DEMO-PC", "Mantenimiento de computadoras y laptops", "Diagnóstico, limpieza preventiva, optimización y asistencia técnica.", "Soporte técnico", "servicio", None, "🖥", 1, None),
 ("DEMO-PRINT", "Soporte para impresoras", "Revisión, configuración y mantenimiento preventivo de impresoras.", "Soporte técnico", "servicio", None, "🖨", 0, None),
 ("DEMO-ARDUINO", "Placas Arduino y protoboards", "Componentes para prototipado electrónico y proyectos educativos.", "Electrónica", "producto", None, "⚡", 0, None),
 ("DEMO-ACC", "Accesorios y periféricos", "Audífonos, cargadores, teclados, mouse y otros accesorios tecnológicos.", "Accesorios", "producto", None, "🎧", 0, None),
]


def connect(path: str):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(path, timeout=10, check_same_thread=False)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    con.execute("PRAGMA busy_timeout = 5000")
    return con


def initialize(path: str, seed_demo: bool = True):
    with connect(path) as db:
        db.executescript(SCHEMA)
        # Migración idempotente; la versión 0.2 no incluía esta columna.
        columns = {row['name'] for row in db.execute('PRAGMA table_info(service_jobs)')}
        if 'assigned_to' not in columns:
            db.execute('ALTER TABLE service_jobs ADD COLUMN assigned_to INTEGER REFERENCES team_members(id) ON DELETE SET NULL')
        db.execute('CREATE INDEX IF NOT EXISTS idx_jobs_assignee_status ON service_jobs(assigned_to, status)')
        quote_columns = {row['name'] for row in db.execute('PRAGMA table_info(quotes)')}
        if 'privacy_accepted_at' not in quote_columns:
            db.execute('ALTER TABLE quotes ADD COLUMN privacy_accepted_at TEXT')
        if 'privacy_notice_url' not in quote_columns:
            db.execute('ALTER TABLE quotes ADD COLUMN privacy_notice_url TEXT')
        count = db.execute("SELECT count(*) FROM products").fetchone()[0]
        if count == 0 and seed_demo:
            db.executemany("""INSERT INTO products
                (sku,name,description,category,kind,price_cents,emoji,featured,stock)
                VALUES (?,?,?,?,?,?,?,?,?)""", DEMO_ITEMS)
        db.commit()


@contextmanager
def transaction(path: str):
    with connect(path) as db:
        yield db
        db.commit()


def as_dict(row):
    return dict(row) if row else None


def log_event(db, actor: str, event: str, entity_type: str, entity_id: int | None):
    # Evitar guardar información identificable de clientes y secretos en auditoría.
    db.execute('INSERT INTO audit_events(actor,event,entity_type,entity_id) VALUES (?,?,?,?)',
               (actor, event, entity_type, entity_id))
