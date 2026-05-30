'use client'

import { useState, useMemo } from 'react'
import { Search, Info, Lock, ChevronDown, ChevronRight, Zap } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'

export interface Variable {
  id: string
  label: string
  category: string
  description: string
  unit: string
  locked?: boolean
}

interface VariablesSidebarProps {
  onInsert: (variable: Variable) => void
}

const ALL_VARIABLES: Variable[] = [
  // Valuation
  { id: 'pe', label: 'P/E Ratio', category: 'Valuation', description: 'Price-to-Earnings ratio. Measures how much investors pay per rupee of earnings. Lower may indicate undervaluation.', unit: 'x' },
  { id: 'pb', label: 'P/B Ratio', category: 'Valuation', description: 'Price-to-Book ratio. Compares market value to book value of equity. <1 can signal undervaluation.', unit: 'x' },
  { id: 'ev_ebitda', label: 'EV/EBITDA', category: 'Valuation', description: 'Enterprise Value to EBITDA. Popular valuation metric across capital structures.', unit: 'x' },
  { id: 'ps', label: 'P/S Ratio', category: 'Valuation', description: 'Price-to-Sales ratio. Useful for early-stage companies with no earnings.', unit: 'x' },
  { id: 'div_yield', label: 'Dividend Yield', category: 'Valuation', description: 'Annual dividend per share divided by stock price. Higher is generally more income-oriented.', unit: '%' },
  { id: 'peg', label: 'PEG Ratio', category: 'Valuation', description: 'Price/Earnings to Growth ratio. P/E ratio relative to earnings growth rate. <1 is favorable.', unit: 'x' },
  { id: 'market_cap', label: 'Market Cap', category: 'Valuation', description: 'Total market capitalization of the company in Crores (INR).', unit: '₹ Cr' },
  { id: 'ev', label: 'Enterprise Value', category: 'Valuation', description: 'Market Cap + Debt - Cash. True acquisition cost of the company.', unit: '₹ Cr' },
  { id: 'graham_number', label: 'Graham Number', category: 'Valuation', description: 'Upper bound of stock price using EPS and BV. Stock below this is considered undervalued.', unit: '₹', locked: true },

  // Profitability
  { id: 'roe', label: 'ROE', category: 'Profitability', description: 'Return on Equity. Net profit as a percentage of shareholders equity. Higher is better (>15% is good).', unit: '%' },
  { id: 'roce', label: 'ROCE', category: 'Profitability', description: 'Return on Capital Employed. Measures profitability relative to total capital used.', unit: '%' },
  { id: 'roa', label: 'ROA', category: 'Profitability', description: 'Return on Assets. How effectively the company generates profit from assets.', unit: '%' },
  { id: 'net_margin', label: 'Net Profit Margin', category: 'Profitability', description: 'Net profit as a percentage of revenue. Higher indicates better cost management.', unit: '%' },
  { id: 'ebitda_margin', label: 'EBITDA Margin', category: 'Profitability', description: 'EBITDA as a percentage of revenue. Shows operating profitability before non-cash items.', unit: '%' },
  { id: 'op_margin', label: 'Operating Margin', category: 'Profitability', description: 'Operating profit (EBIT) as a percentage of revenue.', unit: '%' },
  { id: 'gross_margin', label: 'Gross Margin', category: 'Profitability', description: 'Gross profit as a percentage of revenue. Shows pricing power and production efficiency.', unit: '%' },
  { id: 'roic', label: 'ROIC', category: 'Profitability', description: 'Return on Invested Capital. Measures how efficiently capital is allocated to profitable investments.', unit: '%', locked: true },

  // Debt & Liquidity
  { id: 'de_ratio', label: 'D/E Ratio', category: 'Debt & Liquidity', description: 'Debt-to-Equity ratio. Measures financial leverage. Lower is safer; <1 is generally preferred.', unit: 'x' },
  { id: 'current_ratio', label: 'Current Ratio', category: 'Debt & Liquidity', description: 'Current assets divided by current liabilities. >1 indicates good short-term liquidity.', unit: 'x' },
  { id: 'quick_ratio', label: 'Quick Ratio', category: 'Debt & Liquidity', description: 'Liquid assets (excl. inventory) divided by current liabilities. Stricter than current ratio.', unit: 'x' },
  { id: 'interest_coverage', label: 'Interest Coverage', category: 'Debt & Liquidity', description: 'EBIT divided by interest expense. How many times can company pay its interest. >3x is healthy.', unit: 'x' },
  { id: 'debt_to_assets', label: 'Debt to Assets', category: 'Debt & Liquidity', description: 'Total debt as a percentage of total assets. Shows capital structure risk.', unit: '%' },
  { id: 'net_debt', label: 'Net Debt', category: 'Debt & Liquidity', description: 'Total borrowings minus cash and cash equivalents. Negative means net cash company.', unit: '₹ Cr' },
  { id: 'cash_ratio', label: 'Cash Ratio', category: 'Debt & Liquidity', description: 'Cash and equivalents divided by current liabilities. Most conservative liquidity measure.', unit: 'x', locked: true },

  // Growth
  { id: 'sales_growth_1y', label: 'Sales Growth 1Y', category: 'Growth', description: 'Revenue growth rate over the last 1 year (TTM vs prior year TTM).', unit: '%' },
  { id: 'sales_growth_3y', label: 'Sales Growth 3Y', category: 'Growth', description: '3-year compounded annual growth rate (CAGR) of revenue.', unit: '% CAGR' },
  { id: 'sales_growth_5y', label: 'Sales Growth 5Y', category: 'Growth', description: '5-year compounded annual growth rate (CAGR) of revenue.', unit: '% CAGR' },
  { id: 'profit_growth_1y', label: 'Profit Growth 1Y', category: 'Growth', description: 'Net profit growth over the last 1 year.', unit: '%' },
  { id: 'profit_growth_3y', label: 'Profit Growth 3Y', category: 'Growth', description: '3-year compounded annual growth rate of net profit.', unit: '% CAGR' },
  { id: 'profit_growth_5y', label: 'Profit Growth 5Y', category: 'Growth', description: '5-year compounded annual growth rate of net profit.', unit: '% CAGR' },
  { id: 'eps_growth', label: 'EPS Growth 3Y', category: 'Growth', description: '3-year CAGR in Earnings Per Share.', unit: '% CAGR' },
  { id: 'ebitda_growth_3y', label: 'EBITDA Growth 3Y', category: 'Growth', description: '3-year CAGR of EBITDA.', unit: '% CAGR', locked: true },

  // Shareholding
  { id: 'promoter_pct', label: 'Promoter Holding %', category: 'Shareholding', description: 'Percentage of shares held by promoters. Higher promoter holding often signals confidence.', unit: '%' },
  { id: 'fii_pct', label: 'FII Holding %', category: 'Shareholding', description: 'Percentage of shares held by Foreign Institutional Investors.', unit: '%' },
  { id: 'dii_pct', label: 'DII Holding %', category: 'Shareholding', description: 'Percentage of shares held by Domestic Institutional Investors (MFs, Insurance, etc.).', unit: '%' },
  { id: 'pledge_pct', label: 'Promoter Pledge %', category: 'Shareholding', description: 'Percentage of promoter shares that are pledged. High pledge % is a risk signal.', unit: '%' },
  { id: 'public_pct', label: 'Public Holding %', category: 'Shareholding', description: 'Percentage of shares held by general public/retail investors.', unit: '%' },
  { id: 'promoter_change_qoq', label: 'Promoter Change QoQ', category: 'Shareholding', description: 'Quarterly change in promoter holding percentage. Positive = buying, Negative = selling.', unit: '% pts', locked: true },

  // Technical
  { id: 'rsi', label: 'RSI (14)', category: 'Technical', description: 'Relative Strength Index over 14 periods. >70 overbought, <30 oversold.', unit: '' },
  { id: 'sma50', label: 'SMA 50', category: 'Technical', description: '50-day Simple Moving Average. Price above SMA50 suggests short-term uptrend.', unit: '₹' },
  { id: 'sma200', label: 'SMA 200', category: 'Technical', description: '200-day Simple Moving Average. Key long-term trend indicator.', unit: '₹' },
  { id: 'beta', label: 'Beta', category: 'Technical', description: 'Sensitivity of stock returns relative to the market (Nifty 50). >1 more volatile, <1 less volatile.', unit: 'x' },
  { id: 'volume_avg', label: 'Avg Volume (30D)', category: 'Technical', description: '30-day average daily trading volume in shares.', unit: 'shares' },
  { id: 'price_to_sma200', label: 'Price vs SMA200 %', category: 'Technical', description: 'Current price as a percentage above/below the 200-day SMA.', unit: '%', locked: true },
  { id: 'macd', label: 'MACD Signal', category: 'Technical', description: 'MACD line minus signal line. Positive = bullish momentum, Negative = bearish.', unit: '', locked: true },

  // Size
  { id: 'revenue', label: 'Revenue (TTM)', category: 'Size', description: 'Total revenue over the last 12 months (Trailing Twelve Months).', unit: '₹ Cr' },
  { id: 'net_profit_ttm', label: 'Net Profit (TTM)', category: 'Size', description: 'Net profit over the last 12 months.', unit: '₹ Cr' },
  { id: 'total_assets', label: 'Total Assets', category: 'Size', description: 'Total assets on the balance sheet (latest annual).', unit: '₹ Cr' },
  { id: 'book_value', label: 'Book Value/Share', category: 'Size', description: 'Net asset value per share. Useful to compare with market price (P/B).', unit: '₹' },
  { id: 'free_float', label: 'Free Float Market Cap', category: 'Size', description: 'Market cap of shares available for public trading (excluding locked-in shares).', unit: '₹ Cr', locked: true },

  // Efficiency
  { id: 'debtor_days', label: 'Debtor Days', category: 'Efficiency', description: 'Average days to collect payment from customers. Lower is better, indicating efficient collections.', unit: 'days' },
  { id: 'inventory_days', label: 'Inventory Days', category: 'Efficiency', description: 'Average days inventory is held. Lower indicates faster inventory turnover.', unit: 'days' },
  { id: 'asset_turnover', label: 'Asset Turnover', category: 'Efficiency', description: 'Revenue divided by total assets. Measures how efficiently assets generate sales.', unit: 'x' },
  { id: 'working_capital_days', label: 'Working Capital Days', category: 'Efficiency', description: 'Debtor Days + Inventory Days - Creditor Days. Negative is very efficient (cash business).', unit: 'days' },
  { id: 'creditor_days', label: 'Creditor Days', category: 'Efficiency', description: 'Average days to pay suppliers. Higher may indicate better negotiating power.', unit: 'days' },
  { id: 'capex_pct_sales', label: 'CapEx % of Sales', category: 'Efficiency', description: 'Capital expenditure as a percentage of revenue. High CapEx industries require more reinvestment.', unit: '%', locked: true },
  { id: 'fcf', label: 'Free Cash Flow', category: 'Efficiency', description: 'Operating cash flow minus capital expenditures. Positive FCF companies can fund growth internally.', unit: '₹ Cr', locked: true },
]

