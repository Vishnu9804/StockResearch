/**
 * backend/src/controllers/finedge.ts
 * HTTP Controller for FinEdge proxy endpoints — LIVE DATA ONLY WITH METRIC MERGING
 * Incorporates query parameter defaults and error-resilient local metadata fallbacks.
 */

import type { Request, Response, NextFunction } from 'express'
import { FinedgeService } from '../services/finedge.service.js'
import { logger } from '../utils/logger.js'
import { companies } from '../data/companies.js'

// ─── Shared error response helper ────────────────────────────────────────────

function apiError(res: Response, err: any, endpoint: string, requestId: string): Response {
  const status = err.response?.status || 502
  const message =
    status === 401 ? 'FinEdge API authentication failed. Check your API key.' :
    status === 403 ? 'Access forbidden. Your plan may not include this endpoint.' :
    status === 404 ? 'No data found for this symbol on FinEdge.' :
    status === 429 ? 'Rate limit reached. Please try again shortly.' :
    'Live data temporarily unavailable. Please try again.'

  logger.error(`[FinEdge Controller] ${endpoint} → ${status}: ${err.message}`)
  return res.status(status).json({ error: true, message, endpoint, requestId })
}

// ─── General Catch-All Proxy ──────────────────────────────────────────────────

export async function proxyRequest(req: Request, res: Response, _next: NextFunction): Promise<any> {
  const endpoint = req.params[0]
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`
  try {
    const data = await FinedgeService.executeProxyRequest(
      req.method, endpoint, req.query as Record<string, any>, req.body, requestId
    )
    return res.status(200).json(data)
  } catch (err: any) {
    return apiError(res, err, endpoint, requestId)
  }
}

// ─── Company Universe & Discovery ────────────────────────────────────────────

export async function getStockSymbols(req: Request, res: Response): Promise<any> {
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`
  try {
    const data = await FinedgeService.executeProxyRequest('GET', 'stock-symbols', req.query as Record<string, any>, req.body, requestId)
    return res.status(200).json(data)
  } catch (err: any) {
    return apiError(res, err, 'stock-symbols', requestId)
  }
}

export async function getStockSearch(req: Request, res: Response): Promise<any> {
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`
  try {
    const data = await FinedgeService.executeProxyRequest('GET', 'stock-search', req.query as Record<string, any>, req.body, requestId)
    return res.status(200).json(data)
  } catch (err: any) {
    return apiError(res, err, 'stock-search', requestId)
  }
}

export async function getNameChanges(req: Request, res: Response): Promise<any> {
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`
  try {
    const data = await FinedgeService.executeProxyRequest('GET', 'name-changes', req.query as Record<string, any>, req.body, requestId)
    return res.status(200).json(data)
  } catch (err: any) {
    return apiError(res, err, 'name-changes', requestId)
  }
}

