import axios from 'axios'
import { supabase } from './supabaseClient'

const BASE_API = import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    ? `${window.location.origin}/api`
    : 'http://localhost:8000/api')
const API_URL = BASE_API.endsWith('/portfolio') ? BASE_API : `${BASE_API.replace(/\/$/, '')}/portfolio`

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

export const PortfolioService = {
  async fetchPortfolios() {
    const res = await client.get('/')
    return res.data
  }
}

export default PortfolioService
