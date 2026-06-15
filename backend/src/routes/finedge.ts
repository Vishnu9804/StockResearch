/**
 * backend/src/routes/finedge.ts
 * Clean routing config for FinEdge API proxy endpoints
 */

import { Router } from 'express'
import {
  proxyRequest,
  getCompanyProfile,
  getCompanyPL,
  getCompanyBalanceSheet,
  getCompanyCashFlow,
  getCompanySegments,
  getCompanyRatios,
  getCompanyShareholding,
  getCorporateActions,
  getCompanyDocuments,
  getStockSymbols,
  // New endpoints from FinEdge spec
  getStockSearch,
  getNameChanges,
  getSymbolChanges,
  getNotesToAccounts,
  getBasicFinancials,
  getFinancialMetrics,
  getAnnualPriceRatios,
  getDailyPriceRatios,
  getDailyQuotes,
  getCurrentQuote,
  getBeneficialOwners,
  getShareholdingDeclaration,
  getOwnershipCurrent,
  getOwnershipHistory,
  getPeerComparison,
} from '../controllers/finedge.js'

export const finedgeRouter = Router()

// ─── Company Universe & Discovery ────────────────────────────────────────────
finedgeRouter.get('/stock-symbols', getStockSymbols)
finedgeRouter.get('/stock-search', getStockSearch)
finedgeRouter.get('/name-changes', getNameChanges)
finedgeRouter.get('/symbol-changes', getSymbolChanges)

// ─── Per-Company: Core Profile & Financials ───────────────────────────────────
finedgeRouter.get('/company/:symbol/profile', getCompanyProfile)
finedgeRouter.get('/company/:symbol/basic-financials', getBasicFinancials)
finedgeRouter.get('/company/:symbol/financial-metrics', getFinancialMetrics)
finedgeRouter.get('/company/:symbol/financials/pl', getCompanyPL)
finedgeRouter.get('/company/:symbol/financials/balance-sheet', getCompanyBalanceSheet)
finedgeRouter.get('/company/:symbol/financials/cash-flow', getCompanyCashFlow)
finedgeRouter.get('/company/:symbol/notes', getNotesToAccounts)
finedgeRouter.get('/company/:symbol/segments', getCompanySegments)
finedgeRouter.get('/company/:symbol/ratios', getCompanyRatios)
finedgeRouter.get('/company/:symbol/peers', getPeerComparison)

// ─── Per-Company: Price Data & Valuation Ratios ───────────────────────────────
finedgeRouter.get('/company/:symbol/quote', getCurrentQuote)
finedgeRouter.get('/company/:symbol/price-history', getDailyQuotes)
finedgeRouter.get('/company/:symbol/annual-price-ratios', getAnnualPriceRatios)
finedgeRouter.get('/company/:symbol/daily-price-ratios', getDailyPriceRatios)

// ─── Per-Company: Shareholding & Ownership ────────────────────────────────────
finedgeRouter.get('/company/:symbol/shareholding', getCompanyShareholding)
finedgeRouter.get('/company/:symbol/shareholding/beneficial-owners', getBeneficialOwners)
finedgeRouter.get('/company/:symbol/shareholding/declaration', getShareholdingDeclaration)
finedgeRouter.get('/company/:symbol/shareholding/ownership-current', getOwnershipCurrent)
finedgeRouter.get('/company/:symbol/shareholding/ownership-history', getOwnershipHistory)

// ─── Per-Company: Corporate Actions & Documents ───────────────────────────────
finedgeRouter.get('/company/:symbol/corporate-actions', getCorporateActions)
finedgeRouter.get('/company/:symbol/documents', getCompanyDocuments)

// ─── General catch-all proxy endpoint (backward-compatible fallback) ──────────
finedgeRouter.all('/*', proxyRequest)

export default finedgeRouter
