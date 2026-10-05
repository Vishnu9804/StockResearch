import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatNumber, formatPct, changeClass } from "@/lib/formatters"
import { MetricCard } from "@/components/shared/metric-card"
import { Link } from "react-router-dom"
import { marketIndices } from "@/lib/data/market"
import { TrendingUp, TrendingDown } from "lucide-react"

// ─── Static Fallback Config ──────────────────────────────────────────────────
// Maps display name → { symbol used in URL, exchange label }
const STATIC_INDEX_CONFIG: { name: string; symbol: string; exchange: string }[] = [
  { name: 'NIFTY 50',          symbol: 'NIF50',       exchange: 'NSE' },
  { name: 'SENSEX',            symbol: 'SNSXBSE30',   exchange: 'BSE' },
  { name: 'BANK NIFTY',        symbol: 'NIFBAN',      exchange: 'NSE' },
  { name: 'NIFTY IT',          symbol: 'NIFIT',       exchange: 'NSE' },
  { name: 'NIFTY MIDCAP 100',  symbol: 'NIFMDCP100',  exchange: 'NSE' },
  { name: 'NIFTY SMALLCAP 100',symbol: 'NIFSMCP100',  exchange: 'NSE' },
  { name: 'NIFTY AUTO',        symbol: 'NIFAUTO',     exchange: 'NSE' },
  { name: 'NIFTY PHARMA',      symbol: 'NIFPHRM',     exchange: 'NSE' },
  { name: 'NIFTY FMCG',        symbol: 'NIFFMCG',     exchange: 'NSE' },
  { name: 'NIFTY METAL',       symbol: 'NIFMETAL',    exchange: 'NSE' },
]

// Friendly display name lookup from raw API index_name
function friendlyName(raw: string): string {
  const map: Record<string, string> = {
    'Nifty 50': 'NIFTY 50',
    'Nifty Bank': 'BANK NIFTY',
    'Nifty IT': 'NIFTY IT',
    'Nifty Midcap 100': 'NIFTY MIDCAP 100',
    'Nifty Smallcap 100': 'NIFTY SMALLCAP 100',
    'Nifty Auto': 'NIFTY AUTO',
    'Nifty Pharma': 'NIFTY PHARMA',
    'Nifty FMCG': 'NIFTY FMCG',
    'Nifty Metal': 'NIFTY METAL',
    'Sensex': 'SENSEX',
    'S&P BSE SENSEX': 'SENSEX',
    'India VIX': 'INDIA VIX',
  }
  return map[raw] ?? raw?.toUpperCase()
}

// Exchange label from index_symbol prefix
function exchangeLabel(sym: string): string {
  if (!sym) return 'NSE'
  const s = sym.toUpperCase()
  if (s.startsWith('SNSX') || s.startsWith('BSE')) return 'BSE'
  return 'NSE'
}

interface MarketOverviewProps {
  loading: boolean
  indices: any[]
}

