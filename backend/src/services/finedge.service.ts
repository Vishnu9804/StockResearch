/**
 * backend/src/services/finedge.service.ts
 * High-reliability proxy service for institutional FinEdge APIs
 * Implements exponential backoff retries, request deduplication,
 * rotating API keys, and a pluggable TTL caching layer.
 */

import axios, { type AxiosRequestConfig } from 'axios'
import { CONFIG } from '../config/index.js'
import { logger } from '../utils/logger.js'

// 1. Pluggable Cache Interface & In-Memory Implementation
export interface CacheStore {
  get<T>(key: string): T | null
  set<T>(key: string, value: T, ttlMs: number): void
  delete(key: string): void
  clear(): void
}

export class MemoryCacheStore implements CacheStore {
  private cache = new Map<string, { value: any; expiresAt: number }>()

  public get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.delete(key)
      return null
    }
    return entry.value as T
  }

  public set<T>(key: string, value: T, ttlMs: number): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    })
  }

  public delete(key: string): void {
    this.cache.delete(key)
  }

  public clear(): void {
    this.cache.clear()
  }
}

// Pluggable cache instance (can easily swap to RedisCacheStore here in production)
const cacheStore: CacheStore = new MemoryCacheStore()

// 2. Request Deduplication Registry
const activeRequests = new Map<string, Promise<any>>()

// 3. API Key Rotation Handler
let keyIndex = 0
function getApiKey(): string {
  const keys = CONFIG.FINEDGE_API_KEYS
  const key = keys[keyIndex % keys.length]
  keyIndex++
  return key
}

/**
 * Executes a network task with exponential backoff retries
 */
async function executeWithRetry<T>(
  taskFn: () => Promise<T>,
  retries = 3,
  delayMs = 1000,
  backoffFactor = 2
): Promise<T> {
  try {
    return await taskFn()
  } catch (error: any) {
    if (retries <= 0) {
      throw error
    }
    // Only retry on network errors or 5xx server exceptions
    const statusCode = error.response?.status
    const isRetryable = !statusCode || (statusCode >= 500 && statusCode < 600) || statusCode === 429

    if (!isRetryable) {
      throw error
    }

    logger.warn(
      `[FinEdge API] Request failed (${error.message}). Retrying in ${delayMs}ms... (${retries} attempts left)`
    )
    await new Promise((resolve) => setTimeout(resolve, delayMs))
    return executeWithRetry(taskFn, retries - 1, delayMs * backoffFactor, backoffFactor)
  }
}

