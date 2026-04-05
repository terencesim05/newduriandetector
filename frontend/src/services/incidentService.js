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

export const incidentService = {
  async getIncidents({ status, priority, page = 1, pageSize = 20 } = {}) {
    const params = { page, page_size: pageSize };
    if (status && status !== 'All') params.status = status;
    if (priority && priority !== 'All') params.priority = priority;
    const response = await logApi.get('/api/incidents', { params });
    return response.data;
  },

  async getIncident(id) {
    const response = await logApi.get(`/api/incidents/${id}`);
    return response.data;
  },

  async createIncident({ title, description, priority }) {
    const response = await logApi.post('/api/incidents', { title, description, priority });
    return response.data;
  },

  async updateIncident(id, data) {
    const response = await logApi.patch(`/api/incidents/${id}`, data);
    return response.data;
  },

  async deleteIncident(id) {
    const response = await logApi.delete(`/api/incidents/${id}`);
    return response.data;
  },

  async addNote(incidentId, content) {
    const response = await logApi.post(`/api/incidents/${incidentId}/notes`, { content });
    return response.data;
  },

  async linkAlert(incidentId, alertId) {
    const response = await logApi.post(`/api/incidents/${incidentId}/link-alert`, { alert_id: alertId });
    return response.data;
  },

  async unlinkAlert(incidentId, alertId) {
    const response = await logApi.delete(`/api/incidents/${incidentId}/unlink-alert/${alertId}`);
    return response.data;
  },

  async getLinkedAlerts(incidentId) {
    const response = await logApi.get(`/api/incidents/${incidentId}/alerts`);
    return response.data;
  },
};
