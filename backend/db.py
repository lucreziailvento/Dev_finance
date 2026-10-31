"""Accesso al database.

Supporta due backend senza duplicare il codice dei router:
- SQLite locale (`backend/portfolio_v2.db`) quando `DATABASE_URL` non è impostata
- PostgreSQL/Neon quando `DATABASE_URL` è impostata (es. su Vercel)

Regole:
- ogni operazione passa da `db_cursor()`, che garantisce commit/rollback e chiusura;
- i valori numerici vanno normalizzati con `services.finance.round2`/`to_float`
  perché Postgres restituisce `Decimal` e SQLite `float`.
"""

import os
import sqlite3
from contextlib import contextmanager

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor

    HAS_PSYCOPG2 = True
except ImportError:  # pragma: no cover - dipende dall'ambiente
    HAS_PSYCOPG2 = False

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# `DEVFINANCE_DB_PATH` permette di lavorare su una copia (test, backup, demo)
# senza toccare il database reale.
DB_PATH = os.environ.get("DEVFINANCE_DB_PATH") or os.path.join(BASE_DIR, "portfolio_v2.db")
DATABASE_URL = os.environ.get("DATABASE_URL", "")
USE_PG = HAS_PSYCOPG2 and bool(DATABASE_URL)

# Vista logica unica su cui leggono tutti i router.
# `CAST(id AS TEXT)` funziona sia su SQLite sia su PostgreSQL.
ALL_TRANSACTIONS = """(
    SELECT date, description, amount, source, macro_category, micro_category, hash_id
    FROM transactions
    UNION ALL
    SELECT date, description, amount, 'Manuale' AS source, macro_category, micro_category,
           'manual_' || CAST(id AS TEXT) AS hash_id
    FROM manual_records
)"""


def fix_sql(sql):
    """I router scrivono SQL in stile Postgres (`%s`); SQLite vuole `?`."""
    if not USE_PG:
        sql = sql.replace('%s', '?')
    return sql


def execute(cursor, sql, params=None):
    """Esegue e **restituisce il cursore**.

    `psycopg2.cursor.execute()` restituisce `None`, mentre `sqlite3` restituisce
    il cursore: senza questo `return` i router funzionano in locale ma falliscono
    su PostgreSQL con `'NoneType' object has no attribute 'fetchall'`.
    """
    cursor.execute(fix_sql(sql), tuple(params or ()))
    return cursor


def _new_connection():
    if USE_PG:
        conn = psycopg2.connect(DATABASE_URL)
        return conn, conn.cursor(cursor_factory=RealDictCursor)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn, conn.cursor()


@contextmanager
def db_cursor(commit=False):
    """Connessione usa-e-getta.

    - `commit=True` per le scritture;
    - rollback automatico se il blocco solleva un'eccezione;
    - la connessione viene sempre chiusa, anche in caso di errore.
    """
    conn, cursor = _new_connection()
    try:
        yield cursor
        if commit:
            conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


def fetch_all(sql, params=None):
    with db_cursor() as cursor:
        return [dict(row) for row in execute(cursor, sql, params).fetchall()]


def fetch_one(sql, params=None):
    rows = fetch_all(sql, params)
    return rows[0] if rows else None


def write(sql, params=None):
    """Esegue una singola scrittura e ritorna `rowcount`."""
    with db_cursor(commit=True) as cursor:
        result = execute(cursor, sql, params)
        return result.rowcount


def insert_on_conflict(table, columns, values, conflict_col):
    cols = ', '.join(columns)
    placeholders = ', '.join(['%s'] * len(columns))
    if USE_PG:
        return f"INSERT INTO {table} ({cols}) VALUES ({placeholders}) ON CONFLICT ({conflict_col}) DO NOTHING"
    return f"INSERT OR IGNORE INTO {table} ({cols}) VALUES ({placeholders})"


def insert_returning_id(cursor, sql, params=None):
    """Esegue un INSERT e restituisce l'id generato, su entrambi i backend.

    PostgreSQL usa `RETURNING id`, SQLite espone `lastrowid` sul cursore.
    """
    if USE_PG:
        statement = sql.rstrip().rstrip(';')
        if 'RETURNING' not in statement.upper():
            statement = f"{statement} RETURNING id"
        row = execute(cursor, statement, params).fetchone()
        if row is None:
            return None
        return row['id'] if isinstance(row, dict) else row[0]
    execute(cursor, sql, params)
    return cursor.lastrowid


