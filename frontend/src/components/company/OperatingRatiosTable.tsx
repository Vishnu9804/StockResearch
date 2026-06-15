
import { useState } from 'react'
import { useAppSelector } from '@/store/hooks'
import { ratios, fiscalYears } from '@/lib/data/financials'
import { cn } from '@/lib/utils'
import { ArrowDown, ArrowUp, Info, TrendingUp } from 'lucide-react'

// Operating ratio rows: Debtor Days, Inventory Days, Days Payable, CCC, Working Capital Days, ROCE%
const OPERATING_ROWS = [
  'Debtor Days',
  'Inventory Days',
  'Days Payable Outstanding',
  'Cash Conversion Cycle',
  'Working Capital Days',
  'Return on Capital Employed %',
]

// The fiscal year columns we want to show (last 8 from fiscalYears)
const COLUMNS = fiscalYears.slice(2, 10) // Mar'16 – Mar'23

// Quick metrics derived from latest values
const QUICK_METRICS = [
  { label: 'Debtor Days', value: '13.5', unit: 'days', trend: '−1.2%', positive: true, hint: 'Improvement' },
  { label: 'Inventory Days', value: '32.8', unit: 'days', trend: '+0.4%', positive: false, hint: 'Delay' },
  { label: 'Payable Days', value: '45.2', unit: 'days', trend: '', positive: true, hint: 'Stable' },
  { label: 'CCC', value: '1.1', unit: 'days', trend: '', positive: true, hint: 'Optimal Range' },
  { label: 'ROCE %', value: '14.2%', unit: '', trend: '', positive: true, hint: 'Peak Performance' },
]

// Efficiency comparison bars (relative scores vs industry)
const EFFICIENCY_BARS = [
  { label: 'Inventory Turnover', value: 92, color: 'bg-accent' },
  { label: 'Asset Turnover', value: 76, color: 'bg-accent' },
  { label: 'Current Ratio', value: 55, color: 'bg-accent/60' },
]

