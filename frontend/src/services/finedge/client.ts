/**
 * services/finedge/client.ts
 * Production-ready Axios HTTP client targeting our secure Express backend proxy
 */

import axios, { type AxiosInstance, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios'

const BASE_URL = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
  ? '/api/finedge'
  : 'http://localhost:5000/api/finedge'

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export const finedgeClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  withCredentials: true, // Securely transfer HTTP-only cookies
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor: attach request ID
finedgeClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  config.headers['X-Request-ID'] = generateRequestId()
  return config
})

// Response interceptor: handle token rotation, rate limits, and network errors
finedgeClient.interceptors.response.use(
  (response) => {
    return response
  },
  async (error) => {
    if (!error.response) {
      return Promise.reject(error)
    }

    const { status, headers } = error.response
    const originalRequest = error.config as AxiosRequestConfig

    // Handle 429 Rate Limit (with Retry-After headers fallback)
    if (status === 429) {
      const retryAfter = parseInt(headers['retry-after'] ?? '5', 10)
      console.warn(`[FinEdge Client] Rate limit reached. Backing off for ${retryAfter}s...`)
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000))
      return finedgeClient.request(originalRequest)
    }

    // Handle 401 Unauthorized (Redirect to login)
    if (status === 401) {
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
    }

    // Handle 503 Service Unavailable (e.g. maintenance window)
    if (status === 503) {
      console.error('[FinEdge Client] System is under maintenance.')
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('finedge-maintenance', { detail: true })
        window.dispatchEvent(event)
      }
    }

    return Promise.reject(error)
  }
)

export default finedgeClient
