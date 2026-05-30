'use client'

import { formatIndian, formatCrores, formatPct, formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'

interface KeyMetricsGridProps {
  marketCap: number // in crores
  pe: number
  dividendYield: number
  faceValue: number
  roe: number
  roce: number
  debtToEquity: number
  bookValue: number
  high52w: number
  low52w: number
  promoterHolding: number
  price: number
}

export function KeyMetricsGrid(props: KeyMetricsGridProps) {
  const {
    marketCap,
    pe,
    dividendYield,
    faceValue,
    roe,
    roce,
    debtToEquity,
    bookValue,
    high52w,
    low52w,
    promoterHolding,
    price,
  } = props

  // Auto crores/lakhs format for market cap
  const formatMarketCap = (crores: number) => {
    if (crores >= 100000) {
      return `₹${(crores / 100000).toFixed(2)}L Cr`
    }
    return formatCrores(crores)
  }

  const metrics = [
    { label: 'Market Cap', value: formatMarketCap(marketCap) },
    { label: 'Current Price', value: `₹${formatIndian(price)}` },
    { label: 'High / Low (52W)', value: `₹${formatIndian(high52w)} / ₹${formatIndian(low52w)}` },
    { label: 'Stock P/E', value: `${formatNumber(pe)}x` },
    { label: 'Book Value', value: `₹${formatIndian(bookValue)}` },
    { label: 'Dividend Yield', value: `${formatNumber(dividendYield)}%` },
    {
      label: 'ROCE',
      value: `${formatNumber(roce)}%`,
      className: roce > 15 ? 'text-positive font-bold' : '',
    },
    {
      label: 'ROE',
      value: `${formatNumber(roe)}%`,
      className: roe > 15 ? 'text-positive font-bold' : '',
    },
    { label: 'Face Value', value: `₹${formatNumber(faceValue, 0)}` },
    {
      label: 'Debt to Equity',
      value: formatNumber(debtToEquity),
      className: cn(
        debtToEquity < 0.5 ? 'text-positive font-bold' : '',
        debtToEquity > 1.5 ? 'text-negative font-bold' : ''
      ),
    },
    { label: 'Promoter Holding', value: `${formatNumber(promoterHolding)}%` },
  ]

  return (
    <div className="bg-surface border border-border select-none grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 divide-x divide-y divide-border/50">
      {metrics.map((m, i) => (
        <div key={m.label} className="p-4 flex flex-col justify-between h-20 bg-surface">
          <span className="text-[10px] font-bold text-textMuted uppercase tracking-wider">
            {m.label}
          </span>
          <span className={cn('text-sm font-mono font-semibold text-textPrimary mt-1', m.className)}>
            {m.value}
          </span>
        </div>
      ))}
    </div>
  )
}
export default KeyMetricsGrid
