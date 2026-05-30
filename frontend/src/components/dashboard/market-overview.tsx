'use client'

import { useState, useEffect } from "react"
import { marketIndices, marketBreadth } from "@/lib/data/market"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatNumber, formatPct, changeClass } from "@/lib/formatters"
import { MetricCard } from "@/components/shared/metric-card"
import { Link } from "react-router-dom"

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

export function MarketOverview() {
  const [loading, setLoading] = useState(true)
  const featured = marketIndices.slice(0, 4)

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 600)
    return () => clearTimeout(timer)
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-border shadow-none bg-surface">
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

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 animate-count-up">
      {featured.map((idx) => {
        const positive = idx.change >= 0
        const slug = INDEX_SLUG[idx.name] ?? 'NIFTY50'
        return (
          <Link key={idx.name} to={`/index/${slug}`} className="block">
            <Card className="hover:border-accent/40 hover:shadow-md transition-all duration-200 cursor-pointer bg-surface">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-1">
                <div>
                  <CardTitle className="text-sm font-semibold tracking-tight">
                    {idx.name}
                  </CardTitle>
                  <p className="text-[11px] text-muted-foreground">NSE Index</p>
                </div>
                <span
                  className={`rounded-md px-2 py-0.5 text-[11px] font-mono tabular ${
                    positive
                      ? "bg-positive-soft text-positive"
                      : "bg-negative-soft text-negative"
                  }`}
                >
                  {formatPct(idx.changePct)}
                </span>
              </CardHeader>
              <CardContent>
                <div className="font-mono tabular text-2xl font-semibold tracking-tight text-textPrimary">
                  {formatNumber(idx.value, 2)}
                </div>
                <div className={`mt-1 font-mono tabular text-xs ${changeClass(idx.change)}`}>
                  {idx.change >= 0 ? "+" : ""}
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

export function BreadthCards() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 600)
    return () => clearTimeout(timer)
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-border shadow-none bg-surface">
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

  const total = marketBreadth.advances + marketBreadth.declines + marketBreadth.unchanged
  const advPct = (marketBreadth.advances / total) * 100
  const decPct = (marketBreadth.declines / total) * 100

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4 animate-count-up">
      <Card className="bg-surface">
        <CardContent className="px-4 py-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Advance / Decline
          </div>
          <div className="mt-1 flex items-baseline gap-2 font-mono tabular">
            <span className="text-positive text-xl font-semibold">
              {marketBreadth.advances}
            </span>
            <span className="text-muted-foreground">/</span>
            <span className="text-negative text-xl font-semibold">
              {marketBreadth.declines}
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
        value={formatNumber(marketBreadth.vix, 2)}
        changePct={marketBreadth.vixChangePct}
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
