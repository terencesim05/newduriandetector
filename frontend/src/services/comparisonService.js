import axios from 'axios'
import { API_CONFIG } from '../config/api'

const logApi = axios.create({
  baseURL: API_CONFIG.LOG_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

logApi.interceptors.request.use((config) => {
  const accessToken = localStorage.getItem('accessToken')
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

export const comparisonService = {
  async getEngineStats() {
    const res = await logApi.get('/api/comparison/stats')
    return res.data
  },

  async runComparison(hours = 24) {
    const res = await logApi.post('/api/comparison/runs', { hours })
    return res.data
  },

  async listRuns() {
    const res = await logApi.get('/api/comparison/runs')
    return res.data
  },

  async getRun(id) {
    const res = await logApi.get(`/api/comparison/runs/${id}`)
    return res.data
  },

  async deleteRun(id) {
    const res = await logApi.delete(`/api/comparison/runs/${id}`)
    return res.data
  },
}
