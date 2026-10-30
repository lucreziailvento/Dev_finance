"""Utility per i periodi (mese `YYYY-MM`), condivise da planning e ricorrenze."""

import calendar
from datetime import date


def parse_month(value):
    """Converte `YYYY-MM` in (anno, mese). Solleva ValueError se non valido."""
    if not value or len(value) != 7 or value[4] != '-':
        raise ValueError(f"Formato mese non valido: {value!r} (atteso YYYY-MM)")
    year, month = int(value[:4]), int(value[5:])
    if not 1 <= month <= 12:
        raise ValueError(f"Mese non valido: {value!r}")
    return year, month


def month_key(year, month):
    return f"{year:04d}-{month:02d}"


def month_bounds(value):
    """Ritorna (primo giorno, ultimo giorno, numero di giorni) del mese."""
    year, month = parse_month(value)
    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, 1), date(year, month, last_day), last_day


def add_months(value, delta):
    year, month = parse_month(value)
    total = (year * 12 + (month - 1)) + delta
    return month_key(total // 12, total % 12 + 1)


def parse_date(value):
    """Accetta `YYYY-MM-DD` (anche con orario) e ritorna `date` o None."""
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def days_between(first, second):
    return (second - first).days
