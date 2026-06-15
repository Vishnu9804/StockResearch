/**
 * backend/src/services/scheduler.ts
 * Background cron scheduler for screen alerts and watchlist price alerts.
 * Uses live FinEdge API quotes — no seed/mock data.
 */

import cron from 'node-cron'
import { prisma } from '../utils/prisma.js'
import { logger } from '../utils/logger.js'
import { FinedgeService } from './finedge.service.js'

// ─── Query Parser ─────────────────────────────────────────────────────────────

interface ParsedClause {
  field: string
  operator: string
  value: number
  value2?: number
}

function parseQueryText(queryText: string): ParsedClause[] {
  if (!queryText.trim()) return []

  const clauses: ParsedClause[] = []
  const tokens = queryText.split(/\bAND\b/i)

  for (let token of tokens) {
    token = token.trim()
    if (!token) continue

    const betweenMatch = token.match(/^([a-zA-Z0-9_\s]+)\s+between\s+(\d+(?:\.\d+)?)\s+and\s+(\d+(?:\.\d+)?)$/i)
    if (betweenMatch) {
      const field = betweenMatch[1].trim().toLowerCase().replace(/\s+/g, '')
      clauses.push({ field, operator: 'between', value: parseFloat(betweenMatch[2]), value2: parseFloat(betweenMatch[3]) })
      continue
    }

    const opMatch = token.match(/^([a-zA-Z0-9_\s]+)\s*(>=|<=|>|<|=|!=)\s*(\d+(?:\.\d+)?)$/i)
    if (opMatch) {
      const field = opMatch[1].trim().toLowerCase().replace(/\s+/g, '')
      clauses.push({ field, operator: opMatch[2], value: parseFloat(opMatch[3]) })
      continue
    }
  }

  return clauses
}

function getCompanyValue(company: Record<string, any>, field: string): number | null {
  const mapping: Record<string, string> = {
    marketcap: 'marketCap',
    pe: 'pe',
    peratio: 'pe',
    pb: 'pb',
    pbratio: 'pb',
    divyield: 'dividendYield',
    dividendyield: 'dividendYield',
    roe: 'roe',
    roce: 'roce',
    debttoequity: 'debtToEquity',
    de: 'debtToEquity',
    deratio: 'debtToEquity',
    salesgrowth3y: 'salesGrowth3Y',
    profitgrowth3y: 'profitGrowth3Y',
    netprofitmargin: 'netProfitMargin',
    ebitdamargin: 'ebitdaMargin',
    promoterholding: 'promoterHolding',
    fiiholding: 'fiiHolding',
    currentratio: 'currentRatio',
    interestcoverage: 'interestCoverage',
    cmp: 'price',
    price: 'price',
    eps: 'eps',
    bookvalue: 'bookValue',
    rsi14: 'rsi14',
    beta: 'beta',
  }
  const mappedField = mapping[field] || field
  const val = company[mappedField]
  return typeof val === 'number' ? val : null
}

function evaluateFilter(val: number, operator: string, value: number, value2?: number): boolean {
  switch (operator) {
    case '>': return val > value
    case '>=': return val >= value
    case '<': return val < value
    case '<=': return val <= value
    case '=': return val === value
    case '!=': return val !== value
    case 'between': return value2 !== undefined ? val >= value && val <= value2 : false
    default: return false
  }
}

// ─── Live Stock Universe Fetch ────────────────────────────────────────────────

async function fetchLiveStockUniverse(): Promise<Record<string, any>[]> {
  try {
    const requestId = `scheduler_${Date.now()}`
    const data = await FinedgeService.executeProxyRequest('GET', 'stock-symbols', {}, {}, requestId)
    // stock-symbols returns list of symbols; we need to fetch quotes for screener evaluation
    // Use the screener/run endpoint directly for filtering
    return Array.isArray(data) ? data : (data?.results || data?.data || [])
  } catch (err: any) {
    logger.warn(`[Scheduler] Could not fetch live stock universe: ${err.message}`)
    return []
  }
}

async function fetchLiveScreenerResults(queryText: string): Promise<Record<string, any>[]> {
  try {
    const requestId = `screener_${Date.now()}`
    const data = await FinedgeService.executeProxyRequest('POST', 'screener/run', {}, { query: queryText }, requestId)
    return data?.results || data?.data || []
  } catch (err: any) {
    logger.warn(`[Scheduler] Live screener run failed: ${err.message}`)
    return []
  }
}

async function fetchLiveQuote(symbol: string): Promise<Record<string, any> | null> {
  try {
    const requestId = `quote_${symbol}_${Date.now()}`
    const data = await FinedgeService.executeProxyRequest('GET', 'quote', { symbol }, {}, requestId)
    return data?.data || data || null
  } catch (err: any) {
    logger.warn(`[Scheduler] Could not fetch live quote for ${symbol}: ${err.message}`)
    return null
  }
}

// ─── Screener Alert Task ──────────────────────────────────────────────────────

