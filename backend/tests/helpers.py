"""Helper condivisi dai test: scrittura di transazioni sintetiche."""

import backend.db as db
from backend.app_common import get_macro


def insert_transactions(rows):
    """Inserisce transazioni di test: tuple (date, description, amount, micro, source)."""
    with db.db_cursor(commit=True) as cursor:
        for index, (date, description, amount, micro, source) in enumerate(rows):
            db.execute(
                cursor,
                """
                INSERT INTO transactions
                    (date, description, amount, source, macro_category, micro_category, hash_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (date, description, amount, source, get_macro(micro), micro, f"test_{index}"),
            )
