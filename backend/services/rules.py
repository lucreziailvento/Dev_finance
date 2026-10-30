"""Regole di categorizzazione apprese dalle correzioni dell'utente.

Una regola è un frammento di descrizione (`pattern`) che, se presente nel testo
di una transazione importata, forza una sottocategoria. Le regole vengono
applicate durante l'import e, su richiesta, alle transazioni già esistenti.
"""

import re
import unicodedata
from datetime import datetime, timezone

from ..app_common import get_macro
from ..db import db_cursor, execute

MIN_PATTERN_LENGTH = 3


def normalize_pattern(text):
    value = unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode().lower()
    # I numeri sono riferimenti di operazione: non aiutano a riconoscere l'esercente.
    value = re.sub(r"\d+", " ", value)
    value = re.sub(r"[^a-z &.'-]+", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value.strip(" .'-")


def get_rules():
    """Regole attive, dalla più specifica alla più generica."""
    with db_cursor() as cursor:
        rows = execute(
            cursor,
            "SELECT id, pattern, micro_category, source, created_at "
            "FROM category_rules ORDER BY LENGTH(pattern) DESC, id ASC",
        ).fetchall()
    return [dict(row) for row in rows]


def match_rule(description, source, rules):
    text = (description or "").lower()
    for rule in rules:
        if rule["pattern"] in text and (not rule["source"] or rule["source"] == source):
            return rule
    return None


def list_rules():
    rules = get_rules()
    with db_cursor() as cursor:
        for rule in rules:
            row = execute(
                cursor,
                "SELECT COUNT(*) AS cnt FROM transactions "
                "WHERE LOWER(description) LIKE %s AND (%s = '' OR source = %s)",
                (f"%{rule['pattern']}%", rule["source"], rule["source"]),
            ).fetchone()
            rule["matches"] = int(row["cnt"] or 0)
            rule["macro_category"] = get_macro(rule["micro_category"])
    return rules


def upsert_rule(pattern, micro_category, source="", apply_existing=False):
    pattern = normalize_pattern(pattern)
    if len(pattern) < MIN_PATTERN_LENGTH:
        raise ValueError(
            f"Pattern troppo corto: servono almeno {MIN_PATTERN_LENGTH} caratteri significativi"
        )

    macro = get_macro(micro_category)
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")

    with db_cursor(commit=True) as cursor:
        execute(
            cursor,
            """
            INSERT INTO category_rules (pattern, micro_category, source, created_at)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (pattern, source) DO UPDATE SET
                micro_category = excluded.micro_category
            """,
            (pattern, micro_category, source or "", now),
        )
        updated = 0
        if apply_existing:
            result = execute(
                cursor,
                """
                UPDATE transactions
                SET micro_category = %s, macro_category = %s
                WHERE LOWER(description) LIKE %s AND (%s = '' OR source = %s)
                """,
                (micro_category, macro, f"%{pattern}%", source or "", source or ""),
            )
            updated = result.rowcount or 0

    return {
        "status": "success",
        "pattern": pattern,
        "micro_category": micro_category,
        "macro_category": macro,
        "updated_transactions": updated,
    }


def delete_rule(rule_id):
    with db_cursor(commit=True) as cursor:
        result = execute(cursor, "DELETE FROM category_rules WHERE id = %s", (rule_id,))
        return result.rowcount or 0


def rule_from_transaction(hash_id, micro_category=None, apply_existing=False):
    """Crea una regola a partire da una transazione già categorizzata."""
    with db_cursor() as cursor:
        row = execute(
            cursor,
            "SELECT description, micro_category, source FROM transactions WHERE hash_id = %s",
            (hash_id,),
        ).fetchone()

    if row is None:
        return None

    pattern = normalize_pattern(row["description"])
    category = micro_category or row["micro_category"]
    result = upsert_rule(pattern, category, source="", apply_existing=apply_existing)
    result["origin_description"] = row["description"]
    return result
