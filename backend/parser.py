import pandas as pd
import re
import hashlib

CATEGORY_MAP = {
    "Spesa Alimentare": [r"esselunga", r"coop", r"conad", r"lidl", r"carrefour", r"supermercati", r"aldi", r"pam", r"eataly", r"just eat"],
    "Affitto & Condominio": [r"affitto", r"condominio", r"canone", r"locazione"],
    "Utenze & Bollette": [r"enel", r"fastweb", r"iliad", r"iren", r"gruppo hera", r"vodafone", r"tari", r"servizio elettrico"],
    "Svago & Ristorazione": [r"bar", r"ristorante", r"pizzeria", r"pub", r"cinema", r"gallery16", r"piedra del sol", r"sorbetteria", r"venezia", r"amarilli", r"gelateria", r"osteria", r"pasticceria", r"briciole bar", r"roxy bar", r"bar il buco", r"teatro", r"tiger", r"tigot", r"circolo arci"],
    "Sport & Salute": [r"beach volley", r"palestra", r"decathlon", r"visita medica", r"farmacia", r"ticket", r"running"],
    "Shopping & Lifestyle": [r"subito", r"amazon", r"temu", r"ovs", r"dm drogerie", r"scout", r"zalando", r"shein", r"apple store", r"tedi"],
    "Abbonamenti Digitali": [r"spotify", r"netflix", r"aws", r"github", r"openai", r"apple\.com", r"icloud", r"prime video", r"youtube premium", r"abbonamento apple"],
    "Trasporti & Viaggi": [r"ryanair", r"trenitalia", r"italo", r"uber", r"enilive", r"tper", r"ridemovi", r"toremar", r"autostrade", r"booking", r"airbnb", r"skopje", r"las palmas"],
    "Investimenti & Risparmio": [r"conto deposito", r"trade", r"scalable", r"etf", r"bg saxo", r"directa", r"btp", r"buono postale", r"conto di investimento"],
    "Entrate_Lavoro": [r"stipendio", r"rimborso spese", r"tirocinio", r"lavoro chiamata", r"coop servizi", r"ritenuta", r"musixmatch", r"vivaevents"],
}

INTERNAL_TRANSFER_PATTERNS = [
    r"revolut", r"ricarica di apple pay", r"top.?up", r"giroconto", r"pocket",
    r"sposta denaro", r"pagamento da.*revolut", r"accredita.*regalo",
    r"pagamento visa debit", r"canone mensile", r"sconto canone",
]

OUTGOING_TRANSFER_PATTERNS = [
    r"^bonifico",
]


def genera_hash(data, descrizione, importo):
    return hashlib.sha256(f"{data}|{descrizione}|{importo}".encode()).hexdigest()


def categorizza(descrizione, importo):
    desc_lower = descrizione.lower().strip()
    if not desc_lower or importo == 0:
        return "Da Classificare", "Altro"

    for pattern in INTERNAL_TRANSFER_PATTERNS:
        if re.search(pattern, desc_lower):
            return "Trasferimento Interno", "Giroconto"

    for pattern in OUTGOING_TRANSFER_PATTERNS:
        if re.search(pattern, desc_lower) and importo < 0:
            return "Trasferimento Interno", "Giroconto"

    for micro, patterns in CATEGORY_MAP.items():
        for pattern in patterns:
            if re.search(pattern, desc_lower):
                if micro == "Entrate_Lavoro":
                    return "Entrate", micro
                elif micro == "Investimenti & Risparmio":
                    return "Investimenti", micro
                elif micro in ["Svago & Ristorazione", "Shopping & Lifestyle", "Trasporti & Viaggi", "Sport & Salute"]:
                    return "Spese Variabili", micro
                else:
                    return "Spese Fisse", micro

    if importo > 0:
        return "Entrate", "Altre Entrate"
    return "Spese Variabili", "Altro"


def pulisci_importo(valore):
    if pd.isna(valore):
        return 0.0
    if isinstance(valore, (int, float)):
        return float(valore)
    text = str(valore).strip().replace('\u20ac', '').replace('EUR', '').replace('euro', '').strip()
    if not text or text.lower() in ('nan', ''):
        return 0.0
    allowed = set('0123456789,.-')
    cleaned = ''.join(c for c in text if c in allowed or c in ' \t').strip()
    if not cleaned:
        return 0.0
    try:
        if '.' in cleaned and ',' in cleaned:
            if cleaned.rindex('.') < cleaned.rindex(','):
                cleaned = cleaned.replace('.', '').replace(',', '.')
            else:
                cleaned = cleaned.replace(',', '')
        elif ',' in cleaned:
            cleaned = cleaned.replace(',', '.')
        elif '.' in cleaned:
            parts = cleaned.split('.')
            if len(parts) > 2 or (len(parts) == 2 and len(parts[-1]) > 2):
                cleaned = cleaned.replace('.', '')
        return float(cleaned)
    except ValueError:
        return 0.0


