"""Fixture condivise: ogni test lavora su una copia, mai sul DB reale."""

import shutil
from pathlib import Path

import pytest

import backend.db as db


@pytest.fixture()
def temp_db(tmp_path, monkeypatch):
    """Database vuoto con lo schema aggiornato, in una cartella temporanea."""
    target = tmp_path / "devfinance_test.db"
    monkeypatch.setattr(db, "DB_PATH", str(target))
    assert db.init_db()
    return target


@pytest.fixture()
def isolated_db(tmp_path, monkeypatch):
    """Copia del database locale, utile ai test che leggono dati reali."""
    source = Path(db.DB_PATH)
    if not source.exists():
        pytest.skip("database locale non disponibile")
    target = tmp_path / "portfolio_test.db"
    shutil.copy2(source, target)
    monkeypatch.setattr(db, "DB_PATH", str(target))
    return target