// Simple inline SVG trend chart (9 data points as a path)
function TrendLine({ values, positive }: { values: number[]; positive: boolean }) {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const w = 120; const h = 36
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = h - ((v - min) / range) * h
    return `${x},${y}`
  })
  const d = 'M ' + pts.join(' L ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" preserveAspectRatio="none">
      <path d={d} fill="none" stroke={positive ? 'var(--color-positive, #22c55e)' : 'var(--color-negative, #ef4444)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function OperatingRatiosTable() {
  const storeRatios = useAppSelector((state) => state.company?.operatingRatios)
  const activeRatios = storeRatios || ratios

  // Map label → data array
  const ratioMap: Record<string, number[]> = {}
  activeRatios.forEach((r: any) => {
    ratioMap[r.label] = r.values as number[]
  })

  const [consolidation, setConsolidation] = useState<'consolidated' | 'standalone'>('consolidated')

  return (
    <div className="space-y-5 select-none">

      {/* ── Quick metric cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {QUICK_METRICS.map((m) => (
          <div key={m.label} className="bg-surface border border-border rounded-xl px-3 py-3.5 shadow-[var(--shadow-sm)]">
            <p className="text-[9px] font-bold uppercase tracking-widest text-textMuted mb-1">{m.label}</p>
            <p className="text-xl font-black font-mono tabular-nums text-textPrimary">{m.value}</p>
            {m.trend ? (
              <div className="flex items-center gap-1 mt-0.5">
                {m.positive ? <ArrowDown className="size-2.5 text-positive" /> : <ArrowUp className="size-2.5 text-negative" />}
                <span className={cn("text-[9px] font-semibold", m.positive ? "text-positive" : "text-negative")}>
                  {m.trend} {m.hint}
                </span>
              </div>
            ) : (
              <p className={cn("text-[9px] font-semibold mt-0.5", m.positive ? "text-positive" : "text-textMuted")}>
                ⊙ {m.hint}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* ── Historical table + charts ─────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-5">

        {/* Left: Historical table */}
        <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-[var(--shadow-sm)]">
          {/* Header */}
          <div className="px-5 py-4 border-b border-border/50 bg-surfaceMuted/30 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-textPrimary">Operating Ratios</h3>
              <p className="text-[10px] text-textMuted mt-0.5 flex items-center gap-1">
                <Info className="size-2.5" />
                Historical operational performance and efficiency metrics. All values in absolute numbers (days) except ROCE (%).
              </p>
            </div>
            <div className="flex items-center gap-1">
              {(['consolidated', 'standalone'] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setConsolidation(c)}
                  className={cn(
                    "px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg border transition-all",
                    consolidation === c
                      ? "bg-accent text-white border-transparent"
                      : "border-border text-textSecondary hover:bg-surfaceMuted"
                  )}
                >
                  {c === 'consolidated' ? 'Consolidated' : 'Standalone'}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-surfaceMuted">
                  <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-textMuted w-48 sticky left-0 bg-surfaceMuted">
                    Metric Name
                  </th>
                  {COLUMNS.map((yr) => (
                    <th key={yr} className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-textMuted whitespace-nowrap">
                      {yr}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {OPERATING_ROWS.map((rowLabel) => {
                  const row = activeRatios.find((r: any) => r.label === rowLabel)
                  if (!row) return null
                  const isPercent = row.isPercent
                  // Map COLUMNS to actual value indices in fiscalYears
                  const displayValues = COLUMNS.map((yr) => {
                    const idx = fiscalYears.indexOf(yr)
                    return idx >= 0 ? (row.values[idx] ?? null) : null
                  })
                  return (
                    <tr key={rowLabel} className="hover:bg-surfaceMuted/40 transition-colors">
                      <td className="px-5 py-3 font-semibold text-textPrimary sticky left-0 bg-surface group-hover:bg-surfaceMuted/40 whitespace-nowrap">
                        {rowLabel.replace(' %', '')}
                      </td>
                      {displayValues.map((val, i) => (
                        <td key={i} className="text-right px-4 py-3 font-mono tabular-nums text-textSecondary">
                          {val !== null ? `${Number(val).toFixed(1)}${isPercent ? '%' : ''}` : '—'}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Trend Analysis + Efficiency Comparison */}
        <div className="space-y-4">
          {/* Trend Analysis */}
          <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-[var(--shadow-sm)]">
            <div className="px-4 py-3 border-b border-border/50 bg-surfaceMuted/30 flex items-center gap-1.5">
              <TrendingUp className="size-3.5 text-accent" />
              <span className="text-[11px] font-bold text-textPrimary uppercase tracking-wider">Trend Analysis</span>
            </div>
            <div className="p-4 space-y-4">
              {['Debtor Days', 'Inventory Days', 'Return on Capital Employed %'].map((rowLabel) => {
                const row = activeRatios.find((r: any) => r.label === rowLabel)
                if (!row) return null
                const vals = (row.values as number[]).slice(0, 9)
                const isPositiveGood = row.isPositiveGood
                return (
                  <div key={rowLabel}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold text-textSecondary">{rowLabel.replace(' %', '')}</span>
                      <span className={cn("text-[10px] font-mono font-bold", isPositiveGood ? "text-positive" : "text-textSecondary")}>
                        {vals[vals.length - 1]?.toFixed(1)}{row.isPercent ? '%' : ''}
                      </span>
                    </div>
                    <div className="h-10">
                      <TrendLine values={vals} positive={!!isPositiveGood} />
                    </div>
                    <div className="flex items-center justify-between text-[8px] font-mono text-textMuted mt-0.5">
                      <span>2020</span>
                      <span>2021</span>
                      <span>2022</span>
                      <span>2023</span>
                      <span>2024</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Efficiency Comparison */}
          <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-[var(--shadow-sm)]">
            <div className="px-4 py-3 border-b border-border/50 bg-surfaceMuted/30">
              <span className="text-[11px] font-bold text-textPrimary uppercase tracking-wider">Efficiency Comparison</span>
            </div>
            <div className="p-4 space-y-4">
              {EFFICIENCY_BARS.map((bar) => (
                <div key={bar.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-semibold text-textSecondary">{bar.label}</span>
                  </div>
                  <div className="h-2.5 w-full bg-surfaceMuted rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", bar.color)} style={{ width: `${bar.value}%` }} />
                  </div>
                </div>
              ))}
              <p className="text-[9px] text-textMuted italic mt-2">
                Compared against 5-year sector average of energy industry.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default OperatingRatiosTable
