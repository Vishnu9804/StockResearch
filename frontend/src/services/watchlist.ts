import axios from 'axios'

const BASE_API = import.meta.env.VITE_API_URL || 
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    ? `${window.location.origin}/api`
    : 'http://localhost:5000/api')
const API_URL = BASE_API.endsWith('/watchlists') ? BASE_API : `${BASE_API.replace(/\/$/, '')}/watchlists`


const client = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Auto-inject local JWT if present
client.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('finscreen_accessToken')
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
    }
  }
  return config
})

export const WatchlistService = {
  async fetchWatchlists() {
    const res = await client.get('/')
    return res.data
  },

  async createWatchlist(name: string) {
    const res = await client.post('/', { name })
    return res.data
  },

  async addStock(watchlistId: string, symbol: string, targetPrice?: number | null, alertEnabled?: boolean) {
    const res = await client.post(`/${watchlistId}/items`, { symbol, targetPrice, alertEnabled })
    return res.data
  },

  async updateStock(itemId: string, targetPrice?: number | null, alertEnabled?: boolean) {
    const res = await client.put(`/items/${itemId}`, { targetPrice, alertEnabled })
    return res.data
  },

  async removeStock(itemId: string) {
    const res = await client.delete(`/items/${itemId}`)
    return res.data
  },

  async deleteWatchlist(watchlistId: string) {
    const res = await client.delete(`/${watchlistId}`)
    return res.data
  }
}

export default WatchlistService
