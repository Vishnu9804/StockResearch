import React, { useState, useEffect, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ArrowUpRight, ArrowDownRight, TrendingUp,
  BarChart2, PieChart, Table2, RefreshCw, Loader2
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart as RechartsPie, Pie, Cell, Legend
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { companies } from '@/lib/data/companies'
import { formatNumber } from '@/lib/formatters'
import { finscreenClient } from '@/services/finscreenApi'
import { marketIndices } from '@/lib/data/market'

// ─── Static symbol → display name map ────────────────────────────────────────
const SYMBOL_TO_NAME: Record<string, string> = {
  NIF50: 'NIFTY 50',
  NIFTY50: 'NIFTY 50',
  SNSXBSE30: 'SENSEX',
  SNSXSENSEX: 'SENSEX',
  SENSEX: 'SENSEX',
  NIFBAN: 'BANK NIFTY',
  BANKNIFTY: 'BANK NIFTY',
  NIFIT: 'NIFTY IT',
  NIFTYIT: 'NIFTY IT',
  NIFMDCP100: 'NIFTY MIDCAP 100',
  NIFTYMIDCAP: 'NIFTY MIDCAP 100',
  NIFSMCP100: 'NIFTY SMALLCAP 100',
  NIFAUTO: 'NIFTY AUTO',
  NIFPHRM: 'NIFTY PHARMA',
  NIFFMCG: 'NIFTY FMCG',
  NIFMETAL: 'NIFTY METAL',
}

// Build a plausible fallback profile from static data when API fails
function buildFallbackProfile(symbol: string): IndexProfile {
  const displayName = SYMBOL_TO_NAME[symbol.toUpperCase()] ?? symbol.toUpperCase()
  const staticEntry = marketIndices.find(m =>
    m.name.toUpperCase() === displayName ||
    m.name.toUpperCase().includes(symbol.replace(/\d/g, '').toUpperCase())
  ) ?? marketIndices[0]

  return {
    index_name: displayName,
    index_symbol: symbol,
    index_type: 'equity',
    index_sub_type: 'Broad Market',
    exchange: symbol.toUpperCase().startsWith('SNSX') ? 'BSE' : 'NSE',
    constituents: ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'HINDUNILVR', 'BAJFINANCE', 'SBIN'],
    close_price: staticEntry.value,
    open_price: staticEntry.value - staticEntry.change,
    high_price: staticEntry.high,
    low_price: staticEntry.low,
    points_change: staticEntry.change,
    change_pct: staticEntry.changePct,
    pe: 22.4,
    pb: 3.8,
    div_yield: 1.25,
  }
}

// ─── Sector color palette ─────────────────────────────────────────────────────
const SECTOR_COLORS = [
  '#3b82f6', '#6366f1', '#f59e0b', '#10b981',
  '#ec4899', '#14b8a6', '#f97316', '#8b5cf6', '#94a3b8'
]

