#!/usr/bin/env python3
"""Backup SQLite consistente con verificación y restauración en memoria.

No altera la base original. Retención de copias es decisión del operador.
"""
import argparse
import json
import os
import secrets
import sqlite3
import tempfile
from datetime import datetime, timezone
from pathlib import Path

REQUIRED_TABLES = {'products', 'quotes', 'service_jobs', 'admin_audit'}


def verify_backup(path: str | Path) -> dict:
    path = Path(path)
    if not path.is_file():
        raise FileNotFoundError(f'No existe el archivo {path}')
    # Abre en modo solo lectura sin posibilidad de crear o escribir.
    source = sqlite3.connect(path.resolve().as_uri() + '?mode=ro', uri=True)
    try:
        restored = sqlite3.connect(':memory:')
        try:
            source.backup(restored)
            integrity = restored.execute('PRAGMA integrity_check').fetchone()[0]
            tables = {row[0] for row in restored.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            if integrity != 'ok' or not REQUIRED_TABLES.issubset(tables):
                raise ValueError(f'Backup inválido: integridad={integrity}, faltantes={sorted(REQUIRED_TABLES - tables)}')
            counts = {table: restored.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0] for table in REQUIRED_TABLES}
            return {'valid': True, 'integrity': integrity, 'counts': counts, 'bytes': path.stat().st_size}
        finally:
            restored.close()
    finally:
        source.close()


def create_backup(db_path: str | Path, output_dir: str | Path) -> tuple[Path, dict]:
    db_path = Path(db_path).resolve()
    if not db_path.is_file():
        raise FileNotFoundError(f'No existe la base de datos: {db_path}. No se crea una vacía.')
    output_dir = Path(output_dir).resolve()
    output_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(output_dir, 0o700)
    backup_name = 'apex-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ') + '-' + secrets.token_hex(4) + '.sqlite3'
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(prefix='.apex-backup-', suffix='.tmp', dir=output_dir, delete=False) as handle:
            temporary = Path(handle.name)
        os.chmod(temporary, 0o600)
        source = sqlite3.connect(db_path.resolve().as_uri() + '?mode=ro', uri=True)
        try:
            destination = sqlite3.connect(temporary)
            try:
                source.backup(destination)
            finally:
                destination.close()
        finally:
            source.close()
        report = verify_backup(temporary)
        target = output_dir / backup_name
        # link es atómico y falla si la ruta ya existe: nunca sobrescribir otra copia.
        os.link(temporary, target)
        os.chmod(target, 0o600)
        return target, report
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description='Crear o verificar copias SQLite de APEX_PRIME_X sin alterar el origen')
    parser.add_argument('operation', choices=['create', 'verify'])
    parser.add_argument('--db', default=os.getenv('DB_PATH', './data/apex.db'))
    parser.add_argument('--directory', default='./backups')
    parser.add_argument('--file')
    args = parser.parse_args()
    if args.operation == 'verify':
        if not args.file:
            parser.error('verify necesita --file RUTA')
        print(json.dumps(verify_backup(args.file), ensure_ascii=False))
    else:
        filename, report = create_backup(args.db, args.directory)
        print(json.dumps({'file': str(filename), **report}, ensure_ascii=False))


if __name__ == '__main__':
    main()
