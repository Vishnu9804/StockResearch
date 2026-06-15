/**
 * services/finedge/index.ts
 * Barrel export — import everything from '@/services/finedge'
 *
 * Usage examples:
 *   import { CompanyService, MarketService, ENDPOINTS, finedgeClient } from '@/services/finedge'
 *   import type { FinancialParams, StockSearchParams } from '@/services/finedge'
 */

export { default as finedgeClient } from './client'
export { ENDPOINTS } from './endpoints'
export { CompanyService } from './company.service'
export { MarketService } from './market.service'

// Re-export param types for convenience
export type { FinancialParams, DateRangeParams, PriceHistoryParams, ShareholdingParams } from './company.service'
export type { StockSearchParams, DateRangeParams as MarketDateRangeParams } from './market.service'
