/**
 * components/dashboard/gainers-losers.tsx
 * Live Top Movers component — pulls real-time EOD quote data from the backend.
 * Premium FinEdge account returns all 5000+ NSE/BSE stocks in a single call.
 */

import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatNumber, formatVolume } from "@/lib/formatters"
import { ArrowRight, ArrowUpRight, ArrowDownRight, RefreshCw, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import finscreenApi from "@/services/finscreenApi"

export interface MarketMover {
  symbol: string
  name?: string
  price: number
  change: number
  changePct: number
  volume: number
}

function MoverList({ data, loading }: { data: MarketMover[]; loading: boolean }) {
  if (loading) {
    return (
      <ul className="divide-y divide-border/50 max-h-[360px] overflow-y-auto">
        {Array.from({ length: 7 }).map((_, i) => (
          <li key={i} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="h-3 w-20 rounded bg-surfaceMuted animate-pulse" />
              <div className="h-2.5 w-28 rounded bg-surfaceMuted animate-pulse" />
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <div className="h-3 w-16 rounded bg-surfaceMuted animate-pulse" />
              <div className="h-2.5 w-12 rounded bg-surfaceMuted animate-pulse" />
            </div>
          </li>
        ))}
      </ul>
    )
  }

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-24 text-xs text-textMuted">
        No data available
      </div>
    )
  }

  return (
    <ul className="divide-y divide-border/50 max-h-[360px] overflow-y-auto">
      {data.map((s) => {
        const positive = s.changePct >= 0
        return (
          <li key={s.symbol}>
            <Link
              to={`/company/${s.symbol}`}
              className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-surfaceMuted transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-medium text-accent">{s.symbol}</span>
                  {s.name && (
                    <span className="truncate text-xs font-medium text-slate-700 dark:text-slate-400">
                      {s.name}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-xs text-textMuted font-mono font-medium">
                  Vol {formatVolume(s.volume)}
                </div>
              </div>
              <div className="flex flex-col items-end shrink-0">
                <span className="font-mono tabular text-xs font-medium text-textPrimary">
                  ₹{formatNumber(s.price, 2)}
                </span>
                <span
                  className={cn(
                    "text-xs font-mono font-medium flex items-center gap-0.5 mt-0.5",
                    positive ? "text-positive" : "text-negative"
                  )}
                >
                  {positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                  {positive ? '+' : ''}{s.changePct.toFixed(2)}%
                </span>
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

export function GainersLosers() {
  const [gainers, setGainers] = useState<MarketMover[]>([])
  const [losers, setLosers] = useState<MarketMover[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  async function loadMovers() {
    try {
      setLoading(true)
      const data = await finscreenApi.fetchMarketMovers()

      if (!data || typeof data !== 'object') return

      const list: MarketMover[] = Object.entries(data).map(([symbol, q]: [string, any]) => {
        // FinEdge returns change as a string like "2.34%" or "-1.23%"
        const changeStr = q.change ? String(q.change).replace('%', '') : '0'
        const changePct = parseFloat(changeStr) || 0
        return {
          symbol,
          name: q.company_name || q.name || undefined,
          price: q.current_price || q.close_price || 0,
          change: changePct,
          changePct,
          volume: q.volume || 0,
        }
      }).filter(s => s.price > 0)

      const sorted = [...list].sort((a, b) => b.changePct - a.changePct)
      setGainers(sorted.filter(s => s.changePct > 0).slice(0, 10))
      setLosers([...sorted].reverse().filter(s => s.changePct < 0).slice(0, 10))
      setLastUpdated(new Date())
    } catch (err) {
      console.error('[GainersLosers] Failed to load market movers:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMovers()
    // Refresh every 5 minutes during market hours
    const interval = setInterval(loadMovers, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <Card className="border-border shadow-none overflow-hidden select-none">
      <CardHeader className="flex flex-row items-center justify-between gap-2 border-b border-border/50 bg-surfaceMuted/50 px-4 py-3 shrink-0">
        <CardTitle className="text-xs font-medium text-textPrimary uppercase tracking-wide">
          Top Movers
        </CardTitle>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <button
              onClick={loadMovers}
              disabled={loading}
              className="inline-flex items-center gap-1 text-xs text-textMuted hover:text-accent transition-colors"
              title={`Last updated: ${lastUpdated.toLocaleTimeString('en-IN')}`}
            >
              <RefreshCw className={cn("size-3", loading && "animate-spin")} />
            </button>
          )}
          <Link
            to="/screener/results"
            className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline uppercase tracking-wide"
          >
            All movers <ArrowRight className="size-3" />
          </Link>
          <Link
            to="/screener"
            className="inline-flex items-center gap-1 text-xs font-medium text-textSecondary hover:text-accent transition-colors uppercase tracking-wide"
          >
            Screener <ArrowRight className="size-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs defaultValue="gainers">
          <div className="border-b border-border/50 px-4 bg-surfaceMuted/20">
            <TabsList className="h-9 bg-transparent p-0 gap-4">
              <TabsTrigger
                value="gainers"
                className="text-xs font-medium uppercase tracking-wider h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-700 data-[state=active]:text-accent bg-transparent p-0 shadow-none"
              >
                Gainers {!loading && gainers.length > 0 && (
                  <span className="ml-1 text-[10px] text-positive font-mono">({gainers.length})</span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="losers"
                className="text-xs font-medium uppercase tracking-wider h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-700 data-[state=active]:text-accent bg-transparent p-0 shadow-none"
              >
                Losers {!loading && losers.length > 0 && (
                  <span className="ml-1 text-[10px] text-negative font-mono">({losers.length})</span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="gainers" className="m-0">
            <MoverList data={gainers} loading={loading} />
          </TabsContent>
          <TabsContent value="losers" className="m-0">
            <MoverList data={losers} loading={loading} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
export default GainersLosers
