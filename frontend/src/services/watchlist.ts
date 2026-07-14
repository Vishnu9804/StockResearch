import axios from 'axios'
import { supabase } from './supabaseClient'

const BASE_API = import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    ? `${window.location.origin}/api`
    : 'http://localhost:8000/api')
const API_URL = BASE_API.endsWith('/watchlists') ? BASE_API : `${BASE_API.replace(/\/$/, '')}/watchlists`

const client = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
})

client.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    config.headers['Authorization'] = `Bearer ${session.access_token}`
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

  async renameWatchlist(watchlistId: string, name: string) {
    const res = await client.put(`/${watchlistId}`, { name })
    return res.data
  },

  async deleteWatchlist(watchlistId: string) {
    const res = await client.delete(`/${watchlistId}`)
    return res.data
  },

  async addStock(watchlistId: string, symbol: string, companyName?: string, targetPrice?: number | null, alertEnabled?: boolean) {
    const res = await client.post(`/${watchlistId}/items`, { symbol, companyName, targetPrice, alertEnabled })
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

  async moveStock(itemId: string, targetWatchlistId: string) {
    const res = await client.put(`/items/${itemId}/move`, { targetWatchlistId })
    return res.data
  },

  async watchStock(symbol: string, companyName?: string) {
    const res = await client.post('/watch', { symbol, companyName })
    return res.data
  },

  async unwatchStock(symbol: string) {
    const res = await client.delete(`/watch/${symbol}`)
    return res.data
  }
}

export default WatchlistService
