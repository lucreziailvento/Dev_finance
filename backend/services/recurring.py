"""Rilevamento automatico di entrate/spese ricorrenti.

Un esercente è considerato ricorrente quando:

- compare in almeno 3 mesi diversi con un importo simile;
- ha pochi movimenti per mese (max ~2), così la spesa quotidiana non entra;
- le occorrenze sono distanziate di ~30 giorni.

L'importo tipico è calcolato sulle occorrenze che si somigliano, non sulla
somma del mese: così un acquisto una tantum non nasconde l'abbonamento.
Non scrive nulla sul database: è una lettura.
"""

import calendar
import re
import unicodedata
from collections import Counter, defaultdict
from datetime import date, timedelta
from statistics import mean, median, pstdev

from .periods import month_bounds, parse_date

NOISE_PREFIXES = (
    "pagamento ",
    "addebito ",
    "acquisto ",
    "pos ",
    "carta ",
    "bonifico ",
    "sdd ",
    "sepa ",
    "pagamento da ",
    "prelievo ",
)

# Descrizioni troppo generiche per diventare una regola affidabile.
GENERIC_KEYS = {
    "", "pagamento", "addebito", "acquisto", "prelievo", "bonifico",
    "carta", "pos", "unknown", "n a", "visa debit", "pagamento visa debit",
    "italia", "estero",
}

DEFAULT_WINDOW_DAYS = 400
DEFAULT_MIN_MONTHS = 3
MAX_AVG_PER_MONTH = 2.2
MIN_INTERVAL_DAYS = 24
MAX_INTERVAL_DAYS = 37
# Quanto può essere vecchia l'ultima occorrenza perché la si consideri attiva.
ACTIVE_STALE_DAYS = 200
# Due importi sono "lo stesso abbonamento" entro questa tolleranza.
AMOUNT_TOLERANCE = 0.20
AMOUNT_TOLERANCE_MIN = 0.5


def normalize_description(text):
    """Riduce una descrizione alla parte identificativa dell'esercente."""
    value = text or ""
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    value = value.lower()
    value = re.sub(r"\d+", " ", value)
    value = re.sub(r"[^a-z& ]+", " ", value)
    value = re.sub(r"\s+", " ", value).strip()

    changed = True
    while changed:
        changed = False
        for prefix in NOISE_PREFIXES:
            if value.startswith(prefix):
                value = value[len(prefix):].strip()
                changed = True
    return value


def _coefficient_of_variation(values):
    if len(values) < 2:
        return 0.0
    average = abs(mean(values))
    if average == 0:
        return 1.0
    return pstdev(values) / average


def _confidence(months_count, variation, interval):
    score = 45 + min(months_count, 12) * 4
    score -= min(variation, 1) * 45
    score -= min(abs(interval - 30), 10)
    return int(max(0, min(100, round(score))))


def _same_amount(value, reference):
    tolerance = max(abs(reference) * AMOUNT_TOLERANCE, AMOUNT_TOLERANCE_MIN)
    return abs(value - reference) <= tolerance


def _best_amount(movements):
    """Sceglie l'importo che ricorre nel maggior numero di mesi diversi.

    Per ogni importo candidato contiamo in quanti mesi esiste un movimento
    simile; a parità vince il più frequente e, poi, il più recente.
    """
    by_month = defaultdict(list)
    for movement_date, amount, row in movements:
        by_month[movement_date.strftime("%Y-%m")].append((movement_date, amount, row))

    candidates = sorted({round(amount, 2) for _, amount, _ in movements})
    best = None
    for candidate in candidates:
        matched = []
        for month, entries in by_month.items():
            close = [entry for entry in entries if _same_amount(entry[1], candidate)]
            if close:
                # L'occorrenza più vicina all'importo candidato.
                matched.append(min(close, key=lambda entry: abs(entry[1] - candidate)))
        if not matched:
            continue
        count = len(matched)
        recency = max(entry[0] for entry in matched)
        key = (count, recency, -abs(candidate))
        if best is None or key > best[0]:
            best = (key, candidate, matched)

    if best is None:
        return None
    return best[1], best[2]


def _month_date(year, month, day):
    """Giorno `day` del mese, senza uscire dal mese (es. 31 → 30)."""
    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, min(day, last_day))