export function MarketOverview({ loading, indices }: MarketOverviewProps) {
  // ── Skeleton ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
        {Array.from({ length: 8 }).map((_, i) => (
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

  // ── Build display list using loop engineering ─────────────────────────────
  // First try live API data, loop over STATIC_INDEX_CONFIG to match & enrich
  // If API has data, merge live values; otherwise fall back to static data.
  const hasLiveData = Array.isArray(indices) && indices.length > 0

  const displayItems = STATIC_INDEX_CONFIG.map((cfg, i) => {
    const staticFallback = marketIndices[i] ?? marketIndices[0]

    if (hasLiveData) {
      // Try exact index_symbol match first
      let live = indices.find(
        (idx: any) => idx.index_symbol === cfg.symbol
      )
      // Then try partial index_name match (fuzzy)
      if (!live) {
        live = indices.find(
          (idx: any) =>
            idx.index_name &&
            (idx.index_name.toLowerCase().includes(cfg.name.split(' ')[1]?.toLowerCase() ?? '') ||
             friendlyName(idx.index_name) === cfg.name)
        )
      }

      if (live) {
        return {
          name: cfg.name,
          symbol: live.index_symbol ?? cfg.symbol,  // use real symbol for deep link
          exchange: exchangeLabel(live.index_symbol ?? cfg.symbol),
          value: live.close_price ?? staticFallback.value,
          change: live.points_change ?? staticFallback.change,
          changePct: live.change_pct ?? staticFallback.changePct,
          isLive: true,
        }
      }
    }

    // Pure static fallback
    return {
      name: cfg.name,
      symbol: cfg.symbol,
      exchange: cfg.exchange,
      value: staticFallback.value,
      change: staticFallback.change,
      changePct: staticFallback.changePct,
      isLive: false,
    }
  })

  return (
    <div className="space-y-3">
      {/* Live indicator */}
      <div className="flex items-center gap-2">
        <span className={`size-1.5 rounded-full ${hasLiveData ? 'bg-positive animate-pulse' : 'bg-amber-400'}`} />
        <span className="text-xs text-textMuted font-medium">
          {hasLiveData ? `Live data · ${indices.length} indices loaded` : 'Delayed data'}
        </span>
      </div>

      {/* ── Index Cards Grid — loop over all indices ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
        {displayItems.map((idx, i) => {
          const positive = idx.change >= 0
          // Use the real index_symbol directly so IndexDetail gets the correct symbol
          const slug = encodeURIComponent(idx.symbol)

          return (
            <Link
              key={idx.name}
              to={`/index/${slug}`}
              className="block group"
              aria-label={`View ${idx.name} details`}
            >
              <Card
                className={`
                  cursor-pointer bg-surface border-border/40 shadow-xs
                  hover:shadow-md hover:border-accent/40
                  rounded-xl animate-count-up transition-all duration-200
                  stagger-${Math.min((i % 4) + 1, 4)}
                  group-hover:scale-[1.015]
                `}
              >
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 pt-4 px-5">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="tracking-tight truncate text-sm leading-tight">
                      {idx.name}
                    </CardTitle>
                    <p className="text-xs text-textMuted font-medium mt-0.5">
                      {idx.exchange} Index
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-mono font-medium tabular-nums flex items-center gap-1 ${
                      positive
                        ? 'bg-positive-soft text-positive'
                        : 'bg-negative-soft text-negative'
                    }`}
                  >
                    {positive
                      ? <TrendingUp className="size-3" />
                      : <TrendingDown className="size-3" />
                    }
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
    </div>
  )
}

// ─── BreadthCards (unchanged logic, extracted cleanly) ────────────────────────

interface BreadthCardsProps {
  loading: boolean
  indices: any[]
  quotes: Record<string, any>
}

export function BreadthCards({ loading, indices, quotes }: BreadthCardsProps) {
  // Skeleton only while the request is in flight. It used to stay up for as
  // long as `quotes` was empty, so a failed /market/movers call meant shimmer
  // forever; now the cards render with "—" for anything genuinely missing.
  if (loading) {
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

  // Advances/declines and 52-week highs/lows, all from the same batch quotes
  // (live, or the backend's flagged snapshot when live quotes are refused).
  // No mock fallback: invented breadth numbers are worse than "—".
  let advances = 0
  let declines = 0
  let unchanged = 0
  let highs52 = 0
  let lows52 = 0
  let asOf: string | null = null

  Object.values(quotes || {}).forEach((q: any) => {
    if (!q) return
    if (q.stale && q.as_of && !asOf) asOf = q.as_of
    if (q.change !== undefined && q.change !== null) {
      const changeVal = parseFloat(String(q.change).replace('%', ''))
      if (changeVal > 0) advances++
      else if (changeVal < 0) declines++
      else unchanged++
    }
    const price = Number(q.current_price || q.close_price || 0)
    if (price > 0 && Number(q.high52) > 0 && price >= Number(q.high52) * 0.99) highs52++
    if (price > 0 && Number(q.low52) > 0 && price <= Number(q.low52) * 1.01) lows52++
  })

  const hasBreadth = advances + declines + unchanged > 0
  const total = advances + declines + unchanged
  const advPct = total > 0 ? (advances / total) * 100 : 50
  const decPct = total > 0 ? (declines / total) * 100 : 50
  const breadthHint = asOf
    ? `Snapshot ${new Date(asOf).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`
    : 'Today'

  // India VIX comes from the (live) index feed.
  const vixLive = indices?.find(
    (idx: any) => idx.index_symbol === 'INDVIX' || idx.index_name?.toLowerCase().includes('vix')
  )

  return (
    <div className="grid grid-cols-2 gap-5 md:grid-cols-4 animate-count-up">
      <Card className="border-border/40 shadow-xs bg-surface rounded-xl hover:shadow-sm hover:border-accent/20 transition-all duration-200">
        <CardContent className="px-4 py-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            Advance / Decline
          </div>
          <div className="mt-1 flex items-baseline gap-2 font-mono tabular">
            <span className="text-positive text-2xl font-semibold">
              {hasBreadth ? advances : '—'}
            </span>
            <span className="text-muted-foreground">/</span>
            <span className="text-negative text-2xl font-semibold">
              {hasBreadth ? declines : '—'}
            </span>
            {hasBreadth && <span className="text-xs text-textMuted font-sans ml-auto">{breadthHint}</span>}
          </div>
          <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="bg-positive" style={{ width: `${advPct}%` }} />
            <div className="bg-negative" style={{ width: `${decPct}%` }} />
          </div>
        </CardContent>
      </Card>

      <MetricCard
        label="India VIX"
        value={vixLive ? formatNumber(vixLive.close_price, 2) : '—'}
        changePct={vixLive ? vixLive.change_pct : undefined}
        hint="Volatility index"
      />

      {/* These two replaced "FII / DII Net Flow", which were hard-coded mock
          numbers: no data source in this app provides institutional flows. */}
      <MetricCard
        label="52W Highs"
        value={hasBreadth ? highs52 : '—'}
        unit={hasBreadth ? 'stocks' : undefined}
        hint={hasBreadth ? `Within 1% · ${breadthHint}` : 'Within 1% of 52W high'}
      />

      <MetricCard
        label="52W Lows"
        value={hasBreadth ? lows52 : '—'}
        unit={hasBreadth ? 'stocks' : undefined}
        hint={hasBreadth ? `Within 1% · ${breadthHint}` : 'Within 1% of 52W low'}
      />
    </div>
  )
}
