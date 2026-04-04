import axios from 'axios';
import { API_CONFIG } from '../config/api';

const logApi = axios.create({
  baseURL: API_CONFIG.LOG_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

logApi.interceptors.request.use((config) => {
  const accessToken = localStorage.getItem('accessToken');
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

export const ingestionService = {
  async uploadFile(file, idsSource) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('ids_source', idsSource);
    const response = await logApi.post('/api/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async getLogs({ severity, category, batchId, quarantineStatus, startDate, endDate, page = 1, pageSize = 20 } = {}) {
    const params = { page, page_size: pageSize };
    if (severity && severity !== 'All') params.severity = severity;
    if (category && category !== 'All') params.category = category;
    if (batchId) params.batch_id = batchId;
    if (quarantineStatus && quarantineStatus !== 'All') params.quarantine_status = quarantineStatus;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    const response = await logApi.get('/api/ingestion-logs', { params });
    return response.data;
  },

  async getBatches() {
    const response = await logApi.get('/api/ingestion-logs/batches');
    return response.data;
  },

  async blockLog(logId, notes) {
    const response = await logApi.post(`/api/ingestion-logs/${logId}/block`, { notes });
    return response.data;
  },

  async trustLog(logId, notes) {
    const response = await logApi.post(`/api/ingestion-logs/${logId}/trust`, { notes });
    return response.data;
  },

  async releaseLog(logId, notes) {
    const response = await logApi.post(`/api/ingestion-logs/${logId}/release`, { notes });
    return response.data;
  },
};