def _next_occurrence(billing_day, today):
    candidate = _month_date(today.year, today.month, billing_day)
    if candidate < today:
        year, month = (today.year + 1, 1) if today.month == 12 else (today.year, today.month + 1)
        candidate = _month_date(year, month, billing_day)
    return candidate


def detect_recurring(rows, today=None, window_days=DEFAULT_WINDOW_DAYS,
                     min_months=DEFAULT_MIN_MONTHS, max_variation=0.35):
    """Ritorna i movimenti ricorrenti, ordinati per prossima scadenza."""
    today = today or date.today()
    start = today - timedelta(days=window_days)

    grouped = defaultdict(list)
    for row in rows:
        if row.get("macro_category") == "Trasferimento Interno":
            continue
        key = normalize_description(row.get("description"))
        if key in GENERIC_KEYS or len(key) < 4:
            continue
        amount = float(row.get("amount") or 0)
        if amount == 0:
            continue
        movement_date = parse_date(row.get("date"))
        if movement_date is None or movement_date < start or movement_date > today:
            continue
        grouped[key].append((movement_date, amount, row))

    items = []
    for key, movements in grouped.items():
        by_month = defaultdict(list)
        for movement_date, amount, row in movements:
            by_month[movement_date.strftime("%Y-%m")].append((movement_date, amount, row))

        if len(by_month) < min_months:
            continue
        if len(movements) / len(by_month) > MAX_AVG_PER_MONTH:
            continue

        best = _best_amount(movements)
        if best is None:
            continue
        typical_amount, matched = best
        if len(matched) < min_months:
            continue

        matched.sort(key=lambda entry: entry[0])
        dates = [entry[0] for entry in matched]
        gaps = [
            (current - previous).days
            for previous, current in zip(dates, dates[1:])
            if (current - previous).days > 0
        ]
        if not gaps:
            continue
        interval = median(gaps)
        if not MIN_INTERVAL_DAYS <= interval <= MAX_INTERVAL_DAYS:
            continue

        amounts = [entry[1] for entry in matched]
        variation = _coefficient_of_variation(amounts)
        if variation > max_variation:
            continue

        typical_amount = round(median(amounts), 2)
        last_date = max(entry[0] for entry in movements)
        # Il giorno tipico di addebito rende la proiezione stabile:
        # sommare 30 giorni alla volta accumulerebbe deriva.
        billing_day = int(median([moment.day for moment in dates]))
        next_expected = _next_occurrence(billing_day, today)

        descriptions = Counter(row.get("description") for _, _, row in movements)
        categories = Counter(row.get("micro_category") for _, _, row in movements)
        sources = Counter(row.get("source") for _, _, row in movements)
        stale_days = (today - last_date).days

        items.append({
            "key": key,
            "name": descriptions.most_common(1)[0][0],
            "category": categories.most_common(1)[0][0],
            "source": sources.most_common(1)[0][0],
            "kind": "income" if typical_amount > 0 else "expense",
            "amount": typical_amount,
            "monthly_impact": round(abs(typical_amount), 2),
            "months_seen": len(matched),
            "transactions": len(movements),
            "interval_days": int(interval),
            "billing_day": billing_day,
            "last_date": last_date.isoformat(),
            "next_expected": next_expected.isoformat(),
            "days_to_next": (next_expected - today).days,
            "stale_days": stale_days,
            "cv": round(variation, 3),
            "confidence": _confidence(len(matched), variation, interval),
            "active": stale_days <= ACTIVE_STALE_DAYS,
        })

    items.sort(key=lambda item: (item["next_expected"], -item["monthly_impact"]))
    return items


def occurrences_in_month(item, year, month):
    """Date attese nel mese indicato per un movimento ricorrente."""
    monthly_day = item.get("billing_day")
    if monthly_day:
        return [_month_date(year, month, int(monthly_day))]

    first, last, _ = month_bounds(f"{year:04d}-{month:02d}")
    interval = max(1, int(item.get("interval_days") or 30))
    last_seen = parse_date(item.get("last_date"))
    if last_seen is None:
        return []

    expected = last_seen + timedelta(days=interval)
    guard = 0
    while expected < first and guard < 400:
        expected += timedelta(days=interval)
        guard += 1

    dates = []
    while expected <= last and len(dates) < 5:
        dates.append(expected)
        expected += timedelta(days=interval)
    return dates
