import axios from 'axios';
import { API_CONFIG } from '../config/api';

const authApi = axios.create({
  baseURL: API_CONFIG.AUTH_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

const logApi = axios.create({
  baseURL: API_CONFIG.LOG_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

[authApi, logApi].forEach((api) => {
  api.interceptors.request.use((config) => {
    const accessToken = localStorage.getItem('accessToken');
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  });
});

export const adminService = {
  // Dashboard stats
  async getStats() {
    const response = await authApi.get('/api/admin/stats/');
    return response.data;
  },

  // User management
  async getUsers({ search = '', tier = '', status = '', page = 1, per_page = 50 } = {}) {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (tier) params.append('tier', tier);
    if (status) params.append('status', status);
    params.append('page', page);
    params.append('per_page', per_page);
    const response = await authApi.get(`/api/admin/users/?${params}`);
    return response.data;
  },

  async getUserDetail(userId) {
    const response = await authApi.get(`/api/admin/${userId}/user_detail/`);
    return response.data;
  },

  async suspendUser(userId) {
    const response = await authApi.post(`/api/admin/${userId}/suspend/`);
    return response.data;
  },

  async unsuspendUser(userId) {
    const response = await authApi.post(`/api/admin/${userId}/unsuspend/`);
    return response.data;
  },

  async changeTier(userId, tier) {
    const response = await authApi.post(`/api/admin/${userId}/change_tier/`, { tier });
    return response.data;
  },

  async resetPassword(userId) {
    const response = await authApi.post(`/api/admin/${userId}/reset_password/`);
    return response.data;
  },

  // Subscriptions
  async getSubscriptions() {
    const response = await authApi.get('/api/admin/subscriptions/');
    return response.data;
  },

  // Audit log
  async getAuditLog(limit = 100) {
    const response = await authApi.get(`/api/admin/audit_log/?limit=${limit}`);
    return response.data;
  },

  // Teams
  async getTeams() {
    const response = await authApi.get('/api/admin/teams/');
    return response.data;
  },

  async deleteTeam(teamId) {
    const response = await authApi.delete(`/api/admin/${teamId}/delete_team/`);
    return response.data;
  },

  async removeMember(teamId, userId) {
    const response = await authApi.post(`/api/admin/${teamId}/remove_member/`, { user_id: userId });
    return response.data;
  },

  // System health (log service)
  async getSystemHealth() {
    const response = await logApi.get('/api/admin/system-health');
    return response.data;
  },

  // Alert stats (log service)
  async getAlertStats() {
    const response = await logApi.get('/api/admin/alert-stats');
    return response.data;
  },

  // Activity log (log service)
  async getActivityLog(limit = 100) {
    const response = await logApi.get(`/api/admin/activity-log?limit=${limit}`);
    return response.data;
  },
};
