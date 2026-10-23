"""Regression tests for SQLite handle lifecycle and transaction integrity.

Uses only synthetic rows in temporary databases; no production data or services.
"""

import sqlite3
from contextlib import closing

import pytest

from backend.database import connect, transaction


def test_connection_commits_and_closes_after_success(tmp_path):
    path = str(tmp_path / "nested" / "apex.sqlite3")
    with connect(path) as db:
        db.execute("CREATE TABLE events (id INTEGER PRIMARY KEY, name TEXT)")
        db.execute("INSERT INTO events (name) VALUES ('ok')")
        assert db.execute("PRAGMA foreign_keys").fetchone()[0] == 1
    with pytest.raises(sqlite3.ProgrammingError, match="closed database"):
        db.execute("SELECT 1")
    with closing(sqlite3.connect(path)) as check:
        assert check.execute("SELECT name FROM events").fetchone()[0] == "ok"


def test_connection_rolls_back_and_closes_after_failure(tmp_path):
    path = str(tmp_path / "rollback.sqlite3")
    with connect(path) as db:
        db.execute("CREATE TABLE events (name TEXT)")
    with pytest.raises(RuntimeError, match="synthetic failure"):
        with connect(path) as db:
            db.execute("INSERT INTO events VALUES ('not committed')")
            raise RuntimeError("synthetic failure")
    with pytest.raises(sqlite3.ProgrammingError, match="closed database"):
        db.execute("SELECT 1")
    with closing(sqlite3.connect(path)) as check:
        assert check.execute("SELECT count(*) FROM events").fetchone()[0] == 0


def test_transaction_helper_commits_and_closes(tmp_path):
    path = str(tmp_path / "transaction.sqlite3")
    with transaction(path) as db:
        db.execute("CREATE TABLE events (name TEXT)")
        db.execute("INSERT INTO events VALUES ('committed')")
    with pytest.raises(sqlite3.ProgrammingError, match="closed database"):
        db.execute("SELECT 1")
    with closing(sqlite3.connect(path)) as check:
        assert check.execute("SELECT name FROM events").fetchone()[0] == "committed"


def test_transaction_helper_rolls_back_and_closes(tmp_path):
    path = str(tmp_path / "failed-transaction.sqlite3")
    with transaction(path) as db:
        db.execute("CREATE TABLE events (name TEXT)")
    with pytest.raises(ValueError, match="abort"):
        with transaction(path) as db:
            db.execute("INSERT INTO events VALUES ('should rollback')")
            raise ValueError("abort")
    with pytest.raises(sqlite3.ProgrammingError, match="closed database"):
        db.execute("SELECT 1")
    with closing(sqlite3.connect(path)) as check:
        assert check.execute("SELECT COUNT(*) FROM events").fetchone()[0] == 0
