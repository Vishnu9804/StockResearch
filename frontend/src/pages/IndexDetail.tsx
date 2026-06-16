import React, { useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ArrowUpRight, ArrowDownRight, TrendingUp,
  BarChart2, PieChart, Table2, RefreshCw
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart as RechartsPie, Pie, Cell, Legend
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { companies } from '@/lib/data/companies'
import { marketIndices } from '@/lib/data/market'
import { formatNumber } from '@/lib/formatters'

// ─── Index metadata ───────────────────────────────────────────────────────────

const INDEX_META: Record<string, {
  slug: string
  displayName: string
  fullName: string
  description: string
  exchange: string
  constituentsCount: number
  launch: string
  sectors: { name: string; weight: number; color: string }[]
  symbols: string[]
}> = {
  'NIFTY50': {
    slug: 'NIFTY50',
    displayName: 'NIFTY 50',
    fullName: 'Nifty 50 Index',
    description: 'The Nifty 50 is the flagship index of the National Stock Exchange of India. It tracks the 50 largest and most liquid Indian equity companies across 13 sectors.',
    exchange: 'NSE',
    constituentsCount: 50,
    launch: 'November 1995',
    sectors: [
      { name: 'Financial Services', weight: 33.2, color: '#3b82f6' },
      { name: 'Information Tech', weight: 13.8, color: '#6366f1' },
      { name: 'Energy', weight: 12.4, color: '#f59e0b' },
      { name: 'Consumer Disc.', weight: 9.6, color: '#10b981' },
      { name: 'Fast-Moving CG', weight: 7.2, color: '#ec4899' },
      { name: 'Healthcare', weight: 5.8, color: '#14b8a6' },
      { name: 'Others', weight: 18.0, color: '#94a3b8' },
    ],
    symbols: ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'HINDUNILVR', 'BAJFINANCE', 'SBIN', 'BHARTIARTL', 'KOTAKBANK'],
  },
  'SENSEX': {
    slug: 'SENSEX',
    displayName: 'SENSEX',
    fullName: 'S&P BSE Sensex',
    description: 'The S&P BSE Sensex is India\'s oldest and most widely tracked equity benchmark, comprising 30 financially sound and well-established companies listed on the Bombay Stock Exchange.',
    exchange: 'BSE',
    constituentsCount: 30,
    launch: 'January 1986',
    sectors: [
      { name: 'Financial Services', weight: 36.1, color: '#3b82f6' },
      { name: 'Information Tech', weight: 15.2, color: '#6366f1' },
      { name: 'Energy', weight: 11.8, color: '#f59e0b' },
      { name: 'Consumer Disc.', weight: 10.4, color: '#10b981' },
      { name: 'Fast-Moving CG', weight: 8.9, color: '#ec4899' },
      { name: 'Others', weight: 17.6, color: '#94a3b8' },
    ],
    symbols: ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'HINDUNILVR', 'BAJFINANCE', 'SBIN', 'BHARTIARTL', 'KOTAKBANK'],
  },
  'BANKNIFTY': {
    slug: 'BANKNIFTY',
    displayName: 'BANK NIFTY',
    fullName: 'Nifty Bank Index',
    description: 'The Nifty Bank Index tracks the most liquid and large capitalised Indian banking stocks that are listed on the National Stock Exchange.',
    exchange: 'NSE',
    constituentsCount: 12,
    launch: 'September 2003',
    sectors: [
      { name: 'Private Banks', weight: 68.4, color: '#3b82f6' },
      { name: 'Public Banks', weight: 24.2, color: '#6366f1' },
      { name: 'Small Finance', weight: 7.4, color: '#10b981' },
    ],
    symbols: ['HDFCBANK', 'ICICIBANK', 'KOTAKBANK', 'SBIN', 'AXISBANK', 'BAJFINANCE'],
  },
  'NIFTYIT': {
    slug: 'NIFTYIT',
    displayName: 'NIFTY IT',
    fullName: 'Nifty IT Index',
    description: 'The Nifty IT Index is designed to reflect the behaviour and performance of the Information Technology sector including IT services companies listed on the NSE.',
    exchange: 'NSE',
    constituentsCount: 10,
    launch: 'May 2004',
    sectors: [
      { name: 'Large Cap IT', weight: 72.1, color: '#6366f1' },
      { name: 'Mid Cap IT', weight: 19.4, color: '#3b82f6' },
      { name: 'Other Tech', weight: 8.5, color: '#94a3b8' },
    ],
    symbols: ['TCS', 'INFY', 'WIPRO'],
  },
  'NIFTYMIDCAP': {
    slug: 'NIFTYMIDCAP',
    displayName: 'NIFTY MIDCAP 100',
    fullName: 'Nifty Midcap 100 Index',
    description: 'The Nifty Midcap 100 Index captures the movement and performance of the 100 midcap stocks listed on NSE, positioned between Nifty 50 and Nifty Smallcap 100.',
    exchange: 'NSE',
    constituentsCount: 100,
    launch: 'August 2005',
    sectors: [
      { name: 'Financial Services', weight: 21.3, color: '#3b82f6' },
      { name: 'Industrials', weight: 17.8, color: '#f59e0b' },
      { name: 'Healthcare', weight: 12.4, color: '#14b8a6' },
      { name: 'Consumer Disc.', weight: 11.6, color: '#10b981' },
      { name: 'IT Services', weight: 9.2, color: '#6366f1' },
      { name: 'Others', weight: 27.7, color: '#94a3b8' },
    ],
    symbols: ['LT', 'BAJFINANCE', 'MARUTI', 'SUNPHARMA', 'TITAN'],
  },
}

