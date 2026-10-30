#!/usr/bin/env python3
"""Backup del database prima di un refactoring o di una migrazione.

Uso:
    python3 -m backend.scripts.backup_db

- SQLite locale: copia il file `.db` + dump SQL leggibile.
- PostgreSQL/Neon: usa `pg_dump` (deve essere nel PATH).

I backup finiscono in `backups/<timestamp>/` (ignorata da git).
"""

import os
import shutil
import sqlite3
import subprocess
import sys
from datetime import datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT))

from backend.db import DATABASE_URL, DB_PATH, USE_PG  # noqa: E402

DEST_ROOT = REPO_ROOT / "backups"


def _dest() -> Path:
    dest = DEST_ROOT / datetime.now().strftime("%Y%m%d-%H%M%S")
    dest.mkdir(parents=True, exist_ok=True)
    return dest


def backup_sqlite(dest: Path) -> Path:
    source = Path(DB_PATH)
    if not source.exists():
        raise SystemExit(f"Database non trovato: {source}")

    target = dest / source.name
    shutil.copy2(source, target)

    dump = dest / (source.stem + ".sql")
    with sqlite3.connect(source) as conn, open(dump, "w", encoding="utf-8") as handle:
        for line in conn.iterdump():
            handle.write(line + "\n")

    return target


def backup_postgres(dest: Path) -> Path:
    if not shutil.which("pg_dump"):
        raise SystemExit(
            "pg_dump non trovato. Installalo (brew install postgresql) oppure "
            "esporta il backup dal pannello Neon."
        )
    target = dest / "neon.sql"
    with open(target, "wb") as handle:
        subprocess.run(["pg_dump", DATABASE_URL], stdout=handle, check=True)
    return target


def backup() -> Path:
    dest = _dest()
    if USE_PG:
        path = backup_postgres(dest)
        print(f"Backup PostgreSQL completato: {path}")
    else:
        path = backup_sqlite(dest)
        print(f"Backup SQLite completato: {path}")
        print(f"Dump SQL leggibile: {dest / (Path(path).stem + '.sql')}")
    return path


if __name__ == "__main__":
    backup()
