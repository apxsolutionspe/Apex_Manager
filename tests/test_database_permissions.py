"""POSIX privacy regressions for newly created customer SQLite databases."""
import os
import sqlite3
import stat

import pytest

from backend.database import connect


@pytest.mark.skipif(os.name == 'nt', reason='POSIX file modes only')
def test_new_database_and_directory_are_private(tmp_path):
    path = tmp_path / 'new-private-dir' / 'customers.db'
    with connect(str(path)) as db:
        db.execute('CREATE TABLE example (value TEXT)')
        db.execute('INSERT INTO example (value) VALUES (?)', ('synthetic',))
    assert stat.S_IMODE(path.parent.stat().st_mode) == 0o700
    assert stat.S_IMODE(path.stat().st_mode) == 0o600
    with connect(str(path)) as db:
        assert db.execute('SELECT value FROM example').fetchone()[0] == 'synthetic'


@pytest.mark.skipif(os.name == 'nt', reason='POSIX file modes only')
def test_existing_database_and_parent_permissions_are_not_changed(tmp_path):
    directory = tmp_path / 'shared'
    directory.mkdir(mode=0o755)
    directory.chmod(0o755)
    path = directory / 'legacy.db'
    with sqlite3.connect(path) as db:
        db.execute('CREATE TABLE example (value TEXT)')
        db.execute('INSERT INTO example (value) VALUES (?)', ('preserved',))
    path.chmod(0o644)
    with connect(str(path)) as db:
        assert db.execute('SELECT value FROM example').fetchone()[0] == 'preserved'
    assert stat.S_IMODE(directory.stat().st_mode) == 0o755
    assert stat.S_IMODE(path.stat().st_mode) == 0o644


def test_in_memory_database_stays_in_memory(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    with connect(':memory:') as db:
        assert db.execute('SELECT 1').fetchone()[0] == 1
    assert not (tmp_path / ':memory:').exists()