// ─── Generate deterministic price chart data ──────────────────────────────────

function generateChartData(baseValue: number, points: number, seed: number) {
  const data = []
  let value = baseValue
  for (let i = 0; i < points; i++) {
    const noise = (Math.sin(i * seed * 0.3) * 0.8 + Math.cos(i * 0.7) * 0.5) * baseValue * 0.008
    value = Math.max(value * 0.92, value + noise)
    const date = new Date()
    date.setDate(date.getDate() - (points - i))
    data.push({
      date: date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      value: Math.round(value * 100) / 100,
    })
  }
  return data
}

const RANGE_CONFIG: Record<string, { points: number; label: string }> = {
  '1D': { points: 30, label: '1 Day' },
  '1W': { points: 7, label: '1 Week' },
  '1M': { points: 30, label: '1 Month' },
  '1Y': { points: 52, label: '1 Year' },
  '5Y': { points: 60, label: '5 Years' },
}

export function IndexDetail() {
  const navigate = useNavigate()
  const { symbol = 'NIFTY50' } = useParams<{ symbol: string }>()
  const [range, setRange] = React.useState<string>('1M')

  const indexKey = symbol.toUpperCase().replace('-', '')
  const meta = INDEX_META[indexKey]

  // Find matching market index data
  const marketIndex = marketIndices.find((idx) =>
    idx.name.replace(/\s/g, '').toLowerCase().includes(symbol.toLowerCase().replace('-', ''))
  )

  const indexValue = marketIndex?.value ?? 22845.75
  const indexChange = marketIndex?.change ?? 127.45
  const indexChangePct = marketIndex?.changePct ?? 0.56
  const positive = indexChange >= 0

  // Get constituents from company data
  const constituentSymbols = meta?.symbols ?? ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK']
  const constituents = companies.filter((c) => constituentSymbols.includes(c.symbol))

  // Price chart
  const chartData = useMemo(() => {
    const cfg = RANGE_CONFIG[range]
    return generateChartData(indexValue, cfg.points, indexValue % 10)
  }, [range, indexValue])

  if (!meta) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 max-w-sm p-8">
          <div className="size-12 rounded-xl bg-negative-soft flex items-center justify-center mx-auto">
            <BarChart2 className="size-6 text-negative" />
          </div>
          <h2 className="text-lg font-medium text-textPrimary">Index Not Found</h2>
          <p className="text-sm text-textSecondary">
            We couldn't find an index mapped to <span className="font-mono font-medium">{symbol}</span>.
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
            <span className="text-accent font-medium">{meta.displayName}</span>
          </div>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-accentSoft border border-accent/20 flex items-center justify-center">
                  <TrendingUp className="size-5 text-accent" />
                </div>
                <div>
                  <h1 className="text-3xl font-semibold text-textPrimary tracking-tight">{meta.displayName}</h1>
                  <p className="text-body text-textSecondary mt-1">
                    Index tracking {meta.constituentsCount} top liquidity stocks on {meta.exchange} ·{' '}
                    <span className="font-medium text-accent">
                      {positive ? '+' : ''}{indexChangePct.toFixed(2)}% Today
                    </span>
                  </p>
                </div>
              </div>
              <p className="text-body text-textSecondary mt-3 max-w-2xl leading-relaxed">{meta.description}</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-medium font-mono text-textPrimary tabular-nums">
                {formatNumber(indexValue, 2)}
              </div>
              <div className={cn(
                'flex items-center justify-end gap-1 mt-1 font-mono text-sm font-medium tabular-nums',
                positive ? 'text-positive' : 'text-negative'
              )}>
                {positive ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
                {positive ? '+' : ''}{formatNumber(indexChange, 2)} ({positive ? '+' : ''}{indexChangePct.toFixed(2)}%)
              </div>
              <p className="text-xs text-textMuted mt-1 font-medium">
                Launched: {meta.launch}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-8">

        {/* ── Price Chart ── */}
        <Card className="border-border/40 shadow-xs bg-surface rounded-2xl">
          <CardHeader className="border-b border-border/40 pb-3.5 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-textPrimary flex items-center gap-2">
              <BarChart2 className="size-4 text-accent" /> Index Price Chart
            </CardTitle>
            <div className="flex items-center gap-1">
              {Object.keys(RANGE_CONFIG).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={cn(
                    'px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
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
                  formatter={(v: number) => [formatNumber(v, 2), meta.displayName]}
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
                    {constituents.map((c, idx) => {
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
                    })}
                  </tbody>
                </table>
                {constituents.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                     <RefreshCw className="size-8 text-textMuted mb-2" />
                     <p className="text-sm text-textMuted">Constituents loading…</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Sector Weight Donut */}
          <Card className="xl:col-span-1 border-border/40 shadow-xs bg-surface rounded-2xl">
            <CardHeader className="border-b border-border/40 pb-3.5">
              <CardTitle className="text-sm font-medium text-textPrimary flex items-center gap-2">
                <PieChart className="size-4 text-accent" /> Sector Weights
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <ResponsiveContainer width="100%" height={200}>
                <RechartsPie>
                  <Pie
                    data={meta.sectors}
                    dataKey="weight"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {meta.sectors.map((entry, index) => (
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
                {meta.sectors.map((s) => (
                  <div key={s.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="size-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                      <span className="text-textSecondary font-medium truncate max-w-[140px]">{s.name}</span>
                    </div>
                    <span className="font-mono font-medium text-textPrimary tabular-nums">{s.weight}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Index Stats Row ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Day High', value: formatNumber(marketIndex?.high ?? indexValue * 1.003, 2), color: 'text-positive' },
            { label: 'Day Low', value: formatNumber(marketIndex?.low ?? indexValue * 0.997, 2), color: 'text-negative' },
            { label: 'Total Constituents', value: String(meta.constituentsCount), color: 'text-textPrimary' },
            { label: 'Exchange', value: meta.exchange, color: 'text-accent' },
          ].map((stat) => (
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
