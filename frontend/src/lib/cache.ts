/**
 * lib/cache.ts
 * Production-grade LocalStorage TTL caching layer for institutional financial feeds
 */

interface CacheEntry<T> {
  data: T
  expiresAt: number
  cachedAt: number
}

export const TTL = {
  FUNDAMENTALS: 24 * 60 * 60 * 1000,   // 24 hours
  LIVE_PRICE: 60 * 1000,                // 60 seconds
  QUARTERLY: 6 * 60 * 60 * 1000,       // 6 hours
  SHORT: 5 * 60 * 1000,                // 5 minutes
} as const

export type CacheTTL = keyof typeof TTL

export function getCached<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null

    const entry = JSON.parse(raw) as CacheEntry<T>
    const now = Date.now()

    if (now > entry.expiresAt) {
      localStorage.removeItem(key) // Expired
      return null
    }

    return entry.data
  } catch (e) {
    console.error(`Cache read error for key "${key}":`, e)
    return null
  }
}

export function setCached<T>(key: string, data: T, ttlType: CacheTTL): void {
  if (typeof window === 'undefined') return
  try {
    const now = Date.now()
    const entry: CacheEntry<T> = {
      data,
      cachedAt: now,
      expiresAt: now + TTL[ttlType],
    }
    localStorage.setItem(key, JSON.stringify(entry))
  } catch (e) {
    console.error(`Cache write error for key "${key}":`, e)
  }
}

export function invalidateCache(key: string): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(key)
  }
}

export function invalidateCacheByPrefix(prefix: string): void {
  if (typeof window === 'undefined') return
  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(prefix)) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key))
  } catch (e) {
    console.error(`Cache invalidation prefix error for "${prefix}":`, e)
  }
}
