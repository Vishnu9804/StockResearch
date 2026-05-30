/**
 * backend/src/controllers/finedge.ts
 * HTTP Controller for FinEdge proxy endpoints
 */

import type { Request, Response, NextFunction } from 'express'
import { FinedgeService } from '../services/finedge.service.js'
import { logger } from '../utils/logger.js'

// Mock seed database fallback imports
import { companies } from '../data/companies.js'
import { quarterlyResults, profitLoss, balanceSheet, cashFlow, shareholding } from '../data/financials.js'
import { corporateActions, upcomingEvents, dividendHistory } from '../data/corporate-actions.js'
import { marketIndices, sectorPerformance, gainers, losers } from '../data/market.js'
import { variables } from '../data/screener.js'

export async function proxyRequest(req: Request, res: Response, _next: NextFunction): Promise<any> {
  const endpoint = req.params[0]
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`

  try {
    const data = await FinedgeService.executeProxyRequest(
      req.method,
      endpoint,
      req.query as Record<string, any>,
      req.body,
      requestId
    )
    return res.status(200).json(data)
  } catch (err: any) {
    logger.warn(`[Proxy Controller] External API bypass or exception: ${err.message}. Invoking local seed database fallbacks...`)

    try {
      // Mock Fallback Resolvers (Must perfectly match original fallback behavior)
      if (endpoint.includes('search')) {
        const q = (req.query.q as string || '').toUpperCase()
        const matches = companies.filter(c => c.symbol.includes(q) || c.name.toUpperCase().includes(q))
        return res.status(200).json({ success: true, results: matches.slice(0, 10) })
      }

      if (endpoint.includes('market/indices')) {
        return res.status(200).json({ success: true, indices: marketIndices })
      }

      if (endpoint.includes('market/movers')) {
        return res.status(200).json({ success: true, gainers: gainers.slice(0, 5), losers: losers.slice(0, 5) })
      }

      if (endpoint.includes('market/sectors')) {
        return res.status(200).json({ success: true, sectors: sectorPerformance })
      }

      if (endpoint.includes('screener/variables')) {
        return res.status(200).json({ success: true, variables })
      }

      if (endpoint.match(/company\/([a-zA-Z0-9_-]+)\/overview/i)) {
        const match = endpoint.match(/company\/([a-zA-Z0-9_-]+)\/overview/i)
        const symbol = match ? match[1].toUpperCase() : ''
        const comp = companies.find(c => c.symbol === symbol)
        if (!comp) return res.status(404).json({ error: true, message: 'Company not found' })
        return res.status(200).json({ success: true, data: comp })
      }

      if (endpoint.match(/company\/([a-zA-Z0-9_-]+)\/financials/i)) {
        const match = endpoint.match(/company\/([a-zA-Z0-9_-]+)\/financials/i)
        const symbol = match ? match[1].toUpperCase() : ''
        const comp = companies.find(c => c.symbol === symbol)
        if (!comp) return res.status(404).json({ error: true, message: 'Company not found' })
        
        return res.status(200).json({
          success: true,
          data: {
            symbol,
            quarterlyResults,
            profitLoss,
            balanceSheet,
            cashFlow,
            shareholding
          }
        })
      }

      if (endpoint.match(/company\/([a-zA-Z0-9_-]+)\/corporate-actions/i)) {
        return res.status(200).json({
          success: true,
          data: {
            corporateActions,
            upcomingEvents,
            dividendHistory
          }
        })
      }

      if (endpoint.includes('screener/run')) {
        return res.status(200).json({
          success: true,
          results: companies.map(c => ({
            symbol: c.symbol,
            name: c.name,
            sector: c.sector,
            marketCap: c.marketCap,
            pe: c.pe,
            dividendYield: c.dividendYield,
            roe: c.roe,
            roce: c.roce,
            debtToEquity: c.debtToEquity,
            cmp: c.price,
            changePct: c.changePct
          })),
          totalCount: companies.length
        })
      }

      // Default seed proxy structure
      return res.status(200).json({ success: true, message: 'Endpoint resolved via default local mock seed format.', data: {} })
    } catch (fallbackErr: any) {
      logger.error(`[Proxy Controller] Fallback resolver crashed for ${endpoint}: ${fallbackErr.message}`)
      return res.status(500).json({
        error: true,
        message: 'Failed to resolve proxy request or seed fallback databases.',
        details: fallbackErr.message,
        requestId
      })
    }
  }
}
