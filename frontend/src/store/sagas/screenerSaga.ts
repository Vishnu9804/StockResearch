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
import { companies } from '@/lib/data/companies'

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

// Saga for Running Screener
function* runScreenerSaga(): Generator<any, void, any> {
  try {
    const state: ReturnType<typeof selectScreenerState> = yield select(selectScreenerState)
    const { filters, queryText, queryValid } = state

    yield delay(500) // Simulate network delay

    let filtered = [...companies]

    if (queryText.trim()) {
      if (!queryValid) {
        throw new Error('Cannot run query with syntax errors')
      }
      const { parsed } = parseQueryText(queryText)
      for (const clause of parsed) {
        filtered = filtered.filter((company) => {
          const compVal = getCompanyValue(company, clause.field)
          if (compVal === null) return false
          return evaluateFilter(compVal, clause.operator, clause.value, clause.value2)
        })
      }
    } else if (filters.length > 0) {
      // Visual mode filters
      for (const filter of filters) {
        filtered = filtered.filter((company) => {
          const compVal = getCompanyValue(company, filter.variableId.toLowerCase())
          if (compVal === null) return false
          return evaluateFilter(compVal, filter.operator, filter.value, filter.value2)
        })
      }
    }

    // Map to ScreenerResult interface
    const results: ScreenerResult[] = filtered.map((c) => ({
      symbol: c.symbol,
      name: c.name,
      sector: c.sector,
      marketCap: c.marketCap,
      pe: c.pe,
      pb: c.bookValue > 0 ? c.price / c.bookValue : 0,
      dividendYield: c.dividendYield,
      roe: c.roe,
      roce: c.roce,
      debtToEquity: c.debtToEquity,
      salesGrowth3Y: 15.4, // Mock fallback
      profitGrowth3Y: 12.8, // Mock fallback
      netProfitMargin: 14.5, // Mock fallback
      ebitdaMargin: 21.2, // Mock fallback
      promoterHolding: c.promoterHolding,
      fiiHolding: c.fiiHolding,
      currentRatio: 1.5, // Mock fallback
      interestCoverage: 8.5, // Mock fallback
      cmp: c.price,
      changePct: c.changePct,
      high52w: c.high52w,
      low52w: c.low52w,
      eps: c.eps,
      bookValue: c.bookValue,
      rsi14: 58.4, // Mock fallback
      beta: 1.05, // Mock fallback
    }))

    yield put(runScreenerSuccess({ results, totalCount: results.length }))
  } catch (err: any) {
    yield put(runScreenerFailure(err.message || 'Failed to run screener'))
  }
}

export function* screenerSaga(): Generator<any, void, any> {
  yield takeLatest(setQuery.type, validateQuerySaga)
  yield takeLatest(runScreenerStart.type, runScreenerSaga)
}