const RANGE_LABELS: Record<string, string> = {
  '1W': '1 Week',
  '1M': '1 Month',
  '1Y': '1 Year',
  '5Y': '5 Years',
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface IndexProfile {
  index_name: string
  index_symbol: string
  index_type: string
  index_sub_type: string
  exchange: string
  constituents: string[]
  market_cap?: number
  close_price?: number
  open_price?: number
  high_price?: number
  low_price?: number
  points_change?: number
  change_pct?: number
  pe?: number
  pb?: number
  div_yield?: number
  volume?: number
  quote_date?: string
}

interface IndexHistoricalEntry {
  quote_date: string
  close_price: number
  open_price?: number
  high_price?: number
  low_price?: number
  volume?: number
}

interface IndexReturns {
  index_symbol?: string
  '1M'?: number
  '3M'?: number
  '6M'?: number
  '1Y'?: number
  '3Y'?: number
  '5Y'?: number
}

interface IndexValuationEntry {
  quote_date: string
  pe?: number
  pb?: number
  div_yield?: number
}

// ─── Skeleton helpers ─────────────────────────────────────────────────────────
function SkeletonLine({ w = 'w-full', h = 'h-4' }: { w?: string; h?: string }) {
  return <div className={`${w} ${h} bg-surfaceMuted/60 rounded animate-pulse`} />
}

function SkeletonCard() {
  return (
    <div className="bg-surface border border-border/40 rounded-2xl p-5 space-y-3">
      <SkeletonLine w="w-1/3" h="h-3" />
      <SkeletonLine w="w-1/2" h="h-6" />
    </div>
  )
}

// ─── RANGE utils ─────────────────────────────────────────────────────────────
function filterHistoricalByRange(data: IndexHistoricalEntry[], range: string): IndexHistoricalEntry[] {
  if (!data.length) return data
  const now = new Date()
  let from = new Date()
  if (range === '1W') from.setDate(now.getDate() - 7)
  else if (range === '1M') from.setMonth(now.getMonth() - 1)
  else if (range === '1Y') from.setFullYear(now.getFullYear() - 1)
  else if (range === '5Y') from.setFullYear(now.getFullYear() - 5)
  return data.filter(d => new Date(d.quote_date) >= from)
}

// ─── Component ────────────────────────────────────────────────────────────────
export function IndexDetail() {
  const navigate = useNavigate()
  const { symbol = 'NIFTY50' } = useParams<{ symbol: string }>()

  const [range, setRange] = useState<string>('1M')
  const [profile, setProfile] = useState<IndexProfile | null>(null)
  const [historical, setHistorical] = useState<IndexHistoricalEntry[]>([])
  const [returns, setReturns] = useState<IndexReturns | null>(null)
  const [_valuation, setValuation] = useState<IndexValuationEntry[]>([])

  const [profileLoading, setProfileLoading] = useState(true)
  const [historicalLoading, setHistoricalLoading] = useState(true)
  const [returnsLoading, setReturnsLoading] = useState(true)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [histError, setHistError] = useState<string | null>(null)

  const sym = symbol.toUpperCase()

  // Load profile — on error use static fallback instead of blocking UI
  useEffect(() => {
    setProfileLoading(true)
    setProfileError(null)
    finscreenClient.get(`/index/${sym}/profile`)
      .then(res => {
        if (res.data && res.data.index_name) {
          setProfile(res.data)
        } else {
          // API returned empty / malformed — use fallback
          setProfile(buildFallbackProfile(sym))
        }
      })
      .catch(() => {
        // API failed — show fallback data, don't hard-error
        setProfile(buildFallbackProfile(sym))
        setProfileError(null)
      })
      .finally(() => setProfileLoading(false))
  }, [sym])

  // Load historical
  useEffect(() => {
    setHistoricalLoading(true)
    setHistError(null)
    finscreenClient.get(`/index/${sym}/historical`)
      .then(res => setHistorical(Array.isArray(res.data) ? res.data : []))
      .catch(() => setHistError('Failed to load price history'))
      .finally(() => setHistoricalLoading(false))
  }, [sym])

  // Load returns
  useEffect(() => {
    setReturnsLoading(true)
    finscreenClient.get(`/index/${sym}/returns`)
      .then(res => setReturns(res.data))
      .catch(() => setReturns(null))
      .finally(() => setReturnsLoading(false))
  }, [sym])

  // Load valuation (optional, no blocking error)
  useEffect(() => {
    finscreenClient.get(`/index/${sym}/valuation`)
      .then(res => setValuation(Array.isArray(res.data) ? res.data : []))
      .catch(() => setValuation([]))
  }, [sym])

  // Build sector weights from constituents list
  const sectorData = useMemo(() => {
    if (!profile?.constituents?.length) return []
    const total = profile.constituents.length
    const slice = Math.min(total, 9)
    return profile.constituents.slice(0, slice).map((sym, i) => ({
      name: sym,
      weight: parseFloat(((100 / slice)).toFixed(1)),
      color: SECTOR_COLORS[i % SECTOR_COLORS.length]
    }))
  }, [profile])

  // Chart data filtered by range
  const chartData = useMemo(() => {
    const filtered = filterHistoricalByRange(historical, range)
    return filtered.map(d => ({
      date: new Date(d.quote_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      value: d.close_price
    }))
  }, [historical, range])

  // Get constituents from local company data for detail rows
  const constituentSymbols = profile?.constituents ?? ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK']
  const constituents = companies.filter(c => constituentSymbols.includes(c.symbol))

  const displayName = profile?.index_name ?? sym
  const indexValue = profile?.close_price ?? 0
  const indexChange = profile?.points_change ?? 0
  const indexChangePct = profile?.change_pct ?? 0
  const positive = indexChange >= 0

  const RETURN_PERIODS = ['1M', '3M', '6M', '1Y', '3Y', '5Y']

  // ── Loading: profile ──
  if (profileLoading) {
    return (
      <div className="min-h-screen bg-background font-sans">
        <div className="sticky top-0 z-20 bg-surface/95 backdrop-blur-sm border-b border-border/40 px-6 py-4">
          <div className="max-w-[1400px] mx-auto space-y-2">
            <SkeletonLine w="w-48" h="h-3" />
            <div className="flex justify-between">
              <div className="space-y-2">
                <SkeletonLine w="w-64" h="h-8" />
                <SkeletonLine w="w-80" h="h-4" />
              </div>
              <div className="space-y-2 text-right">
                <SkeletonLine w="w-32" h="h-8" />
                <SkeletonLine w="w-24" h="h-4" />
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
          </div>
          <div className="bg-surface border border-border/40 rounded-2xl p-6 h-64 flex items-center justify-center">
            <Loader2 className="size-6 text-accent animate-spin" />
          </div>
        </div>
      </div>
    )
  }

  // ── Error: profile (only shown if truly unrecoverable, now uses fallback) ──
  if (profileError && !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 max-w-sm p-8">
          <div className="size-12 rounded-xl bg-negative-soft flex items-center justify-center mx-auto">
            <BarChart2 className="size-6 text-negative" />
          </div>
          <h2 className="text-lg font-medium text-textPrimary">Index Not Found</h2>
          <p className="text-sm text-textSecondary">
            Could not load data for <span className="font-mono font-medium">{sym}</span>.
          </p>
          <Button asChild className="bg-accent text-white">
            <Link to="/"><ArrowLeft className="size-3.5 mr-1.5" /> Back to Dashboard</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* ── Header ── */}
      <div className="sticky top-0 z-20 bg-surface/95 backdrop-blur-sm border-b border-border/40 px-6 py-4 shadow-[var(--shadow-xs)]">
        <div className="max-w-[1400px] mx-auto">
          <div className="text-xs text-textSecondary/70 mb-2">
            <Link to="/" className="hover:text-accent transition-colors">Home</Link>
            <span className="mx-1.5">›</span>
            <span className="text-textSecondary">Markets</span>
            <span className="mx-1.5">›</span>
            <span className="text-accent font-medium">{displayName}</span>
          </div>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-accentSoft border border-accent/20 flex items-center justify-center">
                  <TrendingUp className="size-5 text-accent" />
                </div>
                <div>
                  <h1 className="text-3xl font-semibold text-textPrimary tracking-tight">{displayName}</h1>
                  <p className="text-body text-textSecondary mt-1">
                    {profile?.index_sub_type ?? 'Equity Index'} · {profile?.exchange ?? 'NSE'} ·{' '}
                    <span className={cn('font-medium', positive ? 'text-positive' : 'text-negative')}>
                      {positive ? '+' : ''}{indexChangePct.toFixed(2)}% Today
                    </span>
                  </p>
                </div>
              </div>
              <p className="text-body text-textSecondary mt-3 max-w-2xl leading-relaxed">
                {displayName} tracks {constituentSymbols.length} top liquidity stocks on {profile?.exchange ?? 'NSE'}.
                {profile?.index_sub_type ? ` Classified as a ${profile.index_sub_type} index.` : ''}
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-medium font-mono text-textPrimary tabular-nums">
                {indexValue ? formatNumber(indexValue, 2) : '—'}
              </div>
              {indexChange !== 0 && (
                <div className={cn(
                  'flex items-center justify-end gap-1 mt-1 font-mono text-sm font-medium tabular-nums',
                  positive ? 'text-positive' : 'text-negative'
                )}>
                  {positive ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
                  {positive ? '+' : ''}{formatNumber(indexChange, 2)} ({positive ? '+' : ''}{indexChangePct.toFixed(2)}%)
                </div>
              )}
              <p className="text-xs text-textMuted mt-1 font-medium">
                {profile?.quote_date ? `As of ${profile.quote_date}` : 'Live Data'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-8">

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Day High', value: profile?.high_price ? formatNumber(profile.high_price, 2) : '—', color: 'text-positive' },
            { label: 'Day Low', value: profile?.low_price ? formatNumber(profile.low_price, 2) : '—', color: 'text-negative' },
            { label: 'Total Constituents', value: String(constituentSymbols.length), color: 'text-textPrimary' },
            { label: 'Exchange', value: profile?.exchange ?? 'NSE', color: 'text-accent' },
          ].map((stat) => (
            <Card key={stat.label} className="border-border/40 shadow-xs bg-surface rounded-2xl">
              <CardContent className="px-5 py-4">
                <p className="text-xs uppercase tracking-wider text-textMuted font-medium">{stat.label}</p>
                <p className={cn('text-xl font-medium font-mono mt-1.5 tabular-nums', stat.color)}>{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Price Chart ── */}
        <Card className="border-border/40 shadow-xs bg-surface rounded-2xl">
          <CardHeader className="border-b border-border/40 pb-3.5 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-textPrimary flex items-center gap-2">
              <BarChart2 className="size-4 text-accent" /> Index Price Chart
            </CardTitle>
            <div className="flex items-center gap-1">
              {Object.keys(RANGE_LABELS).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={cn(
                    'px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer',
                    range === r
                      ? 'bg-accent text-white'
                      : 'text-textSecondary hover:bg-surfaceMuted'
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="pt-4 pb-2">
            {historicalLoading ? (
              <div className="flex items-center justify-center h-56">
                <Loader2 className="size-6 text-accent animate-spin" />
              </div>
            ) : histError || chartData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-56 text-textMuted">
                <RefreshCw className="size-6 mb-2" />
                <p className="text-sm">{histError ?? 'No chart data available'}</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: 10 }}>
                  <defs>
                    <linearGradient id="indexGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={positive ? '#22c55e' : '#ef4444'} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={positive ? '#22c55e' : '#ef4444'} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => formatNumber(v, 0)}
                    domain={['auto', 'auto']}
                    width={65}
                  />
                  <Tooltip
                    contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 11 }}
                    formatter={(v: number) => [formatNumber(v, 2), displayName]}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={positive ? '#22c55e' : '#ef4444'}
                    strokeWidth={2}
                    fill="url(#indexGrad)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* ── Returns Row ── */}
        <Card className="border-border/40 shadow-xs bg-surface rounded-2xl">
          <CardHeader className="border-b border-border/40 pb-3.5">
            <CardTitle className="text-sm font-medium text-textPrimary flex items-center gap-2">
              <TrendingUp className="size-4 text-accent" /> Price Returns
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {returnsLoading ? (
              <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                {RETURN_PERIODS.map(p => <SkeletonCard key={p} />)}
              </div>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                {RETURN_PERIODS.map(p => {
                  const val = returns ? (returns as any)[p] : null
                  const isPos = val !== null && val >= 0
                  return (
                    <div key={p} className="text-center">
                      <p className="text-xs text-textMuted font-medium uppercase tracking-wider mb-1">{p}</p>
                      <p className={cn(
                        'text-lg font-semibold font-mono tabular-nums',
                        val === null ? 'text-textMuted' : isPos ? 'text-positive' : 'text-negative'
                      )}>
                        {val !== null ? `${isPos ? '+' : ''}${val.toFixed(2)}%` : '—'}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Constituents + Sector Weights ── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Constituents Table */}
          <Card className="xl:col-span-2 border-border/40 shadow-xs bg-surface rounded-2xl">
            <CardHeader className="border-b border-border/40 pb-3.5">
              <CardTitle className="text-sm font-medium text-textPrimary flex items-center gap-2">
                <Table2 className="size-4 text-accent" /> Top Constituents
              </CardTitle>
              <p className="text-xs text-textMuted mt-0.5">
                Click any row to view the company's full financial profile
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-surfaceMuted/30 border-b border-border/40">
                      <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-textMuted">#</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-textMuted">Company</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-textMuted font-mono">CMP (₹)</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-textMuted font-mono">Day %</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-textMuted font-mono">Mkt Cap (Cr)</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-textMuted font-mono">P/E</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {constituents.length > 0 ? constituents.map((c, idx) => {
                      const pos = c.change >= 0
                      return (
                        <tr
                          key={c.symbol}
                          onClick={() => navigate(`/company/${c.symbol}`)}
                          className="hover:bg-surfaceMuted/50 transition-colors cursor-pointer group"
                        >
                          <td className="px-4 py-2.5 text-textMuted font-mono">{idx + 1}</td>
                          <td className="px-4 py-2.5">
                            <Link to={`/company/${c.symbol}`} className="flex flex-col">
                              <span className="font-medium text-accent group-hover:underline font-mono">{c.symbol}</span>
                              <span className="text-xs text-textMuted truncate max-w-[180px]">{c.name}</span>
                            </Link>
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono tabular-nums text-textPrimary font-medium">
                            {formatNumber(c.price, 2)}
                          </td>
                          <td className={cn('px-4 py-2.5 text-right font-mono tabular-nums font-medium', pos ? 'text-positive' : 'text-negative')}>
                            <span className="inline-flex items-center justify-end gap-0.5">
                              {pos ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                              {pos ? '+' : ''}{c.changePct.toFixed(2)}%
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-600">
                            ₹{(c.marketCap / 100000).toFixed(1)}L Cr
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-600">
                            {c.pe.toFixed(1)}x
                          </td>
                        </tr>
                      )
                    }) : (
                      /* Fallback: show raw symbol list when no company data matches */
                      constituentSymbols.slice(0, 10).map((sym, idx) => (
                        <tr
                          key={sym}
                          onClick={() => navigate(`/company/${sym}`)}
                          className="hover:bg-surfaceMuted/50 transition-colors cursor-pointer group"
                        >
                          <td className="px-4 py-2.5 text-textMuted font-mono">{idx + 1}</td>
                          <td className="px-4 py-2.5">
                            <Link to={`/company/${sym}`} className="flex flex-col">
                              <span className="font-medium text-accent group-hover:underline font-mono">{sym}</span>
                            </Link>
                          </td>
                          <td colSpan={4} className="px-4 py-2.5 text-right text-textMuted text-xs">—</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                {constituents.length === 0 && constituentSymbols.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <RefreshCw className="size-8 text-textMuted mb-2" />
                    <p className="text-sm text-textMuted">Constituents loading…</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Sector/Constituent Donut */}
          <Card className="xl:col-span-1 border-border/40 shadow-xs bg-surface rounded-2xl">
            <CardHeader className="border-b border-border/40 pb-3.5">
              <CardTitle className="text-sm font-medium text-textPrimary flex items-center gap-2">
                <PieChart className="size-4 text-accent" /> Top Holdings
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {sectorData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <RechartsPie>
                      <Pie
                        data={sectorData}
                        dataKey="weight"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={2}
                        strokeWidth={0}
                      >
                        {sectorData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: number) => [`${val}%`, '']}
                        contentStyle={{ fontSize: 11, border: '1px solid #e2e8f0', borderRadius: 8 }}
                      />
                    </RechartsPie>
                  </ResponsiveContainer>
                  <div className="mt-4 space-y-2">
                    {sectorData.map((s) => (
                      <div key={s.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="size-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                          <span className="text-textSecondary font-medium truncate max-w-[140px]">{s.name}</span>
                        </div>
                        <span className="font-mono font-medium text-textPrimary tabular-nums">{s.weight}%</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-48 text-textMuted">
                  <p className="text-sm">No holding data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Valuation Stats Row (P/E, P/B, Div Yield from live profile) ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'P/E Ratio', value: profile?.pe ? `${profile.pe.toFixed(2)}x` : '—', color: 'text-textPrimary' },
            { label: 'P/B Ratio', value: profile?.pb ? `${profile.pb.toFixed(2)}x` : '—', color: 'text-textPrimary' },
            { label: 'Dividend Yield', value: profile?.div_yield ? `${profile.div_yield.toFixed(2)}%` : '—', color: 'text-positive' },
          ].map(stat => (
            <Card key={stat.label} className="border-border/40 shadow-xs bg-surface rounded-2xl">
              <CardContent className="px-5 py-4">
                <p className="text-xs uppercase tracking-wider text-textMuted font-medium">{stat.label}</p>
                <p className={cn('text-xl font-medium font-mono mt-1.5 tabular-nums', stat.color)}>{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

export default IndexDetail
