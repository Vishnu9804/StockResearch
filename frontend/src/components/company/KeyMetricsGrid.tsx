import { formatIndian, formatCrores, formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'

interface KeyMetricsGridProps {
  marketCap: number
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
    marketCap, pe, dividendYield, faceValue,
    roe, roce, debtToEquity, bookValue,
    high52w, low52w, promoterHolding, price,
  } = props

  const formatMarketCap = (crores: number) => {
    if (crores >= 100000) return `₹${(crores / 100000).toFixed(2)}L Cr`
    return formatCrores(crores)
  }

  const metrics: { label: string; value: string; color?: string }[] = [
    { label: 'Market Cap',         value: formatMarketCap(marketCap) },
    { label: 'Current Price',      value: `₹${formatIndian(price)}` },
    { label: '52W High / Low',     value: `₹${formatIndian(high52w)} / ₹${formatIndian(low52w)}` },
    { label: 'Stock P/E',          value: `${formatNumber(pe)}x` },
    { label: 'Book Value',         value: `₹${formatIndian(bookValue)}` },
    { label: 'Dividend Yield',     value: `${formatNumber(dividendYield)}%` },
    {
      label: 'ROCE',
      value: `${formatNumber(roce)}%`,
      color: roce > 20 ? 'text-positive' : roce > 12 ? 'text-textPrimary' : 'text-negative',
    },
    {
      label: 'ROE',
      value: `${formatNumber(roe)}%`,
      color: roe > 20 ? 'text-positive' : roe > 12 ? 'text-textPrimary' : 'text-negative',
    },
    { label: 'Face Value',         value: `₹${formatNumber(faceValue, 0)}` },
    {
      label: 'Debt / Equity',
      value: formatNumber(debtToEquity),
      color: debtToEquity < 0.3 ? 'text-positive' : debtToEquity > 1.5 ? 'text-negative' : 'text-textPrimary',
    },
    { label: 'Promoter Holding',   value: `${formatNumber(promoterHolding)}%` },
  ]

  return (
    <div className="bg-surface border-y border-border select-none animate-count-up">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 divide-border/40">
        {metrics.map((m, i) => (
          <div
            key={m.label}
            className={cn(
              'px-4 py-3.5 flex flex-col gap-1 border-r border-b border-border/40 bg-surface',
              'hover:bg-accentSoft/20 transition-colors duration-150',
            )}
          >
            <span className="text-[9px] font-bold text-textMuted uppercase tracking-[0.08em] leading-none">
              {m.label}
            </span>
            <span className={cn(
              'text-sm font-mono font-bold text-textPrimary tabular-nums leading-snug',
              m.color,
            )}>
              {m.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default KeyMetricsGrid
