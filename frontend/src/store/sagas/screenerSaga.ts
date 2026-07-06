/**
 * store/sagas/screenerSaga.ts
 * Redux-Saga for stock screening and real-time query validation
 */

import { call, put, takeLatest, delay, select } from 'redux-saga/effects'
import {
  setQuery,
  setQueryValid,
  runScreenerStart,
  runScreenerSuccess,
  runScreenerFailure,
  type FilterRow,
  type ScreenerResult,
} from '../slices/screenerSlice'

// Selectors
const selectScreenerState = (state: any) => state.screener

// Simple Query Parser and Evaluator
interface ParsedClause {
  field: string
  operator: string
  value: number
  value2?: number
}

function parseQueryText(queryText: string): { parsed: ParsedClause[]; error: string | null } {
  if (!queryText.trim()) return { parsed: [], error: null }

  const clauses: ParsedClause[] = []
  const tokens = queryText.split(/\bAND\b/i)

  for (let token of tokens) {
    token = token.trim()
    if (!token) continue

    // Pattern matching: Field Operator Value
    // e.g. "Market Cap > 5000", "ROE >= 15", "PE between 10 AND 20"
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

    return { parsed: [], error: `Syntax error near token: "${token}"` }
  }

  return { parsed: clauses, error: null }
}

// Map screen variables to company fields
function getCompanyValue(company: any, field: string): number | null {
  const mapping: { [key: string]: string } = {
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

// Saga for Query Validation (Debounced)
function* validateQuerySaga(action: ReturnType<typeof setQuery>): Generator<any, void, any> {
  yield delay(300) // Debounce delay
  const queryText = action.payload
  const { error } = parseQueryText(queryText)
  if (error) {
    yield put(setQueryValid({ valid: false, error }))
  } else {
    yield put(setQueryValid({ valid: true }))
  }
}

import { finscreenClient, screenerApiClient } from '@/services/finscreenApi'

// Saga for Running Screener
function* runScreenerSaga(): Generator<any, void, any> {
  try {
    const state: ReturnType<typeof selectScreenerState> = yield select(selectScreenerState)
    const { filters, queryText, queryValid } = state

    if (queryText.trim() && !queryValid) {
      throw new Error('Cannot run query with syntax errors')
    }

    // Construct the query string
    const query = queryText.trim() || filters.map((f: FilterRow) => {
      if (f.operator === 'between' && f.value2 !== undefined) {
        return `${f.variableId} between ${f.value} and ${f.value2}`
      }
      return `${f.variableId} ${f.operator} ${f.value}`
    }).join(' AND ')

    // API call to the backend screener endpoint using the configured screenerApiClient
    const response = yield call(
      [screenerApiClient, screenerApiClient.post],
      '/run',
      { query }
    )
    
    // Map response structure (supports direct array list or results wrapper)
    const resultsList = Array.isArray(response.data) ? response.data
                       : Array.isArray(response.data?.results) ? response.data.results
                       : Array.isArray(response.data?.data) ? response.data.data
                       : []

    const results: ScreenerResult[] = resultsList.map((c: any) => ({
      symbol: c.symbol,
      name: c.name || c.company_name || c.symbol,
      sector: c.sector || 'Other',
      marketCap: c.marketCap || c.market_cap || 0,
      pe: c.pe || 0,
      pb: c.pb || 0,
      dividendYield: c.dividendYield || c.dividend_yield || 0,
      roe: c.roe || 0,
      roce: c.roce || 0,
      debtToEquity: c.debtToEquity || c.debt_to_equity || 0,
      salesGrowth3Y: c.salesGrowth3Y || c.sales_growth_3y || 0,
      profitGrowth3Y: c.profitGrowth3Y || c.profit_growth_3y || 0,
      netProfitMargin: c.netProfitMargin || c.net_profit_margin || 0,
      ebitdaMargin: c.ebitdaMargin || c.ebitda_margin || 0,
      promoterHolding: c.promoterHolding || c.promoter_holding || 0,
      fiiHolding: c.fiiHolding || c.fii_holding || 0,
      currentRatio: c.currentRatio || c.current_ratio || 0,
      interestCoverage: c.interestCoverage || c.interest_coverage || 0,
      cmp: c.cmp || c.price || c.close_price || 0,
      changePct: c.changePct || c.pct_change || 0,
      high52w: c.high52w || c.week52_high || 0,
      low52w: c.low52w || c.week52_low || 0,
      eps: c.eps || 0,
      bookValue: c.bookValue || c.book_value || 0,
      rsi14: c.rsi14 || 0,
      beta: c.beta || 0,
    }))

    yield put(runScreenerSuccess({ results, totalCount: results.length }))
  } catch (err: any) {
    console.error('Screener run error:', err)
    const errorMsg = err.response?.data?.detail?.message || err.message || 'Failed to run screener'
    yield put(runScreenerFailure(errorMsg))
  }
}

export function* screenerSaga(): Generator<any, void, any> {
  yield takeLatest(setQuery.type, validateQuerySaga)
  yield takeLatest(runScreenerStart.type, runScreenerSaga)
}