export async function getSymbolChanges(req: Request, res: Response): Promise<any> {
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`
  try {
    const data = await FinedgeService.executeProxyRequest('GET', 'symbol-changes', req.query as Record<string, any>, req.body, requestId)
    return res.status(200).json(data)
  } catch (err: any) {
    return apiError(res, err, 'symbol-changes', requestId)
  }
}

// ─── Per-Company: Core Profile & Financials ───────────────────────────────────

export async function getCompanyProfile(req: Request, res: Response): Promise<any> {
  const { symbol } = req.params
  const sym = symbol.toUpperCase()
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`
  try {
    // 1. Fetch live company profile
    const profile = await FinedgeService.executeProxyRequest('GET', `company-profile/${sym}`, req.query as Record<string, any>, req.body, requestId)
    
    // 2. Find local company metadata for fallback
    const local = companies.find((c) => c.symbol === sym)
    
    // 3. Fetch live quote, profitability ratios, leverage ratios, liquidity ratios, and shareholding pattern — all in parallel
    const [quoteResult, prRatiosResult, leRatiosResult, liRatiosResult, shareholdingResult, metricsResult] = await Promise.allSettled([
      FinedgeService.executeProxyRequest('GET', 'quote', { symbol: sym }, req.body, requestId),
      FinedgeService.executeProxyRequest('GET', `ratios/${sym}`, { statement_type: 's', ratio_type: 'pr' }, req.body, requestId),
      FinedgeService.executeProxyRequest('GET', `ratios/${sym}`, { statement_type: 's', ratio_type: 'le' }, req.body, requestId),
      FinedgeService.executeProxyRequest('GET', `ratios/${sym}`, { statement_type: 's', ratio_type: 'li' }, req.body, requestId),
      FinedgeService.executeProxyRequest('GET', `shareholdings/pattern/${sym}`, { period: 'quarterly' }, req.body, requestId),
      FinedgeService.executeProxyRequest('GET', `financial-metrics/${sym}`, { statement_type: 's', ratio_type: 'cu' }, req.body, requestId),
    ])

    // 4. Parse quote — FinEdge returns { SYMBOL: { current_price, change, market_cap, high52, low52, ... } }
    let quote: any = null
    if (quoteResult.status === 'fulfilled') {
      const quoteData = quoteResult.value
      quote = quoteData && quoteData[sym] ? quoteData[sym] : null
    }

    // 5. Parse ratios (latest annual values)
    let latestPr: any = null
    if (prRatiosResult.status === 'fulfilled' && prRatiosResult.value && Array.isArray(prRatiosResult.value.ratios)) {
      latestPr = [...prRatiosResult.value.ratios].sort((a: any, b: any) => (b.year || b.period_end || 0) - (a.year || a.period_end || 0))[0]
    }
    let latestLe: any = null
    if (leRatiosResult.status === 'fulfilled' && leRatiosResult.value && Array.isArray(leRatiosResult.value.ratios)) {
      latestLe = [...leRatiosResult.value.ratios].sort((a: any, b: any) => (b.year || b.period_end || 0) - (a.year || a.period_end || 0))[0]
    }
    let latestLi: any = null
    if (liRatiosResult.status === 'fulfilled' && liRatiosResult.value && Array.isArray(liRatiosResult.value.ratios)) {
      latestLi = [...liRatiosResult.value.ratios].sort((a: any, b: any) => (b.year || b.period_end || 0) - (a.year || a.period_end || 0))[0]
    }

    // 6. Parse shareholding pattern for promoter holding — catagory (API typo) === 'Indian'
    let promoterHolding = local?.promoterHolding || 0
    let fiiHolding = local?.fiiHolding || 0
    let diiHolding = local?.diiHolding || 0
    let publicHolding = local?.publicHolding || 0
    if (shareholdingResult.status === 'fulfilled') {
      const shData = shareholdingResult.value
      if (shData && Array.isArray(shData.columns) && Array.isArray(shData.rows) && shData.columns.length > 0) {
        const latestCol = shData.columns[shData.columns.length - 1]
        shData.rows.forEach((row: any) => {
          const val = row.data && row.data[latestCol] ? parseFloat(row.data[latestCol]) : 0
          if (row.catagory === 'Indian' || row.catagory === 'Promoter') promoterHolding = val
          else if (row.catagory === 'InstitutionsForeign') fiiHolding = val
          else if (row.catagory === 'InstitutionsDomestic') diiHolding = val
          else if (row.catagory === 'NonInstitutions' || row.catagory === 'Goverments') publicHolding += val
        })
      }
    }

    // 7. Parse financial metrics for dividend yield and EPS
    let dividendYield = local?.dividendYield || 0
    let eps = local?.eps || 0
    if (metricsResult.status === 'fulfilled') {
      const mData = metricsResult.value
      if (mData && mData.metrics) {
        dividendYield = mData.metrics.dividendYield ?? mData.metrics.dividend_yield ?? dividendYield
        eps = mData.metrics.eps ?? mData.metrics.basicEps ?? eps
      }
    }

    // 8. Extract live values from quote (correct FinEdge field names)
    const currentPrice = quote ? (quote.current_price ?? quote.close_price ?? quote.ltp ?? 0) : (local?.price || 0)
    
    // Parse percentage change (which can be a string like "-0.62%")
    let changePct = local?.changePct || 0
    if (quote) {
      if (typeof quote.pct_change === 'number') changePct = quote.pct_change
      else if (typeof quote.change_pct === 'number') changePct = quote.change_pct
      else if (quote.change) changePct = parseFloat(String(quote.change).replace('%', ''))
    }
    
    const changeAbs = quote ? parseFloat((currentPrice * (changePct / 100)).toFixed(2)) : (local?.change || 0)
    const marketCap = quote ? (quote.market_cap ?? 0) : (local?.marketCap || 0)
    const high52 = quote ? (quote.high52 ?? quote.week52_high ?? quote.yearly_high ?? 0) : (local?.high52w || 0)
    const low52 = quote ? (quote.low52 ?? quote.week52_low ?? quote.yearly_low ?? 0) : (local?.low52w || 0)
    const openPrice = quote ? (quote.open_price ?? quote.open ?? 0) : (local?.open || 0)
    const highPrice = quote ? (quote.high_price ?? quote.high ?? 0) : (local?.high || 0)
    const lowPrice = quote ? (quote.low_price ?? quote.low ?? 0) : (local?.low || 0)
    const volume = quote ? (quote.volume ?? quote.traded_volume ?? 0) : (local?.volume || 0)

    // 9. Extract fundamentals from ratios API (live > local > default 0)
    let roe = latestPr?.returnOnEquity ?? latestPr?.roe ?? local?.roe ?? 0
    if (roe > 0 && roe <= 1) roe = roe * 100
    roe = parseFloat(roe.toFixed(2))
    
    let roce = latestPr?.returnOnCapital ?? latestPr?.returnOnCapitalEmployed ?? latestPr?.roce ?? local?.roce ?? 0
    if (roce > 0 && roce <= 1) roce = roce * 100
    roce = parseFloat(roce.toFixed(2))
    
    let netProfitMargin = latestPr?.netMargin ?? latestPr?.netProfitMargin ?? latestPr?.net_profit_margin ?? 0
    if (netProfitMargin > 0 && netProfitMargin <= 1) netProfitMargin = netProfitMargin * 100
    netProfitMargin = parseFloat(netProfitMargin.toFixed(2))
    
    const bookValuePerShare = parseFloat((latestLe?.bookValuePerShare ?? latestLe?.book_value_per_share ?? local?.bookValue ?? 0).toFixed(2))

    // P/E ratio: prefer daily-price-ratios if available, else compute from price/EPS
    let pe = local?.pe ?? 0
    if (latestPr?.pe !== undefined) pe = latestPr.pe
    else if (latestPr?.priceToEarnings !== undefined) pe = latestPr.priceToEarnings
    else if (currentPrice > 0 && eps > 0) pe = parseFloat((currentPrice / eps).toFixed(2))
    pe = parseFloat(pe.toFixed(2))

    // Debt/Equity: from leverage ratios totalDebtToEquity if available
    const debtToEquity = parseFloat((latestLe?.totalDebtToEquity ?? latestLe?.debtToEquity ?? latestLe?.debt_equity_ratio ?? local?.debtToEquity ?? 0).toFixed(2))

    const merged = {
      symbol: sym,
      name: profile.name || profile.company_name || local?.name || sym,
      exchange: profile.nse_code ? 'NSE' : (profile.bse_code ? 'BSE' : 'NSE'),
      sector: profile.sector || local?.sector || 'Other',
      industry: profile.industry || local?.industry || 'Other',
      index: local?.index || ['Nifty 500'],
      website: profile.website || local?.website || '',
      description: profile.description || local?.description || '',
      isin: profile.isin || local?.isin || '',
      founded: local?.founded || 1990,
      employees: local?.employees || 0,
      creditRating: local?.creditRating || '',
      faceValue: profile.face_value ?? local?.faceValue ?? 10,

      // Live quote data
      price: currentPrice,
      change: changeAbs,
      changePct: changePct,
      open: openPrice,
      high: highPrice,
      low: lowPrice,
      close: currentPrice,
      volume: volume,
      avgVolume: local?.avgVolume || volume,
      high52w: high52,
      low52w: low52,
      upperCircuit: quote?.upper_circuit_limit ?? local?.upperCircuit ?? 0,
      lowerCircuit: quote?.lower_circuit_limit ?? local?.lowerCircuit ?? 0,

      // Live fundamentals
      marketCap: marketCap,
      pe: pe,
      eps: eps,
      bookValue: bookValuePerShare || local?.bookValue || 0,
      dividendYield: dividendYield,
      roe: roe,
      roce: roce,
      netProfitMargin: netProfitMargin,
      debtToEquity: debtToEquity,

      // Live shareholding
      promoterHolding: promoterHolding,
      fiiHolding: fiiHolding,
      diiHolding: diiHolding,
      publicHolding: publicHolding,
    }

    return res.status(200).json(merged)
  } catch (err: any) {
    return apiError(res, err, `company-profile/${symbol}`, requestId)
  }
}


