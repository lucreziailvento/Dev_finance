#!/usr/bin/env python3
import os, sys
import sqlite3
import psycopg2

SQLITE_PATH = os.path.join(os.path.dirname(__file__), "portfolio_v2.db")
DATABASE_URL = os.environ.get("DATABASE_URL", "")

if not DATABASE_URL:
    print("ERROR: Set DATABASE_URL (e.g. postgresql://user:pass@neon.tech/db)")
    sys.exit(1)

sqlite_conn = sqlite3.connect(SQLITE_PATH)
sqlite_conn.row_factory = sqlite3.Row
pg_conn = psycopg2.connect(DATABASE_URL)
pg_c = pg_conn.cursor()

def migrate_table(name, columns, sqlite_query, pg_insert, conflict):
    c = sqlite_conn.cursor()
    c.execute(sqlite_query)
    rows = [dict(r) for r in c.fetchall()]
    if not rows:
        print(f"  {name}: vuoto, salto")
        return
    cols = ', '.join(columns)
    placeholders = ', '.join(['%s'] * len(columns))
    sql = f"INSERT INTO {name} ({cols}) VALUES ({placeholders}) {conflict}" if conflict else f"INSERT INTO {name} ({cols}) VALUES ({placeholders})"
    for r in rows:
        vals = tuple(r[c] for c in columns)
        pg_c.execute(sql, vals)
    pg_conn.commit()
    print(f"  {name}: {len(rows)} record migrati")

print("Migrazione dati SQLite → Neon\n")

migrate_table("transactions",
    ["date", "description", "amount", "source", "macro_category", "micro_category", "hash_id"],
    "SELECT * FROM transactions",
    None, "ON CONFLICT (hash_id) DO NOTHING")

migrate_table("manual_records",
    ["id", "date", "description", "amount", "macro_category", "micro_category"],
    "SELECT * FROM manual_records",
    None, "ON CONFLICT (id) DO NOTHING")

# Reset sequence per id massimo
pg_c.execute("SELECT setval('manual_records_id_seq', COALESCE((SELECT MAX(id) FROM manual_records), 1))")

migrate_table("daily_forecast",
    ["date", "planned_income", "planned_expenses", "notes"],
    "SELECT * FROM daily_forecast",
    None, "ON CONFLICT (date) DO UPDATE SET planned_income=excluded.planned_income, planned_expenses=excluded.planned_expenses, notes=excluded.notes")

migrate_table("budget_allocations",
    ["month", "micro_category", "planned_amount"],
    "SELECT * FROM budget_allocations",
    None, "ON CONFLICT (month, micro_category) DO UPDATE SET planned_amount=excluded.planned_amount")

sqlite_conn.close()
pg_conn.close()
print("\n✅ Migrazione completata!")
