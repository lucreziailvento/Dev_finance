export function apiBase() {
  try {
    return localStorage.getItem('devfinance_api_url') || window.location.origin;
  } catch {
    return window.location.origin;
  }
}

export class ApiError extends Error {
  constructor(message, status = 0, payload = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

/**
 * Unico punto di uscita verso il backend: controlla lo status HTTP e
 * trasforma gli errori in eccezioni, così i componenti non devono
 * ispezionare `{error: ...}` a mano.
 */
async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${apiBase()}${path}`, options);
  } catch {
    throw new ApiError('Backend non raggiungibile. Controlla la connessione.');
  }

  const raw = await response.text();
  let payload = null;
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = raw;
    }
  }

  if (!response.ok) {
    const detail = payload && payload.detail ? payload.detail : `Errore ${response.status}`;
    throw new ApiError(typeof detail === 'string' ? detail : JSON.stringify(detail), response.status, payload);
  }
  return payload;
}

function sendJson(method, path, body) {
  return request(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export const api = {
  dashboard: (month) => request(`/api/dashboard/${month}`),
  trend: (months = 12) => request(`/api/trend?months=${months}`),
  stats: () => request('/api/stats'),

  forecast: (month) => request(`/api/forecast/${month}`),
  saveForecast: (entry) => sendJson('POST', '/api/forecast', entry),
  deleteForecast: (date) => request(`/api/forecast/${date}`, { method: 'DELETE' }),

  budgetAverages: () => request('/api/budget-averages'),
  budgetAllocations: (month) => request(`/api/budget-allocations/${month}`),
  saveAllocations: (month, allocations) => sendJson('PUT', `/api/budget-allocations/${month}`, allocations),

  etfPlan: (months = 12, buffer = 0.2) => request(`/api/etf-plan?months=${months}&buffer=${buffer}`),

  ingest: (fineco, revolut) => {
    const form = new FormData();
    if (fineco) form.append('fineco_file', fineco);
    if (revolut) form.append('revolut_file', revolut);
    return request('/api/ingest', { method: 'POST', body: form });
  },

  addManual: (payload) => sendJson('POST', '/api/manual-records', payload),
  updateManual: (id, payload) => sendJson('PUT', `/api/manual-records/${id}`, payload),
  deleteManual: (id) => request(`/api/manual-records/${id}`, { method: 'DELETE' }),

  updateDescription: (hashId, newDescription) =>
    sendJson('POST', '/api/transactions/update-description', {
      hash_id: hashId,
      new_description: newDescription,
    }),
  updateCategory: (hashId, newMicroCategory) =>
    sendJson('POST', '/api/transactions/update-category', {
      hash_id: hashId,
      new_micro_category: newMicroCategory,
    }),
};
