MACRO_BY_MICRO = {
    "Entrate_Lavoro": "Entrate",
    "Altre Entrate": "Entrate",
    "Investimenti & Risparmio": "Investimenti",
    "Giroconto": "Trasferimento Interno",
    "Svago & Ristorazione": "Spese Variabili",
    "Shopping & Lifestyle": "Spese Variabili",
    "Trasporti & Viaggi": "Spese Variabili",
    "Sport & Salute": "Spese Variabili",
    "Aperitivi": "Spese Variabili",
    "Regali": "Spese Variabili",
    "Casa & Arredamento": "Spese Variabili",
    "Colazioni": "Spese Variabili",
    "Vacanza": "Spese Variabili",
    "Weekend Fuori": "Spese Variabili",
    "Spesa Alimentare": "Spese Fisse",
    "Affitto & Condominio": "Spese Fisse",
    "Utenze & Bollette": "Spese Fisse",
    "Abbonamenti Digitali": "Spese Fisse",
    "Altro": "Spese Variabili",
}


def get_macro(micro):
    return MACRO_BY_MICRO.get(micro, "Spese Variabili")
