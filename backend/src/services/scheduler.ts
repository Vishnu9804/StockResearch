import cron from 'node-cron'
import { prisma } from '../utils/prisma.js'
import { logger } from '../utils/logger.js'
import { companies } from './../data/companies.js'

// Simple Query Compiler & Evaluator
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
      const val1 = parseFloat(betweenMatch[2])
      const val2 = parseFloat(betweenMatch[3])
      clauses.push({ field, operator: 'between', value: val1, value2: val2 })
      continue
    }

    const opMatch = token.match(/^([a-zA-Z0-9_\s]+)\s*(>=|<=|>|<|=|!=)\s*(\d+(?:\.\d+)?)$/i)
    if (opMatch) {
      const field = opMatch[1].trim().toLowerCase().replace(/\s+/g, '')
      const op = opMatch[2]
      const val = parseFloat(opMatch[3])
      clauses.push({ field, operator: op, value: val })
      continue
    }
  }

  return clauses
}

function getCompanyValue(company: any, field: string): number | null {
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

function evaluateFilter(companyVal: number, operator: string, value: number, value2?: number): boolean {
  switch (operator) {
    case '>':
      return companyVal > value
    case '>=':
      return companyVal >= value
    case '<':
      return companyVal < value
    case '<=':
      return companyVal <= value
    case '=':
      return companyVal === value
    case '!=':
      return companyVal !== value
    case 'between':
      return value2 !== undefined ? companyVal >= value && companyVal <= value2 : false
    default:
      return false
  }
}

// Background Task: Evaluate Saved Screens & Dispatch Alerts
async function runScreenerAlertsTask(): Promise<void> {
  logger.info('[Scheduler] Evaluating saved screens alerts...')
  
  try {
    const activeScreens = await prisma.savedScreen.findMany({
      where: { alertEnabled: true },
      include: { user: true }
    })

    logger.info(`[Scheduler] Found ${activeScreens.length} screens to analyze.`)

    for (const screen of activeScreens) {
      const clauses = parseQueryText(screen.queryText)
      if (clauses.length === 0) continue

      // Filter local companies based on screen query
      let matches = [...companies]
      for (const clause of clauses) {
        matches = matches.filter((c) => {
          const compVal = getCompanyValue(c, clause.field)
          if (compVal === null) return false
          return evaluateFilter(compVal, clause.operator, clause.value, clause.value2)
        })
      }

      if (matches.length > 0) {
        const symbols = matches.map(m => m.symbol)
        logger.info(`[Scheduler] Match found! Screen "${screen.name}" of User ${screen.user.email} matched stocks: ${symbols.join(', ')}`)

        // 1. Log in DB as in-app Notification
        await prisma.notification.create({
          data: {
            userId: screen.userId,
            type: 'alert',
            title: `Screener Match: ${screen.name}`,
            body: `Your saved stock screener query "${screen.name}" found ${matches.length} matching corporations: ${symbols.slice(0, 3).join(', ')}${symbols.length > 3 ? '...' : ''}. Click to view details.`,
            symbol: symbols[0],
            actionUrl: `/screener/results?query=${encodeURIComponent(screen.queryText)}`
          }
        })

        // 2. Simulated Transactional Email Alert
        logger.info(`[SIMULATION] EMAIL SENT:
          To: ${screen.user.email}
          Subject: [FinScreen Alert] New matches for your screen: "${screen.name}"
          Body: Hello ${screen.user.name},\n\nYour alert criteria "${screen.queryText}" has matched these corporations:\n${symbols.map(s => ` - ${s}`).join('\n')}\n\nCheck live parameters on http://localhost:3000.\n\nBest,\nFinScreen Team`)

        // 3. Simulated Transactional SMS Alert
        logger.info(`[SIMULATION] SMS SENT to user ${screen.user.name}: [FinScreen] Alert: Your screen "${screen.name}" matched ${matches.length} stocks: ${symbols.slice(0, 3).join(', ')}. Details at http://localhost:3000.`)
      }
    }
  } catch (error: any) {
    logger.error(`[Scheduler] Error evaluating screener alerts: ${error.message}`)
  }
}

// Watchlist target price threshold alerts scanner
async function runWatchlistAlertsTask(): Promise<void> {
  logger.info('[Scheduler] Evaluating watchlist target price alerts...')
  
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
      const company = companies.find(c => c.symbol === item.symbol)
      if (!company || !item.targetPrice) continue

      // Simulate price variance checking
      const currentPrice = company.price
      const crossed = currentPrice >= item.targetPrice

      if (crossed) {
        logger.info(`[Scheduler] Watchlist Match! Ticker ${item.symbol} crossed target price ₹${item.targetPrice}. Current: ₹${currentPrice}`)

        // Log Notification
        await prisma.notification.create({
          data: {
            userId: item.watchlist.userId,
            type: 'alert',
            title: `Price Alert: ${item.symbol}`,
            body: `${company.name} (${item.symbol}) has crossed your target threshold of ₹${item.targetPrice.toLocaleString('en-IN')}. Current trading level: ₹${currentPrice.toLocaleString('en-IN')}.`,
            symbol: item.symbol,
            actionUrl: `/company/${item.symbol}`
          }
        })

        // Disable alert so it doesn't fire repeatedly
        await prisma.watchlistItem.update({
          where: { id: item.id },
          data: { alertEnabled: false }
        })

        logger.info(`[SIMULATION] EMAIL SENT:
          To: ${item.watchlist.user.email}
          Subject: [FinScreen Alert] Price Target Crossed: ${item.symbol}
          Body: Hello ${item.watchlist.user.name},\n\nStock ${item.symbol} crossed your alert threshold of ₹${item.targetPrice}. Live price: ₹${currentPrice}.\n\nManage alerts at http://localhost:3000.\n\nBest,\nFinScreen Team`)
      }
    }
  } catch (error: any) {
    logger.error(`[Scheduler] Error running watchlist scanner: ${error.message}`)
  }
}

export function startScheduler(): void {
  logger.info('[Scheduler] Initializing cron alert scheduler (every 5 minutes)...')
  
  // Run every 5 minutes in development for presentations
  cron.schedule('*/5 * * * *', async () => {
    await runScreenerAlertsTask()
    await runWatchlistAlertsTask()
  })

  // Run immediately once on start to populate alerts
  setTimeout(async () => {
    await runScreenerAlertsTask()
    await runWatchlistAlertsTask()
  }, 10000)
}