async function runScreenerAlertsTask(): Promise<void> {
  logger.info('[Scheduler] Evaluating saved screens alerts via live FinEdge data...')

  try {
    const activeScreens = await prisma.savedScreen.findMany({
      where: { alertEnabled: true },
      include: { user: true }
    })

    logger.info(`[Scheduler] Found ${activeScreens.length} screens to analyze.`)

    for (const screen of activeScreens) {
      const clauses = parseQueryText(screen.queryText)
      if (clauses.length === 0) continue

      // Use FinEdge screener/run endpoint with the raw query string
      const liveResults = await fetchLiveScreenerResults(screen.queryText)

      // If the live screener returns results directly, use them
      // Otherwise fall back to local clause evaluation on stock-symbols data
      let matches: Record<string, any>[] = []

      if (liveResults.length > 0) {
        matches = liveResults
      } else {
        // Evaluate clauses locally against basic quote data (best-effort)
        const universe = await fetchLiveStockUniverse()
        matches = universe.filter((company) => {
          return clauses.every((clause) => {
            const val = getCompanyValue(company, clause.field)
            if (val === null) return false
            return evaluateFilter(val, clause.operator, clause.value, clause.value2)
          })
        })
      }

      if (matches.length > 0) {
        const symbols = matches.map((m) => m.symbol || m.nse_code).filter(Boolean)
        logger.info(`[Scheduler] Match found! Screen "${screen.name}" → ${symbols.join(', ')}`)

        await prisma.notification.create({
          data: {
            userId: screen.userId,
            type: 'alert',
            title: `Screener Match: ${screen.name}`,
            body: `Your saved screen "${screen.name}" found ${matches.length} matching stocks: ${symbols.slice(0, 3).join(', ')}${symbols.length > 3 ? '...' : ''}. Click to view details.`,
            symbol: symbols[0],
            actionUrl: `/screener/results?query=${encodeURIComponent(screen.queryText)}`
          }
        })

        logger.info(`[SIMULATION] EMAIL SENT:
          To: ${screen.user.email}
          Subject: [FinScreen Alert] New matches for your screen: "${screen.name}"
          Body: Hello ${screen.user.name},\n\nYour alert criteria "${screen.queryText}" has matched these corporations:\n${symbols.map(s => ` - ${s}`).join('\n')}\n\nCheck live parameters on http://localhost:3000.\n\nBest,\nFinScreen Team`)

        logger.info(`[SIMULATION] SMS SENT to user ${screen.user.name}: [FinScreen] Alert: Your screen "${screen.name}" matched ${matches.length} stocks: ${symbols.slice(0, 3).join(', ')}. Details at http://localhost:3000.`)
      }
    }
  } catch (error: any) {
    logger.error(`[Scheduler] Error evaluating screener alerts: ${error.message}`)
  }
}

// ─── Watchlist Price Alert Task ───────────────────────────────────────────────

async function runWatchlistAlertsTask(): Promise<void> {
  logger.info('[Scheduler] Evaluating watchlist target price alerts via live FinEdge quotes...')

  try {
    const alertItems = await prisma.watchlistItem.findMany({
      where: { alertEnabled: true },
      include: {
        watchlist: {
          include: { user: true }
        }
      }
    })

    logger.info(`[Scheduler] Found ${alertItems.length} active watchlist alarms to scan.`)

    for (const item of alertItems) {
      if (!item.targetPrice) continue

      // Fetch live quote from FinEdge
      const quote = await fetchLiveQuote(item.symbol)
      if (!quote) continue

      const currentPrice: number = quote.price ?? quote.ltp ?? quote.lastPrice ?? 0
      if (!currentPrice) continue

      const crossed = currentPrice >= item.targetPrice

      if (crossed) {
        logger.info(`[Scheduler] Watchlist Match! ${item.symbol} crossed target ₹${item.targetPrice} (Live: ₹${currentPrice})`)

        const companyName = quote.name || quote.companyName || item.symbol

        await prisma.notification.create({
          data: {
            userId: item.watchlist.userId,
            type: 'alert',
            title: `Price Alert: ${item.symbol}`,
            body: `${companyName} (${item.symbol}) has crossed your target of ₹${item.targetPrice.toLocaleString('en-IN')}. Live price: ₹${currentPrice.toLocaleString('en-IN')}.`,
            symbol: item.symbol,
            actionUrl: `/company/${item.symbol}`
          }
        })

        // Disable so it doesn't fire repeatedly
        await prisma.watchlistItem.update({
          where: { id: item.id },
          data: { alertEnabled: false }
        })

        logger.info(`[SIMULATION] EMAIL SENT:
          To: ${item.watchlist.user.email}
          Subject: [FinScreen Alert] Price Target Crossed: ${item.symbol}
          Body: Hello ${item.watchlist.user.name},\n\n${item.symbol} crossed your target of ₹${item.targetPrice}. Live price: ₹${currentPrice}.\n\nManage alerts at http://localhost:3000.\n\nBest,\nFinScreen Team`)
      }
    }
  } catch (error: any) {
    logger.error(`[Scheduler] Error running watchlist scanner: ${error.message}`)
  }
}

// ─── Scheduler Initializer ────────────────────────────────────────────────────

export function startScheduler(): void {
  logger.info('[Scheduler] Initializing cron alert scheduler (every 5 minutes)...')

  cron.schedule('*/5 * * * *', async () => {
    await runScreenerAlertsTask()
    await runWatchlistAlertsTask()
  })

  // Run once on startup after 10s (give FinEdge API time to be ready)
  setTimeout(async () => {
    await runScreenerAlertsTask()
    await runWatchlistAlertsTask()
  }, 10000)
}
