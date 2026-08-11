def median(arr):
    n = len(arr)
    if n == 0:
        return 0.0
    s = sorted(arr)
    if n % 2 == 1:
        return s[n // 2]
    return (s[n // 2 - 1] + s[n // 2]) / 2


# Descrizioni che rappresentano movimenti di portafoglio/trasferimenti,
# NON reddito o spese di consumo.
MOVIMENTI_TITOLI = ("compravendita", "assegno")
IGNORED_SOURCES = ("bonifico",)


def is_portfolio_move(description, macro_category):
    desc = description.lower()
    if any(k in desc for k in MOVIMENTI_TITOLI):
        return True
    if any(k in desc for k in IGNORED_SOURCES):
        return True
    return macro_category in ("Trasferimento Interno", "Investimenti")


def build_clean_monthly_series(rows):
    """Rows: list of dict(date, amount, description, macro_category, micro_category).
    Ritorna lista ordinata di dict:
    {month, income, expenses, invested, transfers, savings, investable}
    """
    per_month = {}
    for r in rows:
        month = (r.get("date") or "")[:7]
        if not month:
            continue
        desc = r.get("description") or ""
        desc_lower = desc.lower()
        amount = float(r.get("amount") or 0)
        macro = r.get("macro_category") or ""
        is_titoli = any(k in desc_lower for k in MOVIMENTI_TITOLI)
        is_trasferimento = macro in ("Trasferimento Interno", "Investimenti") or \
            any(k in desc_lower for k in IGNORED_SOURCES)

        m = per_month.setdefault(month, {
            "income": 0.0, "expenses": 0.0, "invested": 0.0, "transfers": 0.0,
        })
        if is_titoli:
            if amount < 0:
                m["invested"] += abs(amount)
            else:
                # Vendita titoli: non è reddito da lavoro, non conta
                continue
        elif is_trasferimento:
            m["transfers"] += abs(amount)
        elif amount > 0:
            m["income"] += amount
        else:
            m["expenses"] += abs(amount)

    series = []
    for month in sorted(per_month):
        m = per_month[month]
        savings = round(m["income"] - m["expenses"], 2)
        investable = round(savings - m["invested"], 2)
        series.append({
            "month": month,
            "income": round(m["income"], 2),
            "expenses": round(m["expenses"], 2),
            "invested": round(m["invested"], 2),
            "transfers": round(m["transfers"], 2),
            "savings": savings,
            "investable": investable,
        })
    return series


def round_to_10(x):
    return int(round(x / 10.0)) * 10