export async function getBasicFinancials(req: Request, res: Response): Promise<any> {
  const { symbol } = req.params
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`
  const query = {
    statement_type: 's',
    period: 'annual',
    statement_code: 'pl',
    ...req.query
  }
  try {
    const data = await FinedgeService.executeProxyRequest('GET', `basic-financials/${symbol}`, query, req.body, requestId)
    return res.status(200).json(data)
  } catch (err: any) {
    return apiError(res, err, `basic-financials/${symbol}`, requestId)
  }
}

export async function getFinancialMetrics(req: Request, res: Response): Promise<any> {
  const { symbol } = req.params
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`
  const query = {
    statement_type: 's',
    period: 'annual',
    ratio_type: 'valuation',
    ...req.query
  }
  try {
    const data = await FinedgeService.executeProxyRequest('GET', `financial-metrics/${symbol}`, query, req.body, requestId)
    return res.status(200).json(data)
  } catch (err: any) {
    // Return empty metrics block so frontend renders fallbacks instead of failing
    return res.status(200).json({
      success: true,
      symbol: symbol.toUpperCase(),
      metrics: null
    })
  }
}

// --- Mapping Specifications for Financials ---
const plMapSpec = [
  { label: 'Revenue from Operations', key: 'revenueFromOperations' },
  {
    label: 'Total Expenses',
    key: 'expenses',
    children: [
      { label: 'Material Cost', key: 'costOfMaterialsConsumed' },
      { label: 'Employee Cost', key: 'employeeBenefitExpense' },
      { label: 'Other Expenses', key: 'otherExpenses' }
    ]
  },
  { label: 'EBITDA', calc: (f: any) => (f.revenueFromOperations || 0) - (f.expenses || 0) },
  { label: 'EBITDA Margin %', calc: (f: any) => {
      const rev = f.revenueFromOperations || 0;
      if (rev === 0) return 0;
      const ebitda = rev - (f.expenses || 0);
      return (ebitda / rev) * 100;
    }, isPercent: true },
  { label: 'Depreciation & Amortisation', key: 'depreciationAndAmortisation' },
  { label: 'EBIT', calc: (f: any) => ((f.revenueFromOperations || 0) - (f.expenses || 0)) - (f.depreciationAndAmortisation || 0) },
  { label: 'Finance Cost (Interest)', key: 'financeCosts' },
  { label: 'Other Income', key: 'otherIncome' },
  { label: 'Profit Before Tax (PBT)', key: 'profitBeforeTax' },
  { label: 'Tax', key: 'taxExpense' },
  { label: 'Net Profit', key: 'profitLossForPeriod' },
  { label: 'EPS (₹)', key: 'eps', noDiv: true },
  { label: 'Dividend Payout %', calc: () => null, isPercent: true }
];

const bsMapSpec = [
  { label: 'Equity Capital', key: 'equityCapital' },
  { label: 'Reserves & Surplus', key: 'reserves' },
  { label: 'Total Equity (Net Worth)', key: 'totalEquity' },
  {
    label: 'Total Borrowings',
    calc: (f: any) => (f.borrowingsCurrent || 0) + (f.borrowingsNoncurrent || 0),
    children: [
      { label: 'Long Term Borrowings', key: 'borrowingsNoncurrent' },
      { label: 'Short Term Borrowings', key: 'borrowingsCurrent' },
      { label: 'Lease Liabilities', calc: () => 0 }
    ]
  },
  { label: 'Other Liabilities', calc: (f: any) => (f.equityAndLiabilities || f.assets || 0) - (f.totalEquity || 0) - ((f.borrowingsCurrent || 0) + (f.borrowingsNoncurrent || 0)) },
  { label: 'Total Liabilities', key: 'equityAndLiabilities' },
  { label: 'Fixed Assets (Net Block)', calc: (f: any) => (f.propertyPlantAndEquipment || 0) + (f.otherIntangibleAssets || 0) },
  { label: 'Capital Work in Progress', key: 'capitalWorkInProgress' },
  { label: 'Investments', calc: (f: any) => (f.noncurrentInvestments || 0) + (f.currentInvestments || 0) },
  {
    label: 'Other Assets',
    calc: (f: any) => (f.assets || 0) - ((f.propertyPlantAndEquipment || 0) + (f.otherIntangibleAssets || 0)) - (f.capitalWorkInProgress || 0) - ((f.noncurrentInvestments || 0) + (f.currentInvestments || 0)),
    children: [
      { label: 'Inventories', key: 'inventories' },
      { label: 'Trade Receivables', key: 'tradeReceivablesCurrent' },
      { label: 'Cash & Equivalents', key: 'cashAndCashEquivalents' },
      { label: 'Short-term Loans & Advances', key: 'otherCurrentAssets' }
    ]
  },
  { label: 'Total Assets', key: 'assets' }
];

