const eurFormatter = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const eur2Formatter = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Importo compatto, senza centesimi (per i riepiloghi). */
export function eur(value) {
  return eurFormatter.format(value || 0);
}

/** Importo esatto, con centesimi (per transazioni e abbonamenti). */
export function eur2(value) {
  return eur2Formatter.format(value || 0);
}

/** Percentuale leggibile, es. 42,5%. */
export function pct(value, digits = 0) {
  return `${(value || 0).toLocaleString('it-IT', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
}

/** `2026-07-01` → `1 lug`. */
export function shortDate(value) {
  if (!value) return '';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

/** `2026-07-01` → `mercoledì 1 luglio`. */
export function longDate(value) {
  if (!value) return '';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
}

export const today = () => new Date().toISOString().slice(0, 10);
export const currentMonth = () => today().slice(0, 7);
