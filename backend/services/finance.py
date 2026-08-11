def median(arr):
    n = len(arr)
    if n == 0:
        return 0.0
    s = sorted(arr)
    if n % 2 == 1:
        return s[n // 2]
    return (s[n // 2 - 1] + s[n // 2]) / 2


def build_clean_monthly_series(rows):
    """Rows: list of dict(date, amount, description, macro_category, micro_category).
    Ritorna lista ordinata di dict:
    {month, income, expenses, invested, transfers, savings, investable}

    Regole:
    - 'compravendita' in descrizione: esborsi -> invested, vendite -> ignorate
    - 'assegno' / 'bonifico' / macro 'Trasferimento Interno': trasferimento
    - macro 'Investimenti': esborsi -> invested, entrate -> ignorate
    - il resto: entrate (amount > 0) o spese (amount < 0)
    """
    per_month = {}
    for r in rows:
        month = (r.get("date") or "")[:7]
        if not month:
            continue
        desc_lower = (r.get("description") or "").lower()
        amount = float(r.get("amount") or 0)
        macro = r.get("macro_category") or ""

        is_compravendita = "compravendita" in desc_lower
        is_assegno = "assegno" in desc_lower
        is_bonifico = "bonifico" in desc_lower
        is_investimenti = macro == "Investimenti"
        is_trasferimento = macro == "Trasferimento Interno"

        m = per_month.setdefault(month, {
            "income": 0.0, "expenses": 0.0, "invested": 0.0, "transfers": 0.0,
        })
        if is_compravendita:
            if amount < 0:
                m["invested"] += abs(amount)
            else:
                continue
        elif is_assegno or is_bonifico or is_trasferimento:
            m["transfers"] += abs(amount)
        elif is_investimenti:
            if amount < 0:
                m["invested"] += abs(amount)
            else:
                continue
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