const CATEGORIES = [
  'Valuation',
  'Profitability',
  'Debt & Liquidity',
  'Growth',
  'Shareholding',
  'Technical',
  'Size',
  'Efficiency',
]

export function VariablesSidebar({ onInsert }: VariablesSidebarProps) {
  const [search, setSearch] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['Valuation', 'Profitability'])
  )

  const filteredVariables = useMemo(() => {
    if (!search.trim()) return ALL_VARIABLES
    const q = search.toLowerCase()
    return ALL_VARIABLES.filter(
      (v) =>
        v.label.toLowerCase().includes(q) ||
        v.category.toLowerCase().includes(q) ||
        v.description.toLowerCase().includes(q)
    )
  }, [search])

  const grouped = useMemo(() => {
    return CATEGORIES.reduce<Record<string, Variable[]>>((acc, cat) => {
      acc[cat] = filteredVariables.filter((v) => v.category === cat)
      return acc
    }, {})
  }, [filteredVariables])

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  const isSearching = search.trim().length > 0

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col h-full bg-surface border-l border-border">
        {/* Header */}
        <div className="p-3 border-b border-border">
          <h3 className="text-sm font-semibold text-textPrimary mb-2">Variables</h3>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-textMuted" />
            <Input
              placeholder="Search variables..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
        </div>

        {/* Variable list */}
        <ScrollArea className="flex-1">
          <div className="p-2">
            {isSearching ? (
              // Flat list when searching
              <div>
                {filteredVariables.length === 0 ? (
                  <p className="text-xs text-textSecondary text-center py-8">No variables found</p>
                ) : (
                  filteredVariables.map((variable) => (
                    <VariableRow
                      key={variable.id}
                      variable={variable}
                      onInsert={onInsert}
                    />
                  ))
                )}
              </div>
            ) : (
              // Grouped by category
              CATEGORIES.map((cat) => {
                const vars = grouped[cat] ?? []
                const isExpanded = expandedCategories.has(cat)
                return (
                  <div key={cat} className="mb-1">
                    <button
                      onClick={() => toggleCategory(cat)}
                      className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold text-textSecondary hover:bg-surfaceMuted rounded-md transition-colors"
                    >
                      <span>{cat}</span>
                      <div className="flex items-center gap-1">
                        <span className="text-textMuted font-normal">{vars.length}</span>
                        {isExpanded ? (
                          <ChevronDown className="w-3 h-3 text-textMuted" />
                        ) : (
                          <ChevronRight className="w-3 h-3 text-textMuted" />
                        )}
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="ml-1">
                        {vars.map((variable) => (
                          <VariableRow
                            key={variable.id}
                            variable={variable}
                            onInsert={onInsert}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </ScrollArea>

        {/* Pro upgrade callout */}
        <div className="p-3 border-t border-border bg-gradient-to-br from-blue-50 to-indigo-50">
          <div className="flex items-start gap-2">
            <div className="w-7 h-7 rounded-md bg-accent flex items-center justify-center flex-shrink-0 mt-0.5">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold text-textPrimary">Unlock Pro Variables</p>
              <p className="text-xs text-textSecondary mt-0.5 leading-tight">
                Get access to 15+ locked variables including ROIC, FCF, MACD &amp; more.
              </p>
              <Button size="sm" className="mt-2 h-7 text-xs bg-accent hover:bg-accent/90 text-white w-full">
                Upgrade to Pro — ₹4,999/yr
              </Button>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}

interface VariableRowProps {
  variable: Variable
  onInsert: (variable: Variable) => void
}

function VariableRow({ variable, onInsert }: VariableRowProps) {
  return (
    <div className="flex items-center justify-between px-2 py-1 rounded-md hover:bg-surfaceMuted group">
      <button
        onClick={() => !variable.locked && onInsert(variable)}
        disabled={variable.locked}
        className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
      >
        {variable.locked ? (
          <Lock className="w-3 h-3 text-textMuted flex-shrink-0" />
        ) : (
          <div className="w-3 h-3 flex-shrink-0" />
        )}
        <span
          className={`text-xs truncate ${
            variable.locked ? 'text-textMuted' : 'text-gray-700 group-hover:text-accent'
          }`}
        >
          {variable.label}
        </span>
        {variable.unit && (
          <span className="text-xs text-textMuted flex-shrink-0 font-mono">{variable.unit}</span>
        )}
        {variable.locked && (
          <Badge
            variant="secondary"
            className="text-xs px-1 py-0 h-4 font-normal flex-shrink-0 bg-warning-soft text-warning"
          >
            Pro
          </Badge>
        )}
      </button>
      <Tooltip>
        <TooltipTrigger asChild>
          <button className="flex-shrink-0 ml-1 text-textMuted hover:text-accent opacity-0 group-hover:opacity-100 transition-opacity">
            <Info className="w-3.5 h-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-56">
          <p className="font-semibold text-xs mb-1">{variable.label}</p>
          <p className="text-xs text-textMuted leading-snug">{variable.description}</p>
          {variable.unit && (
            <p className="text-xs text-blue-300 mt-1 font-mono">Unit: {variable.unit}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
