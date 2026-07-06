import os
import sqlite3

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    HAS_PSYCOPG2 = True
except ImportError:
    HAS_PSYCOPG2 = False

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "portfolio_v2.db")
DATABASE_URL = os.environ.get("DATABASE_URL", "")
USE_PG = HAS_PSYCOPG2 and bool(DATABASE_URL)

def get_conn_and_cursor():
    if USE_PG:
        conn = psycopg2.connect(DATABASE_URL)
        return conn, conn.cursor(cursor_factory=RealDictCursor)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn, conn.cursor()

def commit_and_close(conn):
    conn.commit()
    conn.close()

def rollback_and_close(conn):
    conn.rollback()
    conn.close()

def fix_sql(sql):
    if not USE_PG:
        sql = sql.replace('%s', '?')
    return sql

def execute(c, sql, params=None):
    return c.execute(fix_sql(sql), params or [])

def init_db():
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
    """
    try:
        ddl = ddl_pg if USE_PG else ddl_sqlite
        conn = psycopg2.connect(DATABASE_URL) if USE_PG else sqlite3.connect(DB_PATH)
        c = conn.cursor()
        for stmt in ddl.split(';'):
            s = stmt.strip()
            if s:
                c.execute(s + ';' if USE_PG else fix_sql(s + ';'))
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"init_db error: {e}")
        return False

def insert_on_conflict(table, columns, values, conflict_col):
    cols = ', '.join(columns)
    placeholders = ', '.join(['%s'] * len(columns))
    if USE_PG:
        return f"INSERT INTO {table} ({cols}) VALUES ({placeholders}) ON CONFLICT ({conflict_col}) DO NOTHING"
    return f"INSERT OR IGNORE INTO {table} ({cols}) VALUES ({placeholders})"
