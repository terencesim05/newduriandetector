import axios from 'axios';
import { API_CONFIG } from '../config/api';

const logApi = axios.create({
  baseURL: API_CONFIG.LOG_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

logApi.interceptors.request.use((config) => {
  const accessToken = localStorage.getItem('accessToken');
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

export const alertService = {
  async getAlerts({ severity, category, page = 1, pageSize = 20 } = {}) {
    const params = { page, page_size: pageSize };
    if (severity && severity !== 'All') params.severity = severity;
    if (category && category !== 'All') params.category = category;
    const response = await logApi.get('/api/alerts', { params });
    return response.data;
  },

  async getRecentIOCs({ days = 7, limit = 100 } = {}) {
    const response = await logApi.get('/api/threat-intel/recent', { params: { days, limit } });
    return response.data;
  },

  async searchIOC(term) {
    const response = await logApi.get('/api/threat-intel/search', { params: { term } });
    return response.data;
  },

  // Blacklist
  async getBlacklist() {
    const response = await logApi.get('/api/blacklist');
    return response.data;
  },
  async addToBlacklist(entry) {
    const response = await logApi.post('/api/blacklist', entry);
    return response.data;
  },
  async bulkImportBlacklist(entries) {
    const response = await logApi.post('/api/blacklist/bulk', { entries });
    return response.data;
  },
  async removeFromBlacklist(id) {
    const response = await logApi.delete(`/api/blacklist/${id}`);
    return response.data;
  },

  // Whitelist
  async getWhitelist() {
    const response = await logApi.get('/api/whitelist');
    return response.data;
  },
  async addToWhitelist(entry) {
    const response = await logApi.post('/api/whitelist', entry);
    return response.data;
  },
  async bulkImportWhitelist(entries) {
    const response = await logApi.post('/api/whitelist/bulk', { entries });
    return response.data;
  },
  async removeFromWhitelist(id) {
    const response = await logApi.delete(`/api/whitelist/${id}`);
    return response.data;
  },

  // Quarantine
  async getQuarantined(status) {
    const params = {};
    if (status && status !== 'All') params.status = status;
    const response = await logApi.get('/api/quarantine', { params });
    return response.data;
  },
  async getQuarantineStats() {
    const response = await logApi.get('/api/quarantine/stats');
    return response.data;
  },
  async releaseFromQuarantine(id, notes) {
    const response = await logApi.post(`/api/quarantine/${id}/release`, { notes });
    return response.data;
  },
  async blockFromQuarantine(id, notes) {
    const response = await logApi.post(`/api/quarantine/${id}/block`, { notes });
    return response.data;
  },
  async removeFromQuarantine(id) {
    const response = await logApi.delete(`/api/quarantine/${id}`);
    return response.data;
  },
};