export const FinedgeService = {
  /**
   * Main Proxy executor targeting FinEdge API
   */
  async executeProxyRequest(
    method: string,
    endpoint: string,
    query: Record<string, any>,
    body: any,
    requestId: string
  ): Promise<any> {
    const cacheKey = `${method}:${endpoint}:${JSON.stringify(query)}:${JSON.stringify(body)}`

    // 1. Resolve from Caching layer
    const cached = cacheStore.get(cacheKey)
    if (cached) {
      logger.info(`[FinedgeService] Cache HIT for key: ${cacheKey}`)
      return cached
    }

    // 2. Deduplicate simultaneous active requests
    let activePromise = activeRequests.get(cacheKey)
    if (activePromise) {
      logger.info(`[FinedgeService] Request deduplicated. Merging to active promise for: ${cacheKey}`)
      return activePromise
    }

    // Determine if we have actual API keys configured (reject any placeholder starting with 'demo-key')
    const keysSet = CONFIG.FINEDGE_API_KEYS.some((k) => k && !k.startsWith('demo-key'))

    if (!keysSet) {
      // If no valid API key is set, immediately throw so proxy can fall back to seed database
      throw new Error('API Key missing or set to demo-key-1. Bypassing to local seed databases.')
    }

    // 3. Create fresh request with retry policies
    const requestTask = async () => {
      const apiKey = getApiKey()
      let cleanEndpoint = endpoint
      if (cleanEndpoint.startsWith('/')) {
        cleanEndpoint = cleanEndpoint.slice(1)
      }
      if (cleanEndpoint.startsWith('api/v1/')) {
        cleanEndpoint = cleanEndpoint.slice(7)
      }

      logger.info(`[FinedgeService] Proxied Request: [${method}] /api/v1/${cleanEndpoint}`)

      const axiosConfig: AxiosRequestConfig = {
        method,
        url: `${CONFIG.FINEDGE_BASE_URL}/api/v1/${cleanEndpoint}`,
        headers: {
          'X-Request-ID': requestId,
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'X-API-Key': apiKey,
        },
        params: {
          ...query,
          token: apiKey,
        },
        paramsSerializer: {
          serialize: (params) => {
            const searchParams = new URLSearchParams()
            for (const key in params) {
              const val = params[key]
              if (Array.isArray(val)) {
                for (const item of val) {
                  searchParams.append(key, item)
                }
              } else if (val !== undefined && val !== null) {
                searchParams.append(key, String(val))
              }
            }
            return searchParams.toString()
          }
        },
        data: body,
        timeout: 15000,
      }

      const response = await axios(axiosConfig)

      // ─── Smart TTL Cache Strategy (Production-Grade) ──────────────────────────
      // Data is categorized by how frequently it changes in real markets
      const ep = endpoint.toLowerCase()

      let ttl: number

      // Tier 1: Live market feeds — very short TTL (data changes every few seconds)
      if (ep.includes('quote') && !ep.includes('daily-quote')) {
        // End-of-day reset: cache until midnight IST
        const now = new Date()
        const midnight = new Date()
        midnight.setHours(23, 59, 59, 999)
        ttl = midnight.getTime() - now.getTime() // ~0–24 hours, resets each day
      }
      // Tier 2: Index/market data — short TTL (daily feed, updated once per day EOD)
      else if (ep.includes('index/market-price/daily-feed') || ep.includes('market/movers')) {
        ttl = 15 * 60 * 1000 // 15 minutes
      }
      // Tier 3: Announcements, ratings, results calendar — medium TTL
      else if (
        ep.includes('corp-announcements') ||
        ep.includes('credit-ratings') ||
        ep.includes('results-calendar') ||
        ep.includes('investor-call') ||
        ep.includes('investor-pres')
      ) {
        ttl = 30 * 60 * 1000 // 30 minutes
      }
      // Tier 4: Corporate actions, IPO, holidays — update a few times per day
      else if (
        ep.includes('corporate-actions') ||
        ep.includes('ipo-calendar') ||
        ep.includes('dividend') ||
        ep.includes('index/price-returns')
      ) {
        ttl = 2 * 60 * 60 * 1000 // 2 hours
      }
      // Tier 5: Fundamentals — stable, update quarterly/annually
      else if (
        ep.includes('financials') ||
        ep.includes('basic-financials') ||
        ep.includes('financial-metrics') ||
        ep.includes('ratios') ||
        ep.includes('segment-revenue') ||
        ep.includes('notes') ||
        ep.includes('annual-price-ratios') ||
        ep.includes('daily-quotes') ||
        ep.includes('daily-price-ratios') ||
        ep.includes('shareholding') ||
        ep.includes('ownership') ||
        ep.includes('peers')
      ) {
        ttl = 4 * 60 * 60 * 1000 // 4 hours
      }
      // Tier 6: Master/reference data — very stable, rarely changes
      else if (
        ep.includes('company-profile') ||
        ep.includes('stock-symbols') ||
        ep.includes('stock-search') ||
        ep.includes('index/master') ||
        ep.includes('commodity-list') ||
        ep.includes('holidays-calendar') ||
        ep.includes('name-changes') ||
        ep.includes('symbol-changes')
      ) {
        ttl = 24 * 60 * 60 * 1000 // 24 hours
      }
      // Default: 10 minutes for anything not categorized above
      else {
        ttl = 10 * 60 * 1000
      }

      // Store in Cache
      cacheStore.set(cacheKey, response.data, ttl)
      return response.data
    }

    // Register active promise, execute task with backoff, and clean up active requests registry
    activePromise = executeWithRetry(requestTask)
      .finally(() => {
        activeRequests.delete(cacheKey)
      })

    activeRequests.set(cacheKey, activePromise)
    return activePromise
  },
}

export default FinedgeService