def init_db():
    """Crea tabelle e indici se mancano. Non distrugge né migra dati esistenti."""
    ddl_pg = """
        CREATE TABLE IF NOT EXISTS transactions (
            date TEXT, description TEXT, amount NUMERIC, source TEXT,
            macro_category TEXT, micro_category TEXT, hash_id TEXT PRIMARY KEY
        );
        CREATE TABLE IF NOT EXISTS manual_records (
            id SERIAL PRIMARY KEY,
            date TEXT, description TEXT, amount NUMERIC,
            macro_category TEXT, micro_category TEXT
        );
        CREATE TABLE IF NOT EXISTS daily_forecast (
            id SERIAL PRIMARY KEY,
            date TEXT NOT NULL UNIQUE,
            planned_income NUMERIC DEFAULT 0,
            planned_expenses NUMERIC DEFAULT 0,
            notes TEXT DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS budget_allocations (
            month TEXT NOT NULL,
            micro_category TEXT NOT NULL,
            planned_amount NUMERIC DEFAULT 0,
            PRIMARY KEY (month, micro_category)
        );
        CREATE TABLE IF NOT EXISTS category_rules (
            id SERIAL PRIMARY KEY,
            pattern TEXT NOT NULL,
            micro_category TEXT NOT NULL,
            source TEXT NOT NULL DEFAULT '',
            created_at TEXT,
            UNIQUE (pattern, source)
        );
        CREATE TABLE IF NOT EXISTS import_batches (
            id SERIAL PRIMARY KEY,
            filename TEXT NOT NULL DEFAULT '',
            source TEXT NOT NULL DEFAULT '',
            records_added INTEGER DEFAULT 0,
            created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS import_batch_transactions (
            batch_id INTEGER NOT NULL,
            hash_id TEXT NOT NULL,
            PRIMARY KEY (batch_id, hash_id)
        );
        CREATE INDEX IF NOT EXISTS idx_batch_transactions_hash ON import_batch_transactions (hash_id);
        CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions (date);
        CREATE INDEX IF NOT EXISTS idx_transactions_macro ON transactions (macro_category);
        CREATE INDEX IF NOT EXISTS idx_transactions_source ON transactions (source);
        CREATE INDEX IF NOT EXISTS idx_manual_records_date ON manual_records (date);
        CREATE INDEX IF NOT EXISTS idx_daily_forecast_date ON daily_forecast (date);
    """
    ddl_sqlite = """
        CREATE TABLE IF NOT EXISTS transactions (
            date TEXT, description TEXT, amount REAL, source TEXT,
            macro_category TEXT, micro_category TEXT, hash_id TEXT PRIMARY KEY
        );
        CREATE TABLE IF NOT EXISTS manual_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT, description TEXT, amount REAL,
            macro_category TEXT, micro_category TEXT
        );
        CREATE TABLE IF NOT EXISTS daily_forecast (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL UNIQUE,
            planned_income REAL DEFAULT 0,
            planned_expenses REAL DEFAULT 0,
            notes TEXT DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS budget_allocations (
            month TEXT NOT NULL,
            micro_category TEXT NOT NULL,
            planned_amount REAL DEFAULT 0,
            PRIMARY KEY (month, micro_category)
        );
        CREATE TABLE IF NOT EXISTS category_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pattern TEXT NOT NULL,
            micro_category TEXT NOT NULL,
            source TEXT NOT NULL DEFAULT '',
            created_at TEXT,
            UNIQUE (pattern, source)
        );
        CREATE TABLE IF NOT EXISTS import_batches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL DEFAULT '',
            source TEXT NOT NULL DEFAULT '',
            records_added INTEGER DEFAULT 0,
            created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS import_batch_transactions (
            batch_id INTEGER NOT NULL,
            hash_id TEXT NOT NULL,
            PRIMARY KEY (batch_id, hash_id)
        );
        CREATE INDEX IF NOT EXISTS idx_batch_transactions_hash ON import_batch_transactions (hash_id);
        CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions (date);
        CREATE INDEX IF NOT EXISTS idx_transactions_macro ON transactions (macro_category);
        CREATE INDEX IF NOT EXISTS idx_transactions_source ON transactions (source);
        CREATE INDEX IF NOT EXISTS idx_manual_records_date ON manual_records (date);
        CREATE INDEX IF NOT EXISTS idx_daily_forecast_date ON daily_forecast (date);
    """
    ddl = ddl_pg if USE_PG else ddl_sqlite
    errors = []
    try:
        conn, cursor = _new_connection()
        for statement in ddl.split(';'):
            statement = statement.strip()
            if not statement:
                continue
            try:
                cursor.execute(fix_sql(statement + ';'))
                conn.commit()
            except Exception as exc:  # pragma: no cover - dipende dal database
                conn.rollback()
                message = str(exc).lower()
                # Su Vercel più istanze partono insieme: la seconda trova
                # tabelle e sequenze già create. Non è un errore.
                if 'already exists' not in message and 'duplicate key' not in message:
                    errors.append(str(exc))
        cursor.close()
        conn.close()
        if errors:
            print("init_db error: " + "; ".join(errors))
            return False
        return True
    except Exception as exc:  # pragma: no cover - visibile nei log di avvio
        print(f"init_db error: {exc}")
        return False
