export function apiBase() {
  return localStorage.getItem('devfinance_api_url') || window.location.origin;
}

async function jfetch(path, options) {
  const r = await fetch(`${apiBase()}${path}`, options);
  return r.json();
}

export const api = {
  dashboard: (month) => jfetch(`/api/dashboard/${month}`),

  forecast: (month) => jfetch(`/api/forecast/${month}`),
  saveForecast: (entry) => jfetch('/api/forecast', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry),
  }),
  deleteForecast: (date) => jfetch(`/api/forecast/${date}`, { method: 'DELETE' }),

  budgetAverages: () => jfetch('/api/budget-averages'),
  budgetAllocations: (month) => jfetch(`/api/budget-allocations/${month}`),
  saveAllocations: (month, allocations) => jfetch(`/api/budget-allocations/${month}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(allocations),
  }),

  etfPlan: (months = 12, buffer = 0.2) => jfetch(`/api/etf-plan?months=${months}&buffer=${buffer}`),

  ingest: async (fineco, revolut) => {
    const fd = new FormData();
    fd.append('fineco_file', fineco);
    fd.append('revolut_file', revolut);
    const r = await fetch(`${apiBase()}/api/ingest`, { method: 'POST', body: fd });
    return r.json();
  },

  addManual: (payload) => jfetch('/api/manual-records', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  }),
  listManual: () => jfetch('/api/manual-records'),
  updateManual: (id, payload) => jfetch(`/api/manual-records/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  }),
  deleteManual: (id) => jfetch(`/api/manual-records/${id}`, { method: 'DELETE' }),

  updateDescription: (hashId, newDescription) => jfetch('/api/transactions/update-description', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hash_id: hashId, new_description: newDescription }),
  }),
  updateCategory: (hashId, newMicroCategory) => jfetch('/api/transactions/update-category', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hash_id: hashId, new_micro_category: newMicroCategory }),
  }),
};