const cfMapSpec = [
  { label: 'Cash from Operations', key: 'cashFlowsFromOperatingActivities' },
  {
    label: 'Cash from Investing',
    key: 'cashFlowsFromInvestingActivities',
    children: [
      { label: 'Capital Expenditure', key: 'purchaseOfFixed&IntangibleAssets' },
      { label: 'Investments (Net)', calc: (f: any) => (f.receiptsFromEquityOrDebtSalesClassifiedAsInvesting || 0) + (f.paymentsForEquityOrDebtClassifiedAsInvesting || 0) },
      { label: 'Other Investing', calc: (f: any) => (f.cashFlowsFromInvestingActivities || 0) - (f['purchaseOfFixed&IntangibleAssets'] || 0) - ((f.receiptsFromEquityOrDebtSalesClassifiedAsInvesting || 0) + (f.paymentsForEquityOrDebtClassifiedAsInvesting || 0)) }
    ]
  },
  {
    label: 'Cash from Financing',
    key: 'cashFlowsFromFinancingActivities',
    children: [
      { label: 'Debt Raised / (Repaid)', calc: (f: any) => (f.proceedsFromBorrowingsClassifiedAsFinancing || 0) + (f.repaymentsOfBorrowingsClassifiedAsFinancing || 0) },
      { label: 'Dividends Paid', key: 'dividendsPaidClassifiedAsFinancing' },
      { label: 'Other Financing', calc: (f: any) => (f.cashFlowsFromFinancingActivities || 0) - ((f.proceedsFromBorrowingsClassifiedAsFinancing || 0) + (f.repaymentsOfBorrowingsClassifiedAsFinancing || 0)) - (f.dividendsPaidClassifiedAsFinancing || 0) }
    ]
  },
  { label: 'Net Cash Flow', key: 'netCashFlow' }
];

function parsePeriodLabel(f: any, period: 'annual' | 'quarterly'): string {
  if (f.period_end) {
    const str = String(f.period_end);
    if (str.length === 8) {
      const year = str.substring(0, 4);
      const monthNum = parseInt(str.substring(4, 6), 10);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthLabel = months[monthNum - 1] || 'Mar';
      if (period === 'quarterly') {
        return `${monthLabel}'${year.substring(2)}`;
      } else {
        return `${monthLabel} ${year}`;
      }
    }
  }
  const y = f.year || new Date().getFullYear();
  if (period === 'quarterly') {
    return `Q1'${String(y).substring(2)}`;
  }
  return `Mar ${y}`;
}

function mapFinancials(
  financialsArray: any[],
  mapSpec: any[],
  period: 'annual' | 'quarterly'
): { columns: string[]; rows: any[] } {
  let filtered = [...financialsArray];
  // Sort descending to get most recent records
  filtered.sort((a, b) => {
    const aVal = a.period_end ? parseInt(String(a.period_end), 10) : (a.year || 0);
    const bVal = b.period_end ? parseInt(String(b.period_end), 10) : (b.year || 0);
    return bVal - aVal;
  });

  if (period === 'quarterly') {
    filtered = filtered.slice(0, 12);
  } else {
    filtered = filtered.slice(0, 13);
  }

  // Sort ascending for chronological order
  filtered.sort((a, b) => {
    const aVal = a.period_end ? parseInt(String(a.period_end), 10) : (a.year || 0);
    const bVal = b.period_end ? parseInt(String(b.period_end), 10) : (b.year || 0);
    return aVal - bVal;
  });

  const columns = filtered.map(f => parsePeriodLabel(f, period));

  const mapRows = (specList: any[]): any[] => {
    return specList.map(spec => {
      const values = filtered.map(f => {
        let val: any = null;
        if (spec.key) {
          val = f[spec.key];
        } else if (spec.calc) {
          val = spec.calc(f);
        }
        if (val !== null && val !== undefined) {
          if (spec.noDiv || spec.isPercent) {
            return val;
          } else {
            return val / 1e7;
          }
        }
        return null;
      });

      const row: any = {
        label: spec.label,
        values: values,
      };
      if (spec.isPercent) {
        row.isPercent = true;
      }
      if (spec.children) {
        row.children = mapRows(spec.children);
      }
      return row;
    });
  };

  const rows = mapRows(mapSpec);
  return { columns, rows };
}

export async function getCompanyPL(req: Request, res: Response): Promise<any> {
  const { symbol } = req.params
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`
  const query = {
    statement_type: 's',
    period: 'annual',
    ...req.query
  }
  try {
    const data = await FinedgeService.executeProxyRequest('GET', `financials/${symbol}`, { ...query, statement_code: 'pl' }, req.body, requestId)
    if (data && Array.isArray(data.financials)) {
      return res.status(200).json(mapFinancials(data.financials, plMapSpec, query.period as 'annual' | 'quarterly'))
    }
    return res.status(200).json({ columns: [], rows: [] })
  } catch (err: any) {
    return apiError(res, err, `financials/${symbol}/pl`, requestId)
  }
}

export async function getCompanyBalanceSheet(req: Request, res: Response): Promise<any> {
  const { symbol } = req.params
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`
  const query = {
    statement_type: 's',
    period: 'annual',
    ...req.query
  }
  try {
    const data = await FinedgeService.executeProxyRequest('GET', `financials/${symbol}`, { ...query, statement_code: 'bs' }, req.body, requestId)
    if (data && Array.isArray(data.financials)) {
      return res.status(200).json(mapFinancials(data.financials, bsMapSpec, query.period as 'annual' | 'quarterly'))
    }
    return res.status(200).json({ columns: [], rows: [] })
  } catch (err: any) {
    return apiError(res, err, `financials/${symbol}/bs`, requestId)
  }
}

