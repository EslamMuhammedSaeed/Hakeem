export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

let onUnauthenticated = () => {};

export function setUnauthenticatedHandler(handler) {
  onUnauthenticated = handler;
}

export class ApiError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request(path, { method = 'GET', body, params } = {}) {
  const url = new URL(`${API_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
    });
  }

  const response = await fetch(url, {
    method,
    credentials: 'include',
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) return null;

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new ApiError(payload?.error ?? `Request failed with status ${response.status}`, {
      status: response.status,
      code: payload?.code,
      details: payload?.details,
    });
    if (error.code === 'UNAUTHENTICATED') onUnauthenticated();
    throw error;
  }
  return payload;
}

export const api = {
  health: () => fetch(`${API_URL}/health`).then((response) => response.json()),
  authConfig: () => request('/api/auth/config'),
  me: () => request('/api/auth/me'),
  login: (body) => request('/api/auth/login', { method: 'POST', body }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
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

export const streamUrl = `${API_URL}/api/stream`;
