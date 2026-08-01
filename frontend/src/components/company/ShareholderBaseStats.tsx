import { useEffect, useState } from 'react'
import { Users, Lock, ShieldAlert } from 'lucide-react'
import { MetricCard } from '@/components/shared/metric-card'
import finscreenApi from '@/services/finscreenApi'

interface CategoryStat {
  label: string
  shareholders: number | null
  lockedInSharesPct: number | null
}

interface BaseStats {
  symbol: string
  period: string | null
  totalShareholders: number | null
  totalShareholdersPrev: number | null
  pledgedSharesPct: number | null
  lockedInSharesPct: number | null
  categories: Record<string, CategoryStat>
}

const CATEGORY_ORDER = ['promoterAndPromoterGroup', 'publicShareholding', 'nonPromoterNonPublic']

function fmtCount(n: number | null | undefined) {
  if (n == null) return '—'
  return n.toLocaleString('en-IN')
}

export function ShareholderBaseStats({ symbol }: { symbol: string }) {
  const [stats, setStats] = useState<BaseStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!symbol || symbol === 'STOCK') return
    let cancelled = false
    setLoading(true)
    finscreenApi.fetchShareholdingBaseStats(symbol)
      .then((data: BaseStats) => { if (!cancelled) setStats(data) })
      .catch(() => { if (!cancelled) setStats(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [symbol])

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 bg-surfaceMuted/40 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (!stats || stats.totalShareholders == null) return null

  const shareholderDelta = stats.totalShareholdersPrev
    ? ((stats.totalShareholders - stats.totalShareholdersPrev) / stats.totalShareholdersPrev) * 100
    : undefined

  const categories = CATEGORY_ORDER
    .map((key) => stats.categories?.[key])
    .filter((c): c is CategoryStat => !!c)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-textPrimary uppercase tracking-wide">
          Shareholder Base {stats.period ? `· ${stats.period}` : ''}
        </h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          label="Total Shareholders"
          value={fmtCount(stats.totalShareholders)}
          changePct={shareholderDelta}
          hint="vs. previous quarter"
        />
        <MetricCard
          label="Pledged Shares"
          value={stats.pledgedSharesPct != null ? stats.pledgedSharesPct.toFixed(2) : '—'}
          unit="%"
          hint="of total share capital"
        />
        <MetricCard
          label="Locked-in Shares"
          value={stats.lockedInSharesPct != null ? stats.lockedInSharesPct.toFixed(2) : '—'}
          unit="%"
          hint="not freely tradable"
        />
      </div>

      {categories.length > 0 && (
        <div className="bg-surface border border-border/40 rounded-xl px-4 py-3 flex flex-col sm:flex-row gap-3 sm:gap-6">
          {categories.map((c) => (
            <div key={c.label} className="flex items-center gap-2 flex-1 min-w-0">
              <Users className="size-3.5 text-textMuted shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-textMuted truncate">{c.label}</p>
                <p className="text-xs font-semibold text-textPrimary">
                  {fmtCount(c.shareholders)} holders
                  {c.lockedInSharesPct != null && c.lockedInSharesPct > 0 && (
                    <span className="ml-1.5 text-warning inline-flex items-center gap-0.5">
                      <Lock className="size-2.5" />{c.lockedInSharesPct.toFixed(2)}% locked-in
                    </span>
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {stats.pledgedSharesPct != null && stats.pledgedSharesPct > 0 && (
        <p className="text-xs text-textMuted flex items-center gap-1.5">
          <ShieldAlert className="size-3 text-warning shrink-0" />
          A share of the company's total capital is pledged by promoters as loan collateral — a heavily pledged company carries added risk if promoters face a margin call.
        </p>
      )}
    </div>
  )
}

export default ShareholderBaseStats
