export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
export const API_KEY = import.meta.env.VITE_API_KEY ?? '';

async function request(path, { method = 'GET', body, params } = {}) {
  const url = new URL(`${API_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
    });
  }

  const response = await fetch(url, {
    method,
    headers: {
      'x-api-key': API_KEY,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) return null;

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error ?? `Request failed with status ${response.status}`;
    const details = payload?.details?.map?.((item) => `${item.path}: ${item.message}`).join(', ');
    throw new Error(details ? `${message} (${details})` : message);
  }
  return payload;
}

export const api = {
  health: () => fetch(`${API_URL}/health`).then((response) => response.json()),
  summary: () => request('/api/portfolio/summary'),
  positions: (params) => request('/api/portfolio/positions', { params }),
  trades: (params) => request('/api/trades', { params }),
  createTrade: (body) => request('/api/trades', { method: 'POST', body }),
  updateTrade: (id, body) => request(`/api/trades/${id}`, { method: 'PATCH', body }),
  deleteTrade: (id) => request(`/api/trades/${id}`, { method: 'DELETE' }),
  notifications: (params) => request('/api/notifications', { params }),
  reparse: (id) => request(`/api/notifications/${id}/reparse`, { method: 'POST' }),
  reparseFailed: () => request('/api/notifications/reparse-failed', { method: 'POST' }),
  reparseAll: () => request('/api/notifications/reparse-all', { method: 'POST' }),
  deleteNotification: (id) => request(`/api/notifications/${id}`, { method: 'DELETE' }),
  previewParse: (body) => request('/api/parse/preview', { method: 'POST', body }),
  rules: () => request('/api/parse/rules'),
  instruments: () => request('/api/instruments'),
  setMarkPrice: (code, markPrice) => request(`/api/instruments/${code}`, { method: 'PATCH', body: { markPrice } }),
};

export const streamUrl = `${API_URL}/api/stream?apiKey=${encodeURIComponent(API_KEY)}`;
