/**
 * backend/src/routes/finedge.ts
 * Clean routing config for FinEdge API proxy endpoints
 */

import { Router } from 'express'
import { authGuard } from '../middlewares/auth.js'
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
  getStockSymbols
} from '../controllers/finedge.js'

export const finedgeRouter = Router()

// Specific domain endpoints
finedgeRouter.get('/company/:symbol/profile', getCompanyProfile)
finedgeRouter.get('/company/:symbol/financials/pl', getCompanyPL)
finedgeRouter.get('/company/:symbol/financials/balance-sheet', getCompanyBalanceSheet)
finedgeRouter.get('/company/:symbol/financials/cash-flow', getCompanyCashFlow)
finedgeRouter.get('/company/:symbol/segments', getCompanySegments)
finedgeRouter.get('/company/:symbol/ratios', getCompanyRatios)
finedgeRouter.get('/company/:symbol/shareholding', getCompanyShareholding)
finedgeRouter.get('/company/:symbol/corporate-actions', getCorporateActions)
finedgeRouter.get('/company/:symbol/documents', getCompanyDocuments)
finedgeRouter.get('/stock-symbols', getStockSymbols)

// General catch-all proxy endpoint (as backward-compatible fallback)
finedgeRouter.all('/*', proxyRequest)

export default finedgeRouter
