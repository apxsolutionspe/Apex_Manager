"""Offline backup verification with synthetic data; never touches a real APEX DB."""

import sqlite3
import stat

import pytest

from scripts.backup_sqlite import create_backup, verify_backup


def make_db(path, *, orphan=False):
    with sqlite3.connect(path) as db:
        db.executescript("""
            CREATE TABLE products (id INTEGER PRIMARY KEY, sku TEXT);
            CREATE TABLE quotes (id INTEGER PRIMARY KEY, code TEXT);
            CREATE TABLE service_jobs (
                id INTEGER PRIMARY KEY,
                quote_id INTEGER REFERENCES quotes(id)
            );
            CREATE TABLE admin_audit (id INTEGER PRIMARY KEY);
        """)
        db.execute("INSERT INTO quotes (id, code) VALUES (1, 'COT-SYNTHETIC')")
        db.execute("INSERT INTO service_jobs (quote_id) VALUES (?)", (999 if orphan else 1,))


def test_backup_verifies_wal_snapshot_and_keeps_private_permissions(tmp_path):
    source = tmp_path / "live.sqlite3"
    make_db(source)
    with sqlite3.connect(source) as db:
        db.execute("PRAGMA journal_mode=WAL")
        db.execute("INSERT INTO products (sku) VALUES ('SYNTH-001')")
    backup, report = create_backup(source, tmp_path / "private")
    assert report["valid"] is True
    assert report["counts"]["products"] == 1
    assert report["counts"]["service_jobs"] == 1
    assert verify_backup(backup)["counts"] == report["counts"]
    assert not list(backup.parent.glob(".apex-backup-*.tmp"))
    assert stat.S_IMODE(backup.stat().st_mode) == 0o600
    assert stat.S_IMODE(backup.parent.stat().st_mode) == 0o700


def test_verify_rejects_orphan_foreign_keys_even_when_integrity_check_is_ok(tmp_path):
    source = tmp_path / "orphan.sqlite3"
    make_db(source, orphan=True)
    with sqlite3.connect(source) as db:
        assert db.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
        assert db.execute("PRAGMA foreign_key_check").fetchall()
    with pytest.raises(ValueError, match="foreign_key_check"):
        verify_backup(source)


def test_failed_backup_never_publishes_corrupt_snapshot(tmp_path):
    source = tmp_path / "orphan.sqlite3"
    make_db(source, orphan=True)
    directory = tmp_path / "private"
    with pytest.raises(ValueError, match="foreign_key_check"):
        create_backup(source, directory)
    assert list(directory.iterdir()) == []
    with sqlite3.connect(source) as db:
        assert db.execute("SELECT quote_id FROM service_jobs").fetchone()[0] == 999


def test_verify_rejects_missing_required_tables(tmp_path):
    source = tmp_path / "incomplete.sqlite3"
    with sqlite3.connect(source) as db:
        db.execute("CREATE TABLE products (id INTEGER PRIMARY KEY)")
    with pytest.raises(ValueError, match="faltantes"):
        verify_backup(source)


def test_backup_rejects_existing_shared_directory_without_chmod(tmp_path):
    """A backup must never chmod an existing shared directory like /tmp."""
    source = tmp_path / "source.sqlite3"
    make_db(source)
    shared = tmp_path / "shared"
    shared.mkdir()
    shared.chmod(0o755)

    with pytest.raises(PermissionError, match="permisos inseguros"):
        create_backup(source, shared)

    assert stat.S_IMODE(shared.stat().st_mode) == 0o755
    assert list(shared.iterdir()) == []


def test_backup_accepts_existing_private_directory_without_changing_mode(tmp_path):
    source = tmp_path / "source.sqlite3"
    make_db(source)
    private = tmp_path / "private"
    private.mkdir()
    private.chmod(0o700)

    backup, report = create_backup(source, private)

    assert report["valid"] is True
    assert backup.parent == private
    assert stat.S_IMODE(private.stat().st_mode) == 0o700
    assert stat.S_IMODE(backup.stat().st_mode) == 0o600


def test_backup_new_private_directory_does_not_chmod_parent(tmp_path):
    source = tmp_path / "source.sqlite3"
    make_db(source)
    parent = tmp_path / "shared-parent"
    parent.mkdir()
    parent.chmod(0o755)

    backup, report = create_backup(source, parent / "private-backups")

    assert report["valid"] is True
    assert backup.is_file()
    assert stat.S_IMODE(parent.stat().st_mode) == 0o755
    assert stat.S_IMODE(backup.parent.stat().st_mode) == 0o700
