#!/usr/bin/env python3
"""Inicia APEX en localhost desde Windows, Linux o macOS sin ejecutar el .env.

Uso: python scripts/start_local.py [--check]
El modo --check no abre puertos ni modifica la base de datos.
"""
from __future__ import annotations

import importlib.util
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ALLOWED_KEYS = frozenset({
    'DB_PATH', 'DEMO_MODE', 'APP_ENV', 'PRIVACY_NOTICE_APPROVED',
    'PRIVACY_POLICY_URL', 'PRIVACY_NOTICE_VERSION', 'QUOTE_INTAKE_ENABLED',
    'ADMIN_PASSWORD_HASH', 'SESSION_SECRET', 'WHATSAPP_NUMBER', 'PORT',
})
KEY_PATTERN = re.compile(r'[A-Za-z_][A-Za-z0-9_]*\Z')


def parse_env_file(path: Path) -> dict[str, str]:
    """Lee valores literales; no evalúa comandos, variables ni expresiones."""
    values: dict[str, str] = {}
    for line_number, original in enumerate(path.read_text(encoding='utf-8-sig').splitlines(), 1):
        line = original.strip()
        if not line or line.startswith('#'):
            continue
        if line.startswith('export '):
            line = line[7:].lstrip()
        if '=' not in line:
            raise ValueError(f'Línea {line_number}: falta KEY=valor')
        key, value = line.split('=', 1)
        key, value = key.strip(), value.strip()
        if not KEY_PATTERN.fullmatch(key) or key not in ALLOWED_KEYS:
            raise ValueError(f'Línea {line_number}: variable desconocida o no permitida: {key!r}')
        if key in values:
            raise ValueError(f'Línea {line_number}: variable duplicada: {key}')
        if value.startswith(("'", '"')):
            quote = value[0]
            if len(value) < 2 or value[-1] != quote:
                raise ValueError(f'Línea {line_number}: comillas sin cerrar en {key}')
            value = value[1:-1]
        values[key] = value
    return values


def validate_local_settings(values: dict[str, str]) -> int:
    """Comprueba configuración básica; nunca muestra credenciales."""
    environment = values.get('APP_ENV', 'development').strip().lower()
    if environment != 'development':
        raise ValueError('Este lanzador es solo para APP_ENV=development; usa despliegue seguro para producción')
    if not values.get('ADMIN_PASSWORD_HASH', '').startswith('pbkdf2_sha256$'):
        raise ValueError('Configura ADMIN_PASSWORD_HASH con python scripts/hash_password.py')
    if len(values.get('SESSION_SECRET', '')) < 32:
        raise ValueError('Configura SESSION_SECRET con un valor aleatorio de al menos 32 caracteres')
    for key in ('DEMO_MODE', 'PRIVACY_NOTICE_APPROVED', 'QUOTE_INTAKE_ENABLED'):
        if key in values and values[key].lower() not in ('true', 'false'):
            raise ValueError(f'{key} debe ser true o false')
    raw_port = values.get('PORT', '8000')
    if not raw_port.isascii() or not raw_port.isdecimal():
        raise ValueError('PORT debe ser un número entre 1 y 65535')
    port = int(raw_port)
    if not 1 <= port <= 65535:
        raise ValueError('PORT debe ser un número entre 1 y 65535')
    return port


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    if args not in ([], ['--check']):
        print('Uso: python scripts/start_local.py [--check]', file=sys.stderr)
        return 2
    env_path = ROOT / '.env'
    if not env_path.is_file():
        print('Falta .env. Copia .env.example a .env y configura credenciales locales.', file=sys.stderr)
        return 2
    try:
        values = parse_env_file(env_path)
        port = validate_local_settings(values)
    except (OSError, UnicodeError, ValueError) as exc:
        print(f'Configuración local inválida: {exc}', file=sys.stderr)
        return 2
    if args == ['--check']:
        print('Configuración local básica válida. No se comprobó la base de datos ni la preparación para producción.')
        return 0
    if importlib.util.find_spec('uvicorn') is None:
        print('Falta Uvicorn. Ejecuta: python -m pip install -r requirements.txt', file=sys.stderr)
        return 2
    env = os.environ.copy()
    # No heredar accidentalmente valores APEX de otra sesión de PowerShell.
    defaults = {
        'DB_PATH': './data/apex.db', 'DEMO_MODE': 'true',
        'PRIVACY_NOTICE_APPROVED': 'false', 'PRIVACY_POLICY_URL': '',
        'PRIVACY_NOTICE_VERSION': '2026-10-draft-1',
        'QUOTE_INTAKE_ENABLED': 'false', 'WHATSAPP_NUMBER': '',
    }
    for key in ALLOWED_KEYS - {'PORT'}:
        env[key] = values.get(key, defaults.get(key, ''))
    env['APP_ENV'] = 'development'
    print(f'APEX local: http://127.0.0.1:{port}/  |  Admin: http://127.0.0.1:{port}/admin', flush=True)
    try:
        return subprocess.call(
            [sys.executable, '-m', 'uvicorn', 'backend.main:app', '--host', '127.0.0.1', '--port', str(port)],
            cwd=ROOT, env=env,
        )
    except KeyboardInterrupt:
        return 130


if __name__ == '__main__':
    raise SystemExit(main())