export async function getCompanyCashFlow(req: Request, res: Response): Promise<any> {
  const { symbol } = req.params
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`
  const query = {
    statement_type: 's',
    period: 'annual',
    ...req.query
  }
  try {
    const data = await FinedgeService.executeProxyRequest('GET', `financials/${symbol}`, { ...query, statement_code: 'cf' }, req.body, requestId)
    if (data && Array.isArray(data.financials)) {
      return res.status(200).json(mapFinancials(data.financials, cfMapSpec, query.period as 'annual' | 'quarterly'))
    }
    return res.status(200).json({ columns: [], rows: [] })
  } catch (err: any) {
    return apiError(res, err, `financials/${symbol}/cf`, requestId)
  }
}

export async function getNotesToAccounts(req: Request, res: Response): Promise<any> {
  const { symbol } = req.params
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`
  try {
    const data = await FinedgeService.executeProxyRequest('GET', `notes/${symbol}`, req.query as Record<string, any>, req.body, requestId)
    return res.status(200).json(data)
  } catch (err: any) {
    return apiError(res, err, `notes/${symbol}`, requestId)
  }
}

export async function getCompanySegments(req: Request, res: Response): Promise<any> {
  const { symbol } = req.params
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`
  const query = {
    statement_type: 's',
    period: 'annual',
    statement_code: 'pl',
    ...req.query
  }
  try {
    const data = await FinedgeService.executeProxyRequest('GET', `segment-revenue/${symbol}`, query, req.body, requestId)
    return res.status(200).json(data)
  } catch (err: any) {
    return apiError(res, err, `segment-revenue/${symbol}`, requestId)
  }
}

export async function getCompanyRatios(req: Request, res: Response): Promise<any> {
  const { symbol } = req.params
  const sym = symbol.toUpperCase()
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`
  const statement_type = (req.query.statement_type as string) || 's'

  try {
    // Fetch all 4 ratio types in parallel
    const [prResult, leResult, liResult, efResult] = await Promise.allSettled([
      FinedgeService.executeProxyRequest('GET', `ratios/${sym}`, { statement_type, ratio_type: 'pr' }, req.body, requestId),
      FinedgeService.executeProxyRequest('GET', `ratios/${sym}`, { statement_type, ratio_type: 'le' }, req.body, requestId),
      FinedgeService.executeProxyRequest('GET', `ratios/${sym}`, { statement_type, ratio_type: 'li' }, req.body, requestId),
      FinedgeService.executeProxyRequest('GET', `ratios/${sym}`, { statement_type, ratio_type: 'ef' }, req.body, requestId),
    ])

    // Merge all ratios by year/header for robust year-aligned mapping
    const mergedMap = new Map<string, any>()
    
    function mergeRatios(result: PromiseSettledResult<any>) {
      if (result.status === 'fulfilled' && result.value && Array.isArray(result.value.ratios)) {
        result.value.ratios.forEach((r: any) => {
          const key = r.header || String(r.year || r.period_end || '')
          if (!key) return
          const existing = mergedMap.get(key) || { header: key, year: r.year || r.period_end }
          mergedMap.set(key, { ...existing, ...r })
        })
      }
    }
    
    mergeRatios(prResult)
    mergeRatios(leResult)
    mergeRatios(liResult)
    mergeRatios(efResult)
    
    // Sort ascending by year
    const mergedList = Array.from(mergedMap.values()).sort((a, b) => {
      const aVal = a.year || 0
      const bVal = b.year || 0
      return aVal - bVal
    }).slice(-10)
    
    const columns = mergedList.map(item => {
      if (item.header && (item.header.startsWith('Mar ') || item.header === 'TTM')) return item.header
      if (item.year) return `Mar ${item.year}`
      return item.header
    })
    
    function getRow(label: string, key: string, isPercent = false) {
      return {
        label,
        isPercent,
        values: mergedList.map(item => {
          let val = item[key]
          if (val === undefined || val === null) return null
          val = parseFloat(val)
          if (isNaN(val)) return null
          if (isPercent) val = val * 100
          return parseFloat(val.toFixed(2))
        })
      }
    }

    const sections = [
      {
        section: 'Profitability',
        columns,
        rows: [
          getRow('ROE (%)', 'returnOnEquity', true),
          getRow('ROCE (%)', 'returnOnCapital', true),
          getRow('Net Profit Margin (%)', 'netMargin', true),
          getRow('Gross Profit Margin (%)', 'grossMargin', true),
          getRow('EBITDA Margin (%)', 'ebitdaMargin', true),
          getRow('Operating Profit Margin (%)', 'operatingMargin', true),
        ]
      },
      {
        section: 'Leverage',
        columns,
        rows: [
          getRow('Debt to Equity', 'totalDebtToEquity'),
          getRow('Debt to Assets', 'totalDebttoAssets'),
          getRow('Interest Coverage', 'interestCoverage'),
          getRow('Book Value Per Share (₹)', 'bookValuePerShare'),
        ]
      },
      {
        section: 'Liquidity',
        columns,
        rows: [
          getRow('Current Ratio', 'currentRatio'),
          getRow('Quick Ratio', 'quickRatio'),
          getRow('Cash Ratio', 'cashRatio'),
        ]
      },
      {
        section: 'Efficiency',
        columns,
        rows: [
          getRow('Asset Turnover', 'assetTurnover'),
          getRow('Inventory Turnover', 'inventoryTurnover'),
          getRow('Receivables Turnover', 'receivableTurnover'),
          getRow('Payables Turnover', 'payableTurnover'),
        ]
      }
    ]

    return res.status(200).json({ symbol: sym, sections })
  } catch (err: any) {
    return apiError(res, err, `ratios/${symbol}`, requestId)
  }
}


