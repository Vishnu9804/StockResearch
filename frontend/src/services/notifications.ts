import axios from 'axios'

const BASE_API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const API_URL = BASE_API.endsWith('/screener') ? BASE_API : `${BASE_API.replace(/\/$/, '')}/screener`

const client = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Auto-inject JWT access tokens
client.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('finscreen_accessToken')
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
    }
  }
  return config
})

export const NotificationService = {
  async fetchNotifications() {
    const res = await client.get('/notifications')
    return res.data
  },

  async markAsRead(id: string) {
    const res = await client.put(`/notifications/${id}/read`)
    return res.data
  },

  async markAllAsRead() {
    const res = await client.put('/notifications/read-all')
    return res.data
  }
}

export default NotificationService
