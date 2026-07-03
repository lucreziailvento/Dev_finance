import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "portfolio_v2.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            hash_id TEXT PRIMARY KEY,
            date TEXT NOT NULL,
            description TEXT,
            amount REAL NOT NULL,
            source TEXT NOT NULL,
            macro_category TEXT NOT NULL,
            micro_category TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()

def salva_transazioni(df):
    if df.empty:
        return 0
    conn = sqlite3.connect(DB_PATH)
    # Rimuoviamo i duplicati identici a livello di DataFrame prima di scrivere su DB
    df_clean = df.drop_duplicates(subset=['hash_id'])
    df_clean.to_sql("transactions", conn, if_exists="append", index=False)
    conn.close()
    return len(df_clean)