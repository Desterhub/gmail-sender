const API_BASE = '';

export function getAuthToken() {
  try {
    return localStorage.getItem('auth_token') || '';
  } catch (e) {
    return '';
  }
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const token = getAuthToken();
  const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    let errorMsg = `HTTP ${response.status} Error`;
    try {
      const data = await response.json();
      if (data.error) errorMsg = data.error;
      else if (data.message) errorMsg = data.message;
    } catch (e) {
      // Non-json response
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

export const api = {
  // Auth & Multi-User
  getMe: () => request('/api/auth/me'),
  getAuthStatus: () => request('/api/auth/status'),
  getAccounts: () => request('/api/accounts'),
  disconnectAuth: () => request('/api/auth/disconnect', { method: 'POST' }),

  // Signature
  getSignature: () => request('/api/signature'),
  updateSignature: (signatureHtml) =>
    request('/api/signature', {
      method: 'PUT',
      body: JSON.stringify({ signatureHtml }),
    }),

  // Duplicate Detection & History Check & Suggestions
  checkRecipientHistory: (emails) =>
    request('/api/recipients/check-history', {
      method: 'POST',
      body: JSON.stringify({ emails }),
    }),
  getRecipientSuggestions: (q) =>
    request(`/api/recipients/suggest?q=${encodeURIComponent(q)}`),

  // Dashboard
  getDashboardStats: () => request('/api/dashboard/stats'),

  // Send
  sendBatch: async (formData) => {
    const token = getAuthToken();
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    const response = await fetch('/api/send', {
      method: 'POST',
      headers,
      body: formData
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to send batch');
    }
    return response.json();
  },

  retryBatch: (batchId, throttle = 20) =>
    request(`/api/batch/${batchId}/retry`, {
      method: 'POST',
      body: JSON.stringify({ throttle }),
    }),

  // History
  getHistory: (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    return request(`/api/history?${query.toString()}`);
  },

  getHistoryDetail: (id) => request(`/api/history/${id}`),
  resendEmail: (id) => request(`/api/history/${id}/resend`, { method: 'POST' }),

  // Batches
  getBatches: () => request('/api/batches'),
  getBatchDetail: (id) => request(`/api/batches/${id}`),

  // Templates
  getTemplates: () => request('/api/templates'),
  createTemplate: (data) =>
    request('/api/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateTemplate: (id, data) =>
    request(`/api/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteTemplate: (id) =>
    request(`/api/templates/${id}`, {
      method: 'DELETE',
    }),

  // Replies Portal
  getReplies: (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    return request(`/api/replies?${query.toString()}`);
  },
  syncReplies: () => request('/api/replies/sync', { method: 'POST' }),
  getReplyDetail: (id) => request(`/api/replies/${id}`),
  toggleReplyRead: (id, isRead) =>
    request(`/api/replies/${id}/read`, {
      method: 'PATCH',
      body: JSON.stringify({ isRead }),
    }),

  // SMTP & Protocol Dispatch Settings
  getSmtpSettings: () => request('/api/settings/smtp'),
  saveSmtpSettings: (data) =>
    request('/api/settings/smtp', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  testSmtpConnection: (data) =>
    request('/api/settings/smtp/test', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  syncImapReplies: () => request('/api/settings/smtp/sync-replies', { method: 'POST' }),
};