def normalizza_banca_principale(file_path):
    try:
        df_grezzo = pd.read_excel(file_path, header=None)
    except Exception:
        return pd.DataFrame(columns=['date', 'description', 'amount', 'source'])

    found_idx = None
    for idx, row in df_grezzo.iterrows():
        row_values = [str(val).strip().lower() for val in row.values if pd.notna(val)]
        if any('data' in v for v in row_values) and any('descrizione' in v or 'causale' in v for v in row_values):
            found_idx = idx
            break

    if found_idx is None:
        return pd.DataFrame(columns=['date', 'description', 'amount', 'source'])

    raw_cols = [str(c).strip() for c in df_grezzo.iloc[found_idx].values]
    df = pd.read_excel(file_path, skiprows=found_idx + 1)
    df.columns = raw_cols
    df.columns = [str(c).strip() for c in df.columns]

    try:
        col_date = [c for c in df.columns if 'data' in c.lower()][0]
        col_desc_candidates = [c for c in df.columns if 'descrizione' in c.lower() or 'causale' in c.lower()]
        col_desc = col_desc_candidates[0] if col_desc_candidates else None
        if not col_desc:
            return pd.DataFrame(columns=['date', 'description', 'amount', 'source'])

        df_norm = pd.DataFrame()
        df_norm['date'] = pd.to_datetime(df[col_date], errors='coerce', dayfirst=True).dt.strftime('%Y-%m-%d')
        df_norm['description'] = df[col_desc].astype(str)

        col_entrate = [c for c in df.columns if 'entrate' in c.lower()]
        col_uscite = [c for c in df.columns if 'uscite' in c.lower()]
        col_amount = [c for c in df.columns if 'importo' in c.lower() or 'valore' in c.lower() or 'importo' in c.lower()]

        if col_amount:
            df_norm['amount'] = df[col_amount[0]].apply(pulisci_importo)
        elif col_entrate and col_uscite:
            entrate_num = df[col_entrate[0]].apply(pulisci_importo)
            uscite_num = df[col_uscite[0]].apply(pulisci_importo)
            amounts = []
            for e, u in zip(entrate_num, uscite_num):
                if e != 0 and u == 0:
                    amounts.append(e)
                elif u != 0 and e == 0:
                    amounts.append(-abs(u))
                elif e != 0 and u != 0:
                    amounts.append(e if e > 0 else -abs(u))
                else:
                    amounts.append(0.0)
            df_norm['amount'] = amounts
        else:
            numeric_cols = df.select_dtypes(include=['float64', 'int64']).columns
            if len(numeric_cols) > 0:
                df_norm['amount'] = df[numeric_cols[0]].apply(pulisci_importo)
            else:
                return pd.DataFrame(columns=['date', 'description', 'amount', 'source'])

        df_norm['source'] = 'Fineco'
        result = df_norm.dropna(subset=['date'])
        result = result[result['date'] != ''].copy()
        result = result[result['amount'] != 0].copy()
        return result
    except Exception:
        return pd.DataFrame(columns=['date', 'description', 'amount', 'source'])


def normalizza_revolut(file_path):
    try:
        df = pd.read_csv(file_path, dtype=str)
        if 'Prodotto' in df.columns:
            df = df[df['Prodotto'] == 'Attuale']
        df = df.dropna(subset=['Data di inizio' if 'Data di inizio' in df.columns else 'Data', 'Importo'])
        date_col = 'Data di inizio' if 'Data di inizio' in df.columns else ('Data' if 'Data' in df.columns else None)
        desc_col = 'Descrizione' if 'Descrizione' in df.columns else ('Descrizione originale' if 'Descrizione originale' in df.columns else None)
        amount_col = 'Importo' if 'Importo' in df.columns else None
        if not date_col or not amount_col:
            return pd.DataFrame(columns=['date', 'description', 'amount', 'source'])
        df_norm = pd.DataFrame()
        df_norm['date'] = pd.to_datetime(df[date_col], errors='coerce').dt.strftime('%Y-%m-%d')
        df_norm['description'] = df[desc_col].astype(str) if desc_col else 'N/A'
        df_norm['amount'] = pd.to_numeric(df[amount_col], errors='coerce').fillna(0.0)
        df_norm['source'] = 'Revolut'
        result = df_norm.dropna(subset=['date'])
        result = result[result['date'] != ''].copy()
        result = result[result['amount'] != 0].copy()
        return result
    except Exception:
        return pd.DataFrame(columns=['date', 'description', 'amount', 'source'])


def esegui_etl_storico(path_f, path_r):
    df_f = normalizza_banca_principale(path_f)
    df_r = normalizza_revolut(path_r)
    df_all = pd.concat([df_f, df_r], ignore_index=True).fillna("")
    if df_all.empty:
        return df_all
    res = df_all.apply(lambda r: categorizza(r['description'], r['amount']), axis=1)
    df_all['macro_category'] = [r[0] for r in res]
    df_all['micro_category'] = [r[1] for r in res]
    df_all['hash_id'] = df_all.apply(lambda r: genera_hash(r['date'], r['description'], r['amount']), axis=1)
    return df_all