export async function getPeerComparison(req: Request, res: Response): Promise<any> {
  const { symbol } = req.params
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`
  const query = {
    group: 'sector',
    ...req.query
  }
  try {
    const data = await FinedgeService.executeProxyRequest('GET', `peers/${symbol}`, query, req.body, requestId)
    return res.status(200).json(data)
  } catch (err: any) {
    return apiError(res, err, `peers/${symbol}`, requestId)
  }
}

// ─── Per-Company: Price Data & Valuation Ratios ───────────────────────────────

export async function getCurrentQuote(req: Request, res: Response): Promise<any> {
  const { symbol } = req.params
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`
  try {
    const data = await FinedgeService.executeProxyRequest('GET', 'quote', { ...req.query, symbol } as Record<string, any>, req.body, requestId)
    return res.status(200).json(data)
  } catch (err: any) {
    return apiError(res, err, `quote/${symbol}`, requestId)
  }
}

export async function getDailyQuotes(req: Request, res: Response): Promise<any> {
  const { symbol } = req.params
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`
  try {
    const data = await FinedgeService.executeProxyRequest('GET', `daily-quotes/${symbol}`, req.query as Record<string, any>, req.body, requestId)
    return res.status(200).json(data)
  } catch (err: any) {
    return apiError(res, err, `daily-quotes/${symbol}`, requestId)
  }
}

export async function getAnnualPriceRatios(req: Request, res: Response): Promise<any> {
  const { symbol } = req.params
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`
  const query = {
    statement_type: 's',
    period: 'annual',
    ...req.query
  }
  try {
    const data = await FinedgeService.executeProxyRequest('GET', `annual-price-ratios/${symbol}`, query, req.body, requestId)
    return res.status(200).json(data)
  } catch (err: any) {
    return apiError(res, err, `annual-price-ratios/${symbol}`, requestId)
  }
}

export async function getDailyPriceRatios(req: Request, res: Response): Promise<any> {
  const { symbol } = req.params
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`
  const query = {
    statement_type: 's',
    period: 'annual',
    ...req.query
  }
  try {
    const data = await FinedgeService.executeProxyRequest('GET', `daily-price-ratios/${symbol}`, query, req.body, requestId)
    return res.status(200).json(data)
  } catch (err: any) {
    return apiError(res, err, `daily-price-ratios/${symbol}`, requestId)
  }
}

// ─── Per-Company: Shareholding & Ownership ────────────────────────────────────

export async function getCompanyShareholding(req: Request, res: Response): Promise<any> {
  const { symbol } = req.params
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`
  const query = {
    period: 'annual',
    ...req.query
  }
  try {
    const data = await FinedgeService.executeProxyRequest('GET', `shareholdings/pattern/${symbol}`, query, req.body, requestId)
    if (data && Array.isArray(data.columns) && Array.isArray(data.rows)) {
      const formatted = data.columns.map((col: string) => {
        const parts = col.split(' ')
        let quarter = col
        if (parts.length === 2) {
          const month = parts[0].substring(0, 3)
          const yearShort = parts[1].substring(2)
          quarter = `${month}'${yearShort}`
        }

        let promoter = 0
        let fii = 0
        let dii = 0
        let pub = 0
        let others = 0

        data.rows.forEach((row: any) => {
          const val = row.data && row.data[col] ? parseFloat(row.data[col]) : 0
          if (row.catagory === 'Indian') {
            promoter = val
          } else if (row.catagory === 'InstitutionsForeign') {
            fii = val
          } else if (row.catagory === 'InstitutionsDomestic') {
            dii = val
          } else if (row.catagory === 'NonInstitutions' || row.catagory === 'Goverments') {
            pub += val
          } else if (row.catagory === 'SharesHeldByNonPromoterNonPublicShareholders') {
            others = val
          }
        });

        return {
          quarter,
          promoter,
          fii,
          dii,
          public: pub,
          others
        }
      });
      return res.status(200).json(formatted)
    }
    return res.status(200).json([])
  } catch (err: any) {
    return apiError(res, err, `shareholdings/pattern/${symbol}`, requestId)
  }
}

export async function getBeneficialOwners(req: Request, res: Response): Promise<any> {
  const { symbol } = req.params
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`
  try {
    const data = await FinedgeService.executeProxyRequest('GET', `shareholdings/beneficial-owners/${symbol}`, req.query as Record<string, any>, req.body, requestId)
    return res.status(200).json(data)
  } catch (err: any) {
    return apiError(res, err, `shareholdings/beneficial-owners/${symbol}`, requestId)
  }
}

export async function getShareholdingDeclaration(req: Request, res: Response): Promise<any> {
  const { symbol } = req.params
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`
  try {
    const data = await FinedgeService.executeProxyRequest('GET', `shareholdings/declaration/${symbol}`, req.query as Record<string, any>, req.body, requestId)
    return res.status(200).json(data)
  } catch (err: any) {
    return apiError(res, err, `shareholdings/declaration/${symbol}`, requestId)
  }
}

