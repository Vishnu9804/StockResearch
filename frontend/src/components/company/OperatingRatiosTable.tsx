
import { useState, useMemo } from 'react'
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
  const storeRatios = useAppSelector((state) => state.company?.ratios)

  // Determine standard ratios list dynamically from state if present, otherwise fall back to static mock ratios
  const activeRatios = useMemo(() => {
    if (storeRatios && Array.isArray(storeRatios.sections)) {
      const flatRows: any[] = []
      storeRatios.sections.forEach((sec: any) => {
        if (Array.isArray(sec.rows)) {
          flatRows.push(...sec.rows)
        }
      })
      if (flatRows.length > 0) return flatRows
    }
    return ratios
  }, [storeRatios])

  // Extract columns dynamically from state if present, otherwise fall back to static mock columns
  const columns = useMemo(() => {
    if (storeRatios && Array.isArray(storeRatios.sections) && storeRatios.sections[0]?.columns) {
      return storeRatios.sections[0].columns
    }
    return fiscalYears.slice(2, 10)
  }, [storeRatios])

  const isLive = useMemo(() => {
    if (!storeRatios || !Array.isArray(storeRatios.sections)) return false
    return storeRatios.sections.some((sec: any) => Array.isArray(sec.rows) && sec.rows.length > 0)
  }, [storeRatios])

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
            <p className="text-xs font-medium uppercase tracking-widest text-textMuted mb-1">{m.label}</p>
            <p className="text-xl font-medium font-mono tabular-nums text-textPrimary">{m.value}</p>
            {m.trend ? (
              <div className="flex items-center gap-1 mt-0.5">
                {m.positive ? <ArrowDown className="size-2.5 text-positive" /> : <ArrowUp className="size-2.5 text-negative" />}
                <span className={cn("text-xs font-medium", m.positive ? "text-positive" : "text-negative")}>
                  {m.trend} {m.hint}
                </span>
              </div>
            ) : (
              <p className={cn("text-xs font-medium mt-0.5", m.positive ? "text-positive" : "text-textMuted")}>
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
              <h3 className="text-sm font-medium text-textPrimary">Operating Ratios</h3>
              <p className="text-xs text-textMuted mt-0.5 flex items-center gap-1">
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
                    "px-3 py-1.5 text-xs font-medium uppercase tracking-wider rounded-lg border transition-all",
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
                  <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider text-textMuted w-48 sticky left-0 bg-surfaceMuted">
                    Metric Name
                  </th>
                  {columns.map((yr: string) => (
                    <th key={yr} className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-textMuted whitespace-nowrap">
                      {yr}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {isLive ? (
                  activeRatios.map((row: any) => {
                    const isPercent = row.isPercent
                    return (
                      <tr key={row.label} className="hover:bg-surfaceMuted/40 transition-colors">
                        <td className="px-5 py-3 font-medium text-textPrimary sticky left-0 bg-surface group-hover:bg-surfaceMuted/40 whitespace-nowrap">
                          {row.label.replace(' %', '')}
                        </td>
                        {(row.values || []).map((val: any, i: number) => (
                          <td key={i} className="text-right px-4 py-3 font-mono tabular-nums text-textSecondary">
                            {val !== null ? `${Number(val).toFixed(isPercent ? 1 : 2)}${isPercent ? '%' : ''}` : '—'}
                          </td>
                        ))}
                      </tr>
                    )
                  })
                ) : (
                  OPERATING_ROWS.map((rowLabel) => {
                    const row = activeRatios.find((r: any) => r.label === rowLabel)
                    if (!row) return null
                    const isPercent = row.isPercent
                    const displayValues = COLUMNS.map((yr) => {
                      const idx = fiscalYears.indexOf(yr)
                      return idx >= 0 ? (row.values[idx] ?? null) : null
                    })
                    return (
                      <tr key={rowLabel} className="hover:bg-surfaceMuted/40 transition-colors">
                        <td className="px-5 py-3 font-medium text-textPrimary sticky left-0 bg-surface group-hover:bg-surfaceMuted/40 whitespace-nowrap">
                          {rowLabel.replace(' %', '')}
                        </td>
                        {displayValues.map((val, i) => (
                          <td key={i} className="text-right px-4 py-3 font-mono tabular-nums text-textSecondary">
                            {val !== null ? `${Number(val).toFixed(1)}${isPercent ? '%' : ''}` : '—'}
                          </td>
                        ))}
                      </tr>
                    )
                  })
                )}
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
              <span className="text-xs font-medium text-textPrimary uppercase tracking-wider">Trend Analysis</span>
            </div>
            <div className="p-4 space-y-4">
              {(isLive ? ['ROCE (%)', 'Asset Turnover', 'Debt to Equity'] : ['Debtor Days', 'Inventory Days', 'Return on Capital Employed %']).map((rowLabel) => {
                const row = activeRatios.find((r: any) => r.label === rowLabel)
                if (!row) return null
                const vals = (row.values as number[]).filter((v): v is number => v !== null && v !== undefined).slice(-5)
                if (vals.length === 0) return null
                const isPositiveGood = rowLabel !== 'Debt to Equity'
                return (
                  <div key={rowLabel}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-textSecondary">{rowLabel.replace(' %', '')}</span>
                      <span className={cn("text-xs font-mono font-medium", isPositiveGood ? "text-positive" : "text-textSecondary")}>
                        {vals[vals.length - 1]?.toFixed(1)}{row.isPercent ? '%' : ''}
                      </span>
                    </div>
                    <div className="h-10">
                      <TrendLine values={vals} positive={!!isPositiveGood} />
                    </div>
                    <div className="flex items-center justify-between text-xs font-mono text-textMuted mt-0.5">
                      {columns.slice(-5).map((col: string) => (
                        <span key={col}>{col.replace(/Mar['\s]?/i, '')}</span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Efficiency Comparison */}
          <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-[var(--shadow-sm)]">
            <div className="px-4 py-3 border-b border-border/50 bg-surfaceMuted/30">
              <span className="text-xs font-medium text-textPrimary uppercase tracking-wider">Efficiency Comparison</span>
            </div>
            <div className="p-4 space-y-4">
              {EFFICIENCY_BARS.map((bar) => (
                <div key={bar.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-textSecondary">{bar.label}</span>
                  </div>
                  <div className="h-2.5 w-full bg-surfaceMuted rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", bar.color)} style={{ width: `${bar.value}%` }} />
                  </div>
                </div>
              ))}
              <p className="text-xs text-textMuted italic mt-2">
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
