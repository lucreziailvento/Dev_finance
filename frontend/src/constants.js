export const CATEGORIES = [
  "Spesa Alimentare", "Aperitivi", "Colazioni", "Affitto & Condominio", "Utenze & Bollette",
  "Svago & Ristorazione", "Sport & Salute", "Shopping & Lifestyle", "Regali", "Casa & Arredamento",
  "Vacanza", "Weekend Fuori",
  "Abbonamenti Digitali", "Trasporti & Viaggi", "Investimenti & Risparmio",
  "Entrate_Lavoro", "Altre Entrate", "Giroconto", "Altro"
];

export const CAT_COLORS = {
  "Spesa Alimentare": "#34d399",
  "Aperitivi": "#fb7185",
  "Colazioni": "#facc15",
  "Affitto & Condominio": "#a78bfa",
  "Utenze & Bollette": "#38bdf8",
  "Svago & Ristorazione": "#f59e0b",
  "Sport & Salute": "#f472b6",
  "Shopping & Lifestyle": "#e879f9",
  "Regali": "#818cf8",
  "Casa & Arredamento": "#f97316",
  "Vacanza": "#3b82f6",
  "Weekend Fuori": "#c084fc",
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

const MONTH_IT = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
const MONTH_FULL_IT = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

export const MONTH_LABELS = {};
export const MONTH_FULL = {};

for (let y = 2024; y <= 2027; y++) {
  for (let m = 1; m <= 12; m++) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    MONTH_LABELS[key] = MONTH_IT[m - 1];
    MONTH_FULL[key] = `${MONTH_FULL_IT[m - 1]} ${y}`;
  }
}

export const MONTHS = Object.keys(MONTH_LABELS).sort();

export const COLORS = {
  income: '#10b981',
  expenses: '#f43f5e',
  savings: '#06b6d4',
  invested: '#8b5cf6',
  investable: '#14b8a6',
  transfers: '#64748b',
  accent: '#06b6d4',
  bg: '#0a0f1e',
  card: '#111827',
  cardLight: '#1f2937',
};
