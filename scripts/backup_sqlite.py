"""Respaldo consistente SQLite sin detener aplicación; nunca guarda secretos del entorno.

Uso: python scripts/backup_sqlite.py --db ./data/apex.db --out ./backups
No crea directorios públicos ni borra backups; gestionar retención con autorización.
"""
import argparse
import os
import sqlite3
import time
from pathlib import Path


def backup_database(db_path: Path, directory: Path) -> Path:
    source = db_path.resolve()
    if not source.is_file():
        raise FileNotFoundError(f'No existe la base: {source}')
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(directory, 0o700)
    target = directory / f'apex-{time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())}-{os.getpid()}.db'
    try:
        with sqlite3.connect(f'file:{source}?mode=ro', uri=True) as live:
            # mode=ro ensures we do not accidentally initialize an empty source db.
            with sqlite3.connect(target) as snapshot:
                live.backup(snapshot, pages=100, sleep=0.1)
                check = snapshot.execute('PRAGMA integrity_check').fetchone()[0]
                if check != 'ok':
                    raise RuntimeError('Integridad SQLite falló: ' + check)
        os.chmod(target, 0o600)
    except Exception:
        target.unlink(missing_ok=True)
        raise
    return target


def main():
    parser = argparse.ArgumentParser(description='Backup y verificación SQLite APEX_PRIME_X')
    parser.add_argument('--db', default='./data/apex.db', type=Path)
    parser.add_argument('--out', default='./backups', type=Path)
    args = parser.parse_args()
    target = backup_database(args.db, args.out)
    print(f'Backup íntegro: {target}')


if __name__ == '__main__':
    main()
