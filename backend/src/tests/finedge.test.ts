/**
 * backend/src/tests/finedge.test.ts
 * FinEdge Service caching, request deduplication, and rotating API key tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'

// Mock Axios
vi.mock('axios', () => {
  return {
    default: vi.fn(() => Promise.resolve({ data: { success: true, mockData: 'telemetry' } })),
  }
})

// Mock CONFIG
vi.mock('../config/index.js', () => ({
  CONFIG: {
    FINEDGE_API_KEYS: ['key-alpha', 'key-beta', 'key-gamma'],
    FINEDGE_BASE_URL: 'https://data.mockapi.com',
  },
}))

import { FinedgeService, MemoryCacheStore } from '../services/finedge.service.js'

describe('FinedgeService Performance Layers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear active request promise map in cache
    const cache = new MemoryCacheStore()
    cache.clear()
  })

  it('should rotate API keys correctly on consecutive network requests', async () => {
    const mockAxios = vi.mocked(axios)
    
    // Call 1
    await FinedgeService.executeProxyRequest('GET', 'market/indices', {}, {}, 'req-1')
    // Call 2 (Wait dynamic cache expiry or use unique keys to trigger actual network calls)
    await FinedgeService.executeProxyRequest('GET', 'market/movers', {}, {}, 'req-2')
    // Call 3
    await FinedgeService.executeProxyRequest('GET', 'screener/variables', {}, {}, 'req-3')

    expect(mockAxios).toHaveBeenCalledTimes(3)

    // Verify key rotation: alpha, beta, gamma
    const firstCallParams = (mockAxios.mock.calls[0][0] as any).params
    const secondCallParams = (mockAxios.mock.calls[1][0] as any).params
    const thirdCallParams = (mockAxios.mock.calls[2][0] as any).params

    expect(firstCallParams?.['token']).toBe('key-alpha')
    expect(secondCallParams?.['token']).toBe('key-beta')
    expect(thirdCallParams?.['token']).toBe('key-gamma')
  })

  it('should deduplicate multiple concurrent requests to the exact same endpoint', async () => {
    const mockAxios = vi.mocked(axios)

    // Trigger three calls simultaneously
    const p1 = FinedgeService.executeProxyRequest('GET', 'financials/TCS', { q: '1' }, {}, 'req-abc')
    const p2 = FinedgeService.executeProxyRequest('GET', 'financials/TCS', { q: '1' }, {}, 'req-abc')
    const p3 = FinedgeService.executeProxyRequest('GET', 'financials/TCS', { q: '1' }, {}, 'req-abc')

    const [r1, r2, r3] = await Promise.all([p1, p2, p3])

    // Verify only 1 axios call was sent out
    expect(mockAxios).toHaveBeenCalledTimes(1)
    expect(r1).toEqual(r2)
    expect(r3).toEqual(r1)
  })

  it('should read from local TTL cache to avoid duplicate API calls', async () => {
    const mockAxios = vi.mocked(axios)

    // Initial request (Cache miss, triggers network)
    const data1 = await FinedgeService.executeProxyRequest('GET', 'company/RELIANCE/overview', {}, {}, 'req-x')
    
    // Consecutive request (Cache hit, resolves from cache)
    const data2 = await FinedgeService.executeProxyRequest('GET', 'company/RELIANCE/overview', {}, {}, 'req-y')

    expect(mockAxios).toHaveBeenCalledTimes(1)
    expect(data1).toEqual(data2)
  })
})
