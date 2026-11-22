// Talks to the backend workflow API (see WORKFLOW_CONTRACT.md).
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch {
    throw new Error('Cannot reach the backend. Is the server running on port 5000?');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) {
    const detail = body.errors?.[0]?.message;
    throw new Error(detail || body.message || `Request failed (${res.status})`);
  }
  return body.data;
}

export const createWorkflow = (payload) =>
  request('/workflows', { method: 'POST', body: JSON.stringify(payload) });

export const updateWorkflow = (id, payload) =>
  request(`/workflows/${id}`, { method: 'PUT', body: JSON.stringify(payload) });

export const listWorkflows = async () => (await request('/workflows')).workflows ?? [];

export const getWorkflow = (id) => request(`/workflows/${id}`);

export const deleteWorkflow = (id) => request(`/workflows/${id}`, { method: 'DELETE' });