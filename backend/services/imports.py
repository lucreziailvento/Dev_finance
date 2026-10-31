"""Gestione dei lotti di importazione.

Ogni upload registra un lotto con i soli `hash_id` **effettivamente aggiunti**:
in questo modo annullare un caricamento elimina solo le transazioni nate da
quel file, senza toccare i movimenti manuali né le righe già presenti.
"""

from datetime import datetime, timezone

from ..db import db_cursor, execute, insert_returning_id


def _now():
    return datetime.now(timezone.utc).isoformat(timespec='seconds')


def record_import(filename, source, hash_ids):
    """Registra un lotto e i suoi `hash_id`. Ritorna l'id o `None` se vuoto."""
    hashes = [value for value in dict.fromkeys(hash_ids or []) if value]
    if not hashes:
        return None

    with db_cursor(commit=True) as cursor:
        batch_id = insert_returning_id(
            cursor,
            "INSERT INTO import_batches (filename, source, records_added, created_at) "
            "VALUES (%s, %s, %s, %s)",
            (filename or '', source or '', len(hashes), _now()),
        )
        for hash_id in hashes:
            execute(
                cursor,
                "INSERT INTO import_batch_transactions (batch_id, hash_id) VALUES (%s, %s)",
                (batch_id, hash_id),
            )
    return batch_id


def list_imports():
    """Elenca i lotti, dal più recente, con le transazioni ancora presenti."""
    with db_cursor() as cursor:
        rows = execute(
            cursor,
            """
            SELECT b.id, b.filename, b.source, b.records_added, b.created_at,
                   COUNT(l.hash_id) AS transactions_remaining,
                   MIN(t.date) AS first_date, MAX(t.date) AS last_date
            FROM import_batches AS b
            LEFT JOIN import_batch_transactions AS l ON l.batch_id = b.id
            LEFT JOIN transactions AS t ON t.hash_id = l.hash_id
            GROUP BY b.id, b.filename, b.source, b.records_added, b.created_at
            ORDER BY b.id DESC
            """,
        ).fetchall()
    return [dict(row) for row in rows]


def delete_import(batch_id):
    """Elimina un lotto e le transazioni importate che gli appartengono.

    Ritorna `None` se il lotto non esiste, altrimenti il riepilogo.
    """
    with db_cursor(commit=True) as cursor:
        batch = execute(
            cursor,
            "SELECT id, filename, source, records_added, created_at "
            "FROM import_batches WHERE id = %s",
            (batch_id,),
        ).fetchone()
        if batch is None:
            return None

        linked = execute(
            cursor,
            "SELECT hash_id FROM import_batch_transactions WHERE batch_id = %s",
            (batch_id,),
        ).fetchall()
        # Difesa extra: un lotto non deve mai poter cancellare righe manuali.
        hashes = [
            row['hash_id']
            for row in linked
            if row['hash_id'] and not str(row['hash_id']).startswith('manual_')
        ]

        deleted = 0
        if hashes:
            placeholders = ', '.join(['%s'] * len(hashes))
            result = execute(
                cursor,
                f"DELETE FROM transactions WHERE hash_id IN ({placeholders})",
                hashes,
            )
            deleted = int(result.rowcount or 0)

        execute(cursor, "DELETE FROM import_batch_transactions WHERE batch_id = %s", (batch_id,))
        execute(cursor, "DELETE FROM import_batches WHERE id = %s", (batch_id,))

    return {
        "status": "success",
        "batch_id": batch_id,
        "filename": batch['filename'],
        "source": batch['source'],
        "deleted_transactions": deleted,
    }


def delete_transactions(source='', date_from='', date_to=''):
    """Elimina transazioni importate per fonte e/o intervallo di date.

    Rifiuta i filtri vuoti per evitare cancellazioni accidentali di tutto
    lo storico. Non tocca mai `manual_records`.
    """
    source = (source or '').strip()
    date_from = (date_from or '').strip()
    date_to = (date_to or '').strip()
    if not source and not date_from and not date_to:
        raise ValueError("Serve almeno una fonte o una data")

    where = ["1 = 1"]
    params = []
    if source:
        where.append("source = %s")
        params.append(source)
    if date_from:
        where.append("date >= %s")
        params.append(date_from)
    if date_to:
        where.append("date <= %s")
        params.append(date_to)
    clause = " AND ".join(where)

    with db_cursor(commit=True) as cursor:
        rows = execute(
            cursor,
            f"SELECT hash_id FROM transactions WHERE {clause}",
            params,
        ).fetchall()
        hashes = [row['hash_id'] for row in rows if row['hash_id']]

        deleted = 0
        if hashes:
            placeholders = ', '.join(['%s'] * len(hashes))
            result = execute(
                cursor,
                f"DELETE FROM transactions WHERE hash_id IN ({placeholders})",
                hashes,
            )
            deleted = int(result.rowcount or 0)
            # I collegamenti ai lotti restano coerenti anche per lotti vecchi.
            execute(
                cursor,
                f"DELETE FROM import_batch_transactions WHERE hash_id IN ({placeholders})",
                hashes,
            )

    return {"status": "success", "deleted_transactions": deleted}


def list_sources():
    """Fonti presenti nelle transazioni importate, con conteggi e periodo."""
    with db_cursor() as cursor:
        rows = execute(
            cursor,
            """
            SELECT source,
                   COUNT(*) AS transactions,
                   MIN(date) AS first_date,
                   MAX(date) AS last_date
            FROM transactions
            WHERE source IS NOT NULL AND source != ''
            GROUP BY source
            ORDER BY source
            """,
        ).fetchall()
    return [dict(row) for row in rows]
