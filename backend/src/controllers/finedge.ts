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

export async function getCompanyProfile(req: Request, res: Response): Promise<any> {
  const { symbol } = req.params
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`
  try {
    const data = await FinedgeService.executeProxyRequest(
      'GET',
      `company-profile/${symbol}`,
      req.query as Record<string, any>,
      req.body,
      requestId
    )
    return res.status(200).json(data)
  } catch (err: any) {
    logger.warn(`[Proxy Controller] Bypassing company-profile/${symbol} to local fallback: ${err.message}`)
    const comp = companies.find(c => c.symbol === symbol.toUpperCase())
    if (!comp) return res.status(404).json({ error: true, message: 'Company profile not found' })
    return res.status(200).json(comp)
  }
}

export async function getCompanyPL(req: Request, res: Response): Promise<any> {
  const { symbol } = req.params
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`
  try {
    const data = await FinedgeService.executeProxyRequest(
      'GET',
      `financials/${symbol}`,
      { ...req.query, statement_code: 'pl' },
      req.body,
      requestId
    )
    return res.status(200).json(data)
  } catch (err: any) {
    logger.warn(`[Proxy Controller] Bypassing financials/pl for ${symbol} to local fallback: ${err.message}`)
    return res.status(200).json(profitLoss)
  }
}

export async function getCompanyBalanceSheet(req: Request, res: Response): Promise<any> {
  const { symbol } = req.params
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`
  try {
    const data = await FinedgeService.executeProxyRequest(
      'GET',
      `financials/${symbol}`,
      { ...req.query, statement_code: 'bs' },
      req.body,
      requestId
    )
    return res.status(200).json(data)
  } catch (err: any) {
    logger.warn(`[Proxy Controller] Bypassing financials/balance-sheet for ${symbol} to local fallback: ${err.message}`)
    return res.status(200).json(balanceSheet)
  }
}

export async function getCompanyCashFlow(req: Request, res: Response): Promise<any> {
  const { symbol } = req.params
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`
  try {
    const data = await FinedgeService.executeProxyRequest(
      'GET',
      `financials/${symbol}`,
      { ...req.query, statement_code: 'cf' },
      req.body,
      requestId
    )
    return res.status(200).json(data)
  } catch (err: any) {
    logger.warn(`[Proxy Controller] Bypassing financials/cash-flow for ${symbol} to local fallback: ${err.message}`)
    return res.status(200).json(cashFlow)
  }
}

export async function getCompanySegments(req: Request, res: Response): Promise<any> {
  const { symbol } = req.params
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`
  try {
    const data = await FinedgeService.executeProxyRequest(
      'GET',
      `segment-revenue/${symbol}`,
      req.query as Record<string, any>,
      req.body,
      requestId
    )
    return res.status(200).json(data)
  } catch (err: any) {
    logger.warn(`[Proxy Controller] Bypassing segment-revenue/${symbol} to local fallback: ${err.message}`)
    return res.status(200).json({
      success: true,
      symbol,
      segments: [
        { name: 'Diversified FMCG Products', revenuePercentage: 65, revenue: 15200 },
        { name: 'Paperboards & Packaging', revenuePercentage: 20, revenue: 4670 },
        { name: 'Hotels & Agri-Business', revenuePercentage: 15, revenue: 3500 }
      ]
    })
  }
}

export async function getCompanyRatios(req: Request, res: Response): Promise<any> {
  const { symbol } = req.params
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`
  try {
    const data = await FinedgeService.executeProxyRequest(
      'GET',
      `ratios/${symbol}`,
      req.query as Record<string, any>,
      req.body,
      requestId
    )
    return res.status(200).json(data)
  } catch (err: any) {
    logger.warn(`[Proxy Controller] Bypassing ratios/${symbol} to local fallback: ${err.message}`)
    const comp = companies.find(c => c.symbol === symbol.toUpperCase())
    const pe = comp?.pe || 25.4
    const dividendYield = comp?.dividendYield || 1.34
    const roe = comp?.roe || 18.5
    const roce = comp?.roce || 22.1
    const debtToEquity = comp?.debtToEquity || 0.05
    return res.status(200).json({
      success: true,
      symbol,
      valuation: { pe, pb: 4.8, evEbitda: 15.2, marketCapSales: 5.1 },
      profitability: { roe, roce, netMargin: 16.5, ebitdaMargin: 24.2 },
      efficiency: { assetTurnover: 1.1, inventoryDays: 45, debtorDays: 30 },
      leverage: { debtToEquity, interestCoverage: 45.0, currentRatio: 2.8 },
      growth: { revenueCagr3Y: 12.4, profitCagr3Y: 15.6, epsCagr: 14.8 }
    })
  }
}

