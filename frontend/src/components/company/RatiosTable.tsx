import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import finscreenApi from '@/services/finscreenApi'

interface RatioRow {
  label: string
  isPercent: boolean
  values: (number | null)[]
}

interface RatioSection {
  section: string
  columns: string[]
  rows: RatioRow[]
}

const SECTION_EMOJI: Record<string, string> = {
  Profitability: '📈',
  Leverage: '🏦',
  Liquidity: '💧',
  Efficiency: '⚙️',
}

// Show only the latest value for each row in a compact display
function LatestRatioRow({ row }: { row: RatioRow }) {
  const latestVal = row.values.findLast((v) => v !== null && v !== undefined)
  if (latestVal === null || latestVal === undefined) return null
  const display = row.isPercent ? `${latestVal.toFixed(1)}%` : latestVal.toFixed(2)
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
      <span className="text-xs font-medium text-textSecondary">{row.label}</span>
      <span className="text-xs font-mono font-semibold text-textPrimary tabular-nums">
        {display}
      </span>
    </div>
  )
}

// Historical trend table for a ratio section
function RatioSectionTable({ section }: { section: RatioSection }) {
  // Show last 7 columns max
  const cols = section.columns.slice(-7)
  const colCount = cols.length
  const rowsWithData = section.rows.filter(r =>
    r.values.slice(-colCount).some(v => v !== null && v !== undefined)
  )
  if (rowsWithData.length === 0) return null

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm">{SECTION_EMOJI[section.section] ?? '📊'}</span>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-textMuted">{section.section}</h4>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/40">
              <th className="text-left font-medium text-textMuted pb-2 pr-4 min-w-[160px]">Metric</th>
              {cols.map((col) => (
                <th key={col} className="text-right font-medium text-textMuted pb-2 px-2 whitespace-nowrap">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowsWithData.map((row) => {
              const vals = row.values.slice(-colCount)
              const latest = vals.findLast(v => v !== null && v !== undefined)
              return (
                <tr key={row.label} className="border-b border-border/20 hover:bg-surfaceMuted/30 transition-colors">
                  <td className="py-2 pr-4 font-medium text-textSecondary">{row.label}</td>
                  {vals.map((val, i) => {
                    const isLatest = i === vals.length - 1
                    const display = val !== null && val !== undefined
                      ? (row.isPercent ? `${val.toFixed(1)}%` : val.toFixed(2))
                      : '—'
                    return (
                      <td
                        key={i}
                        className={cn(
                          'py-2 px-2 text-right font-mono tabular-nums whitespace-nowrap',
                          val !== null && val !== undefined ? 'text-textPrimary' : 'text-textMuted',
                          isLatest && val !== null ? 'font-semibold text-accent' : ''
                        )}
                      >
                        {display}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function RatiosTable({ symbol }: { symbol: string; pe?: number; price?: number; high52w?: number; low52w?: number }) {
  const [loading, setLoading] = useState(true)
  const [sections, setSections] = useState<RatioSection[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!symbol) return
    let cancelled = false
    setLoading(true)
    setError(null)

    finscreenApi.fetchCompanyRatios(symbol)
      .then((data: any) => {
        if (cancelled) return
        if (data && Array.isArray(data.sections)) {
          setSections(data.sections)
        } else {
          setSections([])
        }
      })
      .catch((err: any) => {
        if (cancelled) return
        console.error('[RatiosTable] Failed to load ratios:', err)
        setError('Could not load ratio data.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [symbol])

  if (loading) {
    return (
      <Card className="border-border shadow-none bg-surface">
        <CardHeader className="border-b border-border/50 bg-surfaceMuted/20">
          <CardTitle className="text-sm font-medium text-textPrimary uppercase tracking-wide">Key Financial Ratios</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-3">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="h-4 bg-border/30 rounded animate-pulse" style={{ width: `${60 + i * 8}%` }} />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || sections.length === 0 || sections.every(s => s.rows.length === 0)) {
    return (
      <Card className="border-border shadow-none bg-surface">
        <CardHeader className="border-b border-border/50 bg-surfaceMuted/20">
          <CardTitle className="text-sm font-medium text-textPrimary uppercase tracking-wide">Key Financial Ratios</CardTitle>
        </CardHeader>
        <CardContent className="p-6 text-center text-xs text-textMuted">
          {error ?? 'No ratio data available for this company.'}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border shadow-none bg-surface">
      <CardHeader className="border-b border-border/50 bg-surfaceMuted/20">
        <CardTitle className="text-sm font-medium text-textPrimary uppercase tracking-wide">
          Key Financial Ratios
        </CardTitle>
        <p className="text-xs text-textMuted mt-0.5">Historical trend · Annual data</p>
      </CardHeader>
      <CardContent className="p-5">
        {sections.map((section) => (
          <RatioSectionTable key={section.section} section={section} />
        ))}
      </CardContent>
    </Card>
  )
}

export default RatiosTable
