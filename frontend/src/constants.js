export const CATEGORIES = [
  "Spesa Alimentare", "Aperitivi", "Affitto & Condominio", "Utenze & Bollette",
  "Svago & Ristorazione", "Sport & Salute", "Shopping & Lifestyle", "Regali", "Casa & Arredamento",
  "Abbonamenti Digitali", "Trasporti & Viaggi", "Investimenti & Risparmio",
  "Entrate_Lavoro", "Altre Entrate", "Giroconto", "Altro"
];

export const CAT_COLORS = {
  "Spesa Alimentare": "#34d399",
  "Aperitivi": "#f87171",
  "Affitto & Condominio": "#a78bfa",
  "Utenze & Bollette": "#38bdf8",
  "Svago & Ristorazione": "#fbbf24",
  "Sport & Salute": "#fb7185",
  "Shopping & Lifestyle": "#e879f9",
  "Regali": "#818cf8",
  "Casa & Arredamento": "#b45309",
  "Abbonamenti Digitali": "#22d3ee",
  "Trasporti & Viaggi": "#fb923c",
  "Investimenti & Risparmio": "#2dd4bf",
  "Entrate_Lavoro": "#4ade80",
  "Altre Entrate": "#a3e635",
  "Giroconto": "#64748b",
  "Altro": "#94a3b8",
};

export function catColor(name) {
  return CAT_COLORS[name] || "#64748b";
}

export const MONTHS = [
  "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06",
  "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12",
];

export const MONTH_LABELS = {
  "2026-01": "Gen", "2026-02": "Feb", "2026-03": "Mar", "2026-04": "Apr",
  "2026-05": "Mag", "2026-06": "Giu", "2026-07": "Lug", "2026-08": "Ago",
  "2026-09": "Set", "2026-10": "Ott", "2026-11": "Nov", "2026-12": "Dic",
};

export const MONTH_FULL = {
  "2026-01": "Gennaio", "2026-02": "Febbraio", "2026-03": "Marzo", "2026-04": "Aprile",
  "2026-05": "Maggio", "2026-06": "Giugno", "2026-07": "Luglio", "2026-08": "Agosto",
  "2026-09": "Settembre", "2026-10": "Ottobre", "2026-11": "Novembre", "2026-12": "Dicembre",
};