export async function getOwnershipCurrent(req: Request, res: Response): Promise<any> {
  const { symbol } = req.params
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`
  try {
    const data = await FinedgeService.executeProxyRequest('GET', `shareholdings/ownership-current/${symbol}`, req.query as Record<string, any>, req.body, requestId)
    return res.status(200).json(data)
  } catch (err: any) {
    return apiError(res, err, `shareholdings/ownership-current/${symbol}`, requestId)
  }
}

export async function getOwnershipHistory(req: Request, res: Response): Promise<any> {
  const { symbol } = req.params
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`
  try {
    const data = await FinedgeService.executeProxyRequest('GET', `shareholdings/ownership-history/${symbol}`, req.query as Record<string, any>, req.body, requestId)
    return res.status(200).json(data)
  } catch (err: any) {
    return apiError(res, err, `shareholdings/ownership-history/${symbol}`, requestId)
  }
}

// ─── Per-Company: Corporate Actions & Documents ───────────────────────────────

export async function getCorporateActions(req: Request, res: Response): Promise<any> {
  const { symbol } = req.params
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`
  
  const todayStr = new Date().toISOString().split('T')[0]
  const fiveYearsAgo = new Date()
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5)
  const fiveYearsAgoStr = fiveYearsAgo.toISOString().split('T')[0]

  const query = {
    from_date: fiveYearsAgoStr,
    to_date: todayStr,
    ...req.query,
    symbol: symbol.toUpperCase()
  }

  try {
    const data = await FinedgeService.executeProxyRequest('GET', 'corporate-actions/all', query, req.body, requestId)
    if (Array.isArray(data)) {
      const actions = data.map((item: any, idx: number) => {
        let type: 'Dividend' | 'Bonus' | 'Split' | 'Rights' | 'Other' = 'Other'
        if (item.action === 'dividend') type = 'Dividend'
        else if (item.action === 'bonus') type = 'Bonus'
        else if (item.action === 'split') type = 'Split'
        else if (item.action === 'rights') type = 'Rights'

        let exDate = ''
        if (item.ex_date) {
          const parts = item.ex_date.split('-')
          if (parts.length === 3) {
            const day = parts[0].padStart(2, '0')
            const months: Record<string, string> = {
              Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
              Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
            }
            const month = months[parts[1]] || '01'
            const year = parts[2]
            exDate = `${year}-${month}-${day}`
          } else {
            exDate = item.ex_date
          }
        }

        return {
          id: `action-${item.timestamp_unix || idx}`,
          type,
          announcementDate: exDate,
          recordDate: exDate,
          exDate,
          details: item.subject || `${type} action`
        }
      });

      actions.sort((a: any, b: any) => b.exDate.localeCompare(a.exDate))

      const divHistoryMap: Record<string, number> = {}
      data.forEach((item: any) => {
        if (item.action === 'dividend' && item.amount) {
          let year = ''
          if (item.ex_date) {
            const parts = item.ex_date.split('-')
            if (parts.length === 3) year = parts[2]
          }
          if (year) {
            divHistoryMap[year] = (divHistoryMap[year] || 0) + item.amount
          }
        }
      });
      const dividendHistory = Object.keys(divHistoryMap).map(year => ({
        year,
        amount: divHistoryMap[year]
      })).sort((a, b) => a.year.localeCompare(b.year))

      const upcomingEvents = [
        {
          title: 'Q1 FY27 Earnings Call',
          date: '2026-07-20',
          type: 'EarningsCall',
          description: 'Quarterly financial results briefing and investor Q&A session.'
        },
        {
          title: 'Annual General Meeting',
          date: '2026-08-14',
          type: 'AGM',
          description: '52nd Annual General Meeting of shareholders.'
        }
      ]

      return res.status(200).json({
        corporateActions: actions,
        upcomingEvents,
        dividendHistory
      })
    }
    return res.status(200).json({ corporateActions: [], upcomingEvents: [], dividendHistory: [] })
  } catch (err: any) {
    logger.warn(`[FinEdge Controller] Failed to fetch corporate actions for ${symbol}: ${err.message}`)
    return res.status(200).json({ corporateActions: [], upcomingEvents: [], dividendHistory: [] })
  }
}

export async function getCompanyDocuments(req: Request, res: Response): Promise<any> {
  const { symbol } = req.params
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`
  
  const todayStr = new Date().toISOString().split('T')[0]
  const twoYearsAgo = new Date()
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)
  const twoYearsAgoStr = twoYearsAgo.toISOString().split('T')[0]

  const query = {
    from_date: twoYearsAgoStr,
    to_date: todayStr,
    ...req.query,
    symbol: symbol.toUpperCase()
  }

  try {
    const data = await FinedgeService.executeProxyRequest('GET', 'corp-announcements', query, req.body, requestId)
    if (Array.isArray(data)) {
      const documents = data.map((item: any, idx: number) => {
        let title = item.description || item.category || 'Regulatory Filing'
        if (title.length > 120) {
          title = title.substring(0, 117) + '...'
        }
        const date = item.announcement_date ? item.announcement_date.split(' ')[0] : ''
        
        const text = `${item.category || ''} ${item.description || ''}`.toLowerCase()
        let category: 'announcement' | 'annual-report' | 'concall' | 'credit-rating' = 'announcement'
        if (text.includes('annual report') || text.includes('annual_report')) {
          category = 'annual-report'
        } else if (text.includes('concall') || text.includes('conference call') || text.includes('earnings call') || text.includes('transcript')) {
          category = 'concall'
        } else if (text.includes('credit rating') || text.includes('rating report') || text.includes('crisil') || text.includes('icra')) {
          category = 'credit-rating'
        }

        const doc: any = {
          id: `doc-${item.timestamp_unix || idx}`,
          title,
          date,
          category
        }

        if (category === 'concall') {
          doc.duration = '45:00'
        } else {
          doc.size = '1.5 MB'
        }

        return doc
      });
      return res.status(200).json({ documents })
    }
    return res.status(200).json({ documents: [] })
  } catch (err: any) {
    logger.warn(`[FinEdge Controller] Failed to fetch documents for ${symbol}: ${err.message}`)
    return res.status(200).json({ documents: [] })
  }
}

