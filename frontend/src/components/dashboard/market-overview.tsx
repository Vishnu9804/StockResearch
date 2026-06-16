import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatNumber, formatPct, changeClass } from "@/lib/formatters"
import { MetricCard } from "@/components/shared/metric-card"
import { Link } from "react-router-dom"
import { marketIndices, marketBreadth } from "@/lib/data/market"

// Map display names to URL slugs for deep linking
const INDEX_SLUG: Record<string, string> = {
  'NIFTY 50': 'NIFTY50',
  'SENSEX': 'SENSEX',
  'BANK NIFTY': 'BANKNIFTY',
  'NIFTY IT': 'NIFTYIT',
  'NIFTY MIDCAP 100': 'NIFTYMIDCAP',
  'NIFTY SMALLCAP 100': 'NIFTY50', // fallback
  'NIFTY AUTO': 'NIFTY50',
  'NIFTY PHARMA': 'NIFTY50',
  'NIFTY FMCG': 'NIFTY50',
  'NIFTY METAL': 'NIFTY50',
}

interface MarketOverviewProps {
  loading: boolean
  indices: any[]
}

export function MarketOverview({ loading, indices }: MarketOverviewProps) {
  if (loading || !indices || indices.length === 0) {
    return (
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-border/40 shadow-xs bg-surface rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-1">
              <div className="space-y-1 flex-1">
                <div className="h-4 w-24 rounded shimmer-skeleton" />
                <div className="h-3 w-16 rounded shimmer-skeleton" />
              </div>
              <div className="h-5 w-12 rounded-md shimmer-skeleton" />
            </CardHeader>
            <CardContent className="space-y-1.5">
              <div className="h-8 w-28 rounded shimmer-skeleton" />
              <div className="h-4 w-20 rounded shimmer-skeleton" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  // Find live indices or use fallback from static data
  const nifty50Live = indices.find(idx => idx.index_symbol === 'NIF50')
  const sensexLive = indices.find(idx => idx.index_symbol === 'SNSXSENSEX' || idx.index_symbol === 'SNSXBSE30')
  const bankNiftyLive = indices.find(idx => idx.index_symbol === 'NIFBAN')
  const niftyItLive = indices.find(idx => idx.index_symbol === 'NIFIT')

  const featured = [
    {
      name: 'NIFTY 50',
      value: nifty50Live ? nifty50Live.close_price : marketIndices[0].value,
      change: nifty50Live ? nifty50Live.points_change : marketIndices[0].change,
      changePct: nifty50Live ? nifty50Live.change_pct : marketIndices[0].changePct,
    },
    {
      name: 'SENSEX',
      value: sensexLive ? sensexLive.close_price : marketIndices[1].value,
      change: sensexLive ? sensexLive.points_change : marketIndices[1].change,
      changePct: sensexLive ? sensexLive.change_pct : marketIndices[1].changePct,
    },
    {
      name: 'BANK NIFTY',
      value: bankNiftyLive ? bankNiftyLive.close_price : marketIndices[2].value,
      change: bankNiftyLive ? bankNiftyLive.points_change : marketIndices[2].change,
      changePct: bankNiftyLive ? bankNiftyLive.change_pct : marketIndices[2].changePct,
    },
    {
      name: 'NIFTY IT',
      value: niftyItLive ? niftyItLive.close_price : marketIndices[3].value,
      change: niftyItLive ? niftyItLive.points_change : marketIndices[3].change,
      changePct: niftyItLive ? niftyItLive.change_pct : marketIndices[3].changePct,
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
      {featured.map((idx, i) => {
        const positive = idx.change >= 0
        const slug = INDEX_SLUG[idx.name] ?? 'NIFTY50'
        return (
          <Link key={idx.name} to={`/index/${slug}`} className="block">
            <Card className={`hover:border-accent/30 cursor-pointer bg-surface border-border/40 shadow-xs hover:shadow-sm rounded-xl animate-count-up stagger-${Math.min(i + 1, 4)} transition-all duration-200`}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 pt-4 px-5">
                <div>
                  <CardTitle className="tracking-tight">
                    {idx.name}
                  </CardTitle>
                  <p className="text-xs text-textMuted font-medium mt-0.5">NSE Index</p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-mono font-medium tabular-nums ${
                    positive
                      ? 'bg-positive-soft text-positive'
                      : 'bg-negative-soft text-negative'
                  }`}
                >
                  {formatPct(idx.changePct)}
                </span>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                <div className="font-mono tabular text-2xl font-semibold tracking-tight text-textPrimary">
                  {formatNumber(idx.value, 2)}
                </div>
                <div className={`mt-1 font-mono tabular text-body font-medium ${changeClass(idx.change)}`}>
                  {idx.change >= 0 ? '+' : ''}
                  {formatNumber(idx.change, 2)} pts
                </div>
              </CardContent>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}

interface BreadthCardsProps {
  loading: boolean
  indices: any[]
  quotes: Record<string, any>
}

export function BreadthCards({ loading, indices, quotes }: BreadthCardsProps) {
  if (loading || !quotes || Object.keys(quotes).length === 0) {
    return (
      <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-border/40 shadow-xs bg-surface rounded-xl">
            <CardContent className="px-4 py-3.5 space-y-2">
              <div className="h-3 w-20 rounded shimmer-skeleton" />
              <div className="h-6 w-16 rounded shimmer-skeleton" />
              <div className="h-1.5 w-full rounded-full shimmer-skeleton" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  // Calculate Advances and Declines from live quotes
  let advances = 0
  let declines = 0
  let unchanged = 0

  Object.values(quotes).forEach((q: any) => {
    if (q && q.change) {
      const changeVal = parseFloat(q.change.replace('%', ''))
      if (changeVal > 0) advances++
      else if (changeVal < 0) declines++
      else unchanged++
    }
  })

  // Fallback to mock breadth if quotes are empty
  if (advances === 0 && declines === 0) {
    advances = marketBreadth.advances
    declines = marketBreadth.declines
    unchanged = marketBreadth.unchanged
  }

  const total = advances + declines + unchanged
  const advPct = total > 0 ? (advances / total) * 100 : 50
  const decPct = total > 0 ? (declines / total) * 100 : 50

  // Find India VIX from indices
  const vixLive = indices?.find(idx => idx.index_symbol === 'INDVIX')
  const vixValue = vixLive ? vixLive.close_price : marketBreadth.vix
  const vixChangePct = vixLive ? vixLive.change_pct : marketBreadth.vixChangePct

  return (
    <div className="grid grid-cols-2 gap-5 md:grid-cols-4 animate-count-up">
      <Card className="border-border/40 shadow-xs bg-surface rounded-xl hover:shadow-sm hover:border-accent/20 transition-all duration-200">
        <CardContent className="px-4 py-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            Advance / Decline
          </div>
          <div className="mt-1 flex items-baseline gap-2 font-mono tabular">
            <span className="text-positive text-2xl font-semibold">
              {advances}
            </span>
            <span className="text-muted-foreground">/</span>
            <span className="text-negative text-2xl font-semibold">
              {declines}
            </span>
          </div>
          <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="bg-positive" style={{ width: `${advPct}%` }} />
            <div className="bg-negative" style={{ width: `${decPct}%` }} />
          </div>
        </CardContent>
      </Card>

      <MetricCard
        label="India VIX"
        value={formatNumber(vixValue, 2)}
        changePct={vixChangePct}
        hint="Volatility index"
      />

      <MetricCard
        label="FII Net Flow"
        value={`+₹${formatNumber(marketBreadth.fiiNetCr, 0)}`}
        unit="Cr"
        hint="Today, equities"
      />

      <MetricCard
        label="DII Net Flow"
        value={`+₹${formatNumber(marketBreadth.diiNetCr, 0)}`}
        unit="Cr"
        hint="Today, equities"
      />
    </div>
  )
}
