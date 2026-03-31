import axios from 'axios';
import { API_CONFIG } from '../config/api';

const authApi = axios.create({
  baseURL: API_CONFIG.AUTH_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

authApi.interceptors.request.use((config) => {
  const accessToken = localStorage.getItem('accessToken');
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

export const authService = {
  async register(userData) {
    const response = await authApi.post('/api/auth/register/', userData);
    return response.data;
  },

  async login(email, password) {
    const response = await authApi.post('/api/auth/login/', { username: email, password });
    return response.data;
  },

  async logout() {
    const refreshToken = localStorage.getItem('refreshToken');
    const response = await authApi.post('/api/auth/logout/', { refresh: refreshToken });
    return response.data;
  },

  async getCurrentUser() {
    const response = await authApi.get('/api/auth/me/');
    return response.data;
  },

  async refreshToken(refreshToken) {
    const response = await authApi.post('/api/auth/refresh/', { refresh: refreshToken });
    return response.data;
  },

  async getMyTeam() {
    const response = await authApi.get('/api/teams/');
    // Returns array of teams — user belongs to one
    const teams = response.data;
    return teams.length > 0 ? teams[0] : null;
  },

  async createTeam(name) {
    const response = await authApi.post('/api/teams/', { name });
    return response.data;
  },

  async regeneratePin(teamId) {
    const response = await authApi.post(`/api/teams/${teamId}/regenerate_pin/`);
    return response.data;
  },
};