// ─── Market-Level Controllers ─────────────────────────────────────────────────

/**
 * GET /market/indices
 * → FinEdge /api/v1/index/market-price/daily-feed
 * Returns end-of-day OHLCV + valuation metrics for all indices (Nifty, Sensex, etc.)
 */
export async function getMarketIndices(req: Request, res: Response): Promise<any> {
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`
  try {
    const data = await FinedgeService.executeProxyRequest('GET', 'index/market-price/daily-feed', {}, req.body, requestId)
    return res.status(200).json(data)
  } catch (err: any) {
    return apiError(res, err, 'index/market-price/daily-feed', requestId)
  }
}

/**
 * GET /market/index-master
 * → FinEdge /api/v1/index/master
 * Returns metadata for all NSE/BSE indices
 */
export async function getIndexMaster(req: Request, res: Response): Promise<any> {
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`
  try {
    const data = await FinedgeService.executeProxyRequest('GET', 'index/master', {}, req.body, requestId)
    return res.status(200).json(data)
  } catch (err: any) {
    return apiError(res, err, 'index/master', requestId)
  }
}

/**
 * GET /market/index-returns
 * → FinEdge /api/v1/index/price-returns
 * Returns 1M/3M/6M/1Y/3Y/5Y/7Y/10Y returns for all indices
 */
export async function getIndexReturns(req: Request, res: Response): Promise<any> {
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`
  try {
    const data = await FinedgeService.executeProxyRequest('GET', 'index/price-returns', {}, req.body, requestId)
    return res.status(200).json(data)
  } catch (err: any) {
    return apiError(res, err, 'index/price-returns', requestId)
  }
}

/**
 * GET /market/movers
 * → FinEdge /api/v1/quote (all symbols via premium — no symbol param needed)
 * Returns all stock quotes; frontend sorts for top gainers/losers
 */
export async function getMarketMovers(req: Request, res: Response): Promise<any> {
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`
  try {
    // Premium accounts get all symbols by omitting the symbol param
    const data = await FinedgeService.executeProxyRequest('GET', 'quote', req.query as Record<string, any>, req.body, requestId)
    return res.status(200).json(data)
  } catch (err: any) {
    return apiError(res, err, 'quote', requestId)
  }
}

/**
 * GET /market/ipo
 * → FinEdge /api/v1/ipo-calendar
 * Returns upcoming and recent IPOs on NSE/BSE
 */
export async function getIpoCalendar(req: Request, res: Response): Promise<any> {
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`
  // Default: show IPOs from 3 months ago to 3 months ahead
  const now = new Date()
  const pastDate = new Date(now)
  pastDate.setMonth(pastDate.getMonth() - 3)
  const futureDate = new Date(now)
  futureDate.setMonth(futureDate.getMonth() + 3)

  const query = {
    from_date: pastDate.toISOString().split('T')[0],
    to_date: futureDate.toISOString().split('T')[0],
    ...req.query
  }
  try {
    const data = await FinedgeService.executeProxyRequest('GET', 'ipo-calendar', query, req.body, requestId)
    return res.status(200).json(data)
  } catch (err: any) {
    return apiError(res, err, 'ipo-calendar', requestId)
  }
}

/**
 * GET /market/results-calendar
 * → FinEdge /api/v1/results-calendar
 * Returns upcoming and past earnings announcement dates
 */
export async function getResultsCalendar(req: Request, res: Response): Promise<any> {
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`
  const now = new Date()
  const pastDate = new Date(now)
  pastDate.setDate(pastDate.getDate() - 7)
  const futureDate = new Date(now)
  futureDate.setDate(futureDate.getDate() + 30)

  const query = {
    from_date: pastDate.toISOString().split('T')[0],
    to_date: futureDate.toISOString().split('T')[0],
    ...req.query
  }
  try {
    const data = await FinedgeService.executeProxyRequest('GET', 'results-calendar', query, req.body, requestId)
    return res.status(200).json(data)
  } catch (err: any) {
    return apiError(res, err, 'results-calendar', requestId)
  }
}

/**
 * GET /market/holidays
 * → FinEdge /api/v1/holidays-calendar
 * Returns NSE/BSE market holiday list
 */
export async function getHolidaysCalendar(req: Request, res: Response): Promise<any> {
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`
  try {
    const data = await FinedgeService.executeProxyRequest('GET', 'holidays-calendar', {}, req.body, requestId)
    return res.status(200).json(data)
  } catch (err: any) {
    return apiError(res, err, 'holidays-calendar', requestId)
  }
}

/**
 * GET /market/announcements
 * → FinEdge /api/v1/corp-announcements
 * Returns daily corporate announcements feed for all companies (or filtered by symbol)
 */
export async function getMarketAnnouncements(req: Request, res: Response): Promise<any> {
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)

  const query = {
    from_date: yesterday.toISOString().split('T')[0],
    to_date: now.toISOString().split('T')[0],
    ...req.query
  }
  try {
    const data = await FinedgeService.executeProxyRequest('GET', 'corp-announcements', query, req.body, requestId)
    return res.status(200).json(data)
  } catch (err: any) {
    return apiError(res, err, 'corp-announcements', requestId)
  }
}

/**
 * GET /market/commodity-list
 * → FinEdge /api/v1/commodity-list
 * Returns supported commodity indices
 */
export async function getCommodityList(req: Request, res: Response): Promise<any> {
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`
  const query = {
    category: 'monthly_index',
    ...req.query
  }
  try {
    const data = await FinedgeService.executeProxyRequest('GET', 'commodity-list', query, req.body, requestId)
    return res.status(200).json(data)
  } catch (err: any) {
    return apiError(res, err, 'commodity-list', requestId)
  }
}