export async function getCompanyShareholding(req: Request, res: Response): Promise<any> {
  const { symbol } = req.params
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`
  try {
    const data = await FinedgeService.executeProxyRequest(
      'GET',
      `shareholdings/pattern/${symbol}`,
      req.query as Record<string, any>,
      req.body,
      requestId
    )
    return res.status(200).json(data)
  } catch (err: any) {
    logger.warn(`[Proxy Controller] Bypassing shareholding/${symbol} to local fallback: ${err.message}`)
    return res.status(200).json(shareholding)
  }
}

export async function getCorporateActions(req: Request, res: Response): Promise<any> {
  const { symbol } = req.params
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`
  try {
    const data = await FinedgeService.executeProxyRequest(
      'GET',
      `corporate-actions/all`,
      { ...req.query, symbol },
      req.body,
      requestId
    )
    return res.status(200).json(data)
  } catch (err: any) {
    logger.warn(`[Proxy Controller] Bypassing corporate actions for ${symbol} to local fallback: ${err.message}`)
    return res.status(200).json({
      success: true,
      corporateActions,
      upcomingEvents,
      dividendHistory
    })
  }
}

export async function getCompanyDocuments(req: Request, res: Response): Promise<any> {
  const { symbol } = req.params
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`
  try {
    const data = await FinedgeService.executeProxyRequest(
      'GET',
      `corp-announcements`,
      { ...req.query, symbol },
      req.body,
      requestId
    )
    return res.status(200).json(data)
  } catch (err: any) {
    logger.warn(`[Proxy Controller] Bypassing documents for ${symbol} to local fallback: ${err.message}`)
    return res.status(200).json({
      success: true,
      symbol,
      documents: [
        { id: 'doc-1', title: `Annual Report FY25-26 - ${symbol}`, type: 'Annual Report', date: '2026-05-15', fileUrl: '#' },
        { id: 'doc-2', title: `Q4 FY25 Investor Presentation`, type: 'Investor Presentation', date: '2026-04-28', fileUrl: '#' },
        { id: 'doc-3', title: `Investor Call Audio & Transcript - Q4 FY25`, type: 'Transcript', date: '2026-04-29', fileUrl: '#' },
        { id: 'doc-4', title: `ICRA Credit Rating Upgrade - Stable Outlook`, type: 'Credit Rating', date: '2026-03-12', fileUrl: '#' }
      ]
    })
  }
}

export async function getStockSymbols(req: Request, res: Response): Promise<any> {
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`
  try {
    const data = await FinedgeService.executeProxyRequest(
      'GET',
      `stock-symbols`,
      req.query as Record<string, any>,
      req.body,
      requestId
    )
    return res.status(200).json(data)
  } catch (err: any) {
    logger.warn(`[Proxy Controller] Bypassing stock-symbols to local fallback: ${err.message}`)
    const symbols = companies.map(c => ({
      symbol: c.symbol,
      name: c.name,
      nse_code: c.symbol,
      bse_code: c.symbol === 'ITC' ? '500875' : '',
      consolidated_ind: true
    }))
    return res.status(200).json(symbols)
  }
}
