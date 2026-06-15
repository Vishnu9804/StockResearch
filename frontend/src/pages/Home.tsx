import { useState, useEffect } from "react"
import { MarketOverview, BreadthCards } from "@/components/dashboard/market-overview"
import { useMarketStatus } from "@/hooks/useMarketStatus"
import { cn } from "@/lib/utils"
import { Link } from "react-router-dom"
import { useAppSelector } from "@/store/hooks"
import finscreenApi from "@/services/finscreenApi"
import {
  BarChart2, Bell, Bookmark, Calendar, ChevronRight, ExternalLink,
  FileText, Plus, RefreshCw, Star, TrendingUp, TrendingDown,
  TriangleAlert, Zap, Activity, Clock, Newspaper, Search
} from "lucide-react"

const FINANCIAL_NEWS = [
  {
    id: 1,
    category: "ECONOMY",
    categoryColor: "text-accent",
    headline: "RBI maintains status quo on repo rates for the 6th consecutive session.",
    summary: "The Monetary Policy Committee voted 5:1 to keep rates at 6.5%…",
    time: "14 MINS AGO",
    source: "REUTERS",
  },
  {
    id: 2,
    category: "STOCKS",
    categoryColor: "text-positive",
    headline: "Tata Motors reports 15% YoY jump in global sales for February.",
    summary: "JLR volumes continue to support margin expansion across premium segments…",
    time: "42 MINS AGO",
    source: "BLOOMBERG",
  },
  {
    id: 3,
    category: "COMMODITIES",
    categoryColor: "text-warning",
    headline: "Gold touches all-time high as USD index weakens on inflation data.",
    summary: "",
    time: "1 HOUR AGO",
    source: "CNBC",
  },
  {
    id: 4,
    category: "TECH",
    categoryColor: "text-purple-500",
    headline: "Zomato gets GST demand notice of ₹401 Crore; stock remains stable.",
    summary: "",
    time: "2 HOURS AGO",
    source: "ET",
  },
]

const CUSTOM_SCANS = [
  { label: "RSI Oversold (D)", count: 12, tickers: ["ADANI ENT", "UPL", "ZEEL"], color: "bg-negative-soft text-negative border-negative/20" },
  { label: "MACD Bullish Cross", count: 42, tickers: ["RELIANCE", "BHARTIARTL"], color: "bg-positive-soft text-positive border-positive/20" },
  { label: "Golden Crossover (50/200)", count: 3, tickers: ["HAL", "BHEL"], color: "bg-accent/10 text-accent border-accent/20" },
  { label: "52-Week High Breakout", count: 8, tickers: ["TATASTEEL", "ZOMATO"], color: "bg-positive-soft text-positive border-positive/20" },
]

const FEED_ITEMS = [
  {
    id: 1, symbol: "TCS", name: "TCS", type: "document", icon: "file", time: "2h ago",
    headline: "Annual Report Released: Detailed FY24 performance and strategic outlook.",
    actions: [{ label: "View Report", icon: "external", href: "#" }, { label: "Save for later", icon: "bookmark", href: "#" }],
  },
  {
    id: 2, symbol: "HDFCBANK", name: "HDFC Bank", type: "alert", icon: "trending-up", time: "5h ago",
    headline: "Instrument hit a new 52-week high of ₹1,740.00 during the morning session.",
    actions: [{ label: "Analyze Chart", icon: "chart", href: "/company/HDFCBANK" }, { label: "Compare peers", icon: "zap", href: "#" }],
    highlight: "positive",
  },
  {
    id: 3, symbol: "INFY", name: "Infosys", type: "event", icon: "calendar", time: "Tomorrow",
    headline: "Upcoming Earnings Call: Q1 Financial Results & Management Commentary.",
    sub: "Scheduled: 4:00 PM IST",
    actions: [{ label: "Set Reminder", icon: "bell", href: "#" }],
  },
  {
    id: 4, symbol: "RELIANCE", name: "Reliance Industries", type: "price-alert", icon: "alert", time: "Yesterday",
    headline: "Price Alert: Stock dropped 2.1% below established support level (₹2,840).",
    actions: [{ label: "Review Position", icon: "chart", href: "/company/RELIANCE" }, { label: "Dismiss", icon: "x", href: "#" }],
    highlight: "negative",
  },
]

const UPCOMING_RESULTS = [
  { day: "MON", date: "Oct 14", items: [] },
  { day: "TUE", date: "Oct 15", items: [{ name: "ICICI Bank", symbol: "ICICIBANK" }, { name: "Axis Bank", symbol: "AXISBANK" }] },
  { day: "WED", date: "Oct 16", items: [{ name: "Wipro", symbol: "WIPRO" }] },
  { day: "THU", date: "Oct 17", items: [{ name: "SBI", symbol: "SBIN" }, { name: "Tata Motors", symbol: "TATAMOTORS" }] },
  { day: "FRI", date: "Oct 18", items: [{ name: "Adani Ent.", symbol: "ADANIENT" }] },
]

function FeedIcon({ type, icon }: { type: string; icon: string }) {
  const base = "size-9 rounded-xl flex items-center justify-center shrink-0"
  if (icon === "file" || type === "document")
    return <div className={cn(base, "bg-accentSoft border border-accent/20 text-accent")}><FileText className="size-4" /></div>
  if (icon === "trending-up" || type === "alert")
    return <div className={cn(base, "bg-positive-soft border border-positive/20 text-positive")}><TrendingUp className="size-4" /></div>
  if (icon === "calendar" || type === "event")
    return <div className={cn(base, "bg-purple-50 border border-purple-200 text-purple-600 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-400")}><Calendar className="size-4" /></div>
  return <div className={cn(base, "bg-warning-soft border border-warning/20 text-warning")}><TriangleAlert className="size-4" /></div>
}

export function Home() {
  const marketStatus = useMarketStatus()
  const { isAuthenticated } = useAppSelector((state) => state.auth)
  const { watchlists } = useAppSelector((state) => state.watchlist)
  const [feedFilter, setFeedFilter] = useState<"all" | "alerts">("all")

  // Live API States
  const [loading, setLoading] = useState(true)
  const [indices, setIndices] = useState<any[]>([])
  const [quotes, setQuotes] = useState<Record<string, any>>({})
  const [refreshedStocks, setRefreshedStocks] = useState<string[]>([])

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setLoading(true)
        // 1. Fetch indices
        const indicesData = await finscreenApi.fetchMarketIndices()
        setIndices(indicesData)

        // 2. Fetch batch quotes for 19 benchmark symbols
        const benchmarkSymbols = [
          'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK',
          'HINDUNILVR', 'BAJFINANCE', 'SBIN', 'BHARTIARTL', 'KOTAKBANK',
          'LT', 'WIPRO', 'ASIANPAINT', 'AXISBANK', 'MARUTI',
          'SUNPHARMA', 'TITAN', 'ULTRACEMCO', 'NESTLEIND'
        ]
        const quotesData = await finscreenApi.fetchMultipleQuotes(benchmarkSymbols)
        setQuotes(quotesData)

        // 3. Fetch refreshed stocks (safely handles 401 fallback)
        const refreshedData = await finscreenApi.fetchRefreshedStocks()
        if (refreshedData && refreshedData.fallback && Array.isArray(refreshedData.data)) {
          setRefreshedStocks(refreshedData.data)
        } else if (refreshedData && Array.isArray(refreshedData.data)) {
          setRefreshedStocks(refreshedData.data)
        } else if (refreshedData && Array.isArray(refreshedData)) {
          setRefreshedStocks(refreshedData)
        } else {
          setRefreshedStocks(['RELIANCE', 'TCS', 'HDFCBANK'])
        }
      } catch (err) {
        console.error('Error loading dashboard data:', err)
      } finally {
        setLoading(false)
      }
    }
    loadDashboardData()
  }, [])

  // Dynamically compute watchlists
  const renderedWatchlists = (watchlists && watchlists.length > 0)
    ? watchlists
    : [
        {
          name: "My Watchlist",
          items: [
            { symbol: "RELIANCE" },
            { symbol: "TCS" },
            { symbol: "HDFCBANK" },
          ],
        },
      ]

  const mappedWatchlists = renderedWatchlists.map((wl) => {
    let totalChange = 0
    let count = 0
    wl.items.forEach((item) => {
      const q = quotes[item.symbol]
      if (q && q.change) {
        const changeVal = parseFloat(q.change.replace("%", ""))
        totalChange += changeVal
        count++
      }
    })
    const avgChange = count > 0 ? totalChange / count : 0
    const changeLabel = avgChange >= 0 ? `+${avgChange.toFixed(2)}%` : `${avgChange.toFixed(2)}%`
    const positive = avgChange >= 0
    return {
      name: wl.name,
      count: wl.items.length,
      change: changeLabel,
      positive,
    }
  })

  // Compute live Top Gainers & Losers from batch quotes
  const quoteList = Object.entries(quotes).map(([symbol, q]: [string, any]) => {
    const changePctStr = q.change ? q.change.replace("%", "") : "0"
    const changePct = parseFloat(changePctStr)
    return {
      symbol,
      price: q.current_price || q.close_price || 0,
      changePct,
      volume: q.volume || 0,
    }
  })

  const liveTopGainers = [...quoteList]
    .filter((q) => q.changePct > 0)
    .sort((a, b) => b.changePct - a.changePct)
    .slice(0, 4)

  const liveTopLosers = [...quoteList]
    .filter((q) => q.changePct < 0)
    .sort((a, b) => a.changePct - b.changePct)
    .slice(0, 4)

  const fallbackGainers = [
    { symbol: "RELIANCE", price: 1296.4, changePct: 2.64 },
    { symbol: "BAJFINANCE", price: 920.0, changePct: 5.68 },
    { symbol: "LT", price: 4050.0, changePct: 4.87 },
    { symbol: "TITAN", price: 4179.0, changePct: 3.82 },
  ]

  const fallbackLosers = [
    { symbol: "NESTLEIND", price: 1376.5, changePct: -3.23 },
    { symbol: "WIPRO", price: 180.23, changePct: -1.61 },
    { symbol: "INFY", price: 1118.5, changePct: -0.35 },
    { symbol: "TCS", price: 2161.1, changePct: -0.21 },
  ]

  const displayGainers = liveTopGainers.length > 0 ? liveTopGainers : fallbackGainers
  const displayLosers = liveTopLosers.length > 0 ? liveTopLosers : fallbackLosers

  // Dynamically calculate advances and declines for sentiment bar
  let advances = 0
  let declines = 0
  Object.values(quotes).forEach((q: any) => {
    if (q && q.change) {
      const changeVal = parseFloat(q.change.replace("%", ""))
      if (changeVal > 0) advances++
      else if (changeVal < 0) declines++
    }
  })

  if (advances === 0 && declines === 0) {
    advances = 14
    declines = 5
  }

  const totalBreadth = advances + declines
  const bullishPct = totalBreadth > 0 ? Math.round((advances / totalBreadth) * 100) : 70
  const bearishPct = totalBreadth > 0 ? 100 - bullishPct : 30

  const filteredFeed = feedFilter === "alerts"
    ? FEED_ITEMS.filter(i => i.type === "price-alert" || i.type === "alert")
    : FEED_ITEMS

  return (
    <div className="min-h-screen bg-background">
      {/* ── Sticky Header ──────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-surface/95 backdrop-blur-sm border-b border-border px-6 py-3.5 shadow-[var(--shadow-xs)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-extrabold text-gradient leading-none">Markets Today</h1>
            <p className="text-[11px] text-textSecondary mt-0.5 font-medium">
              Institutional Terminal &nbsp;·&nbsp; Global Equities
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium",
              marketStatus.isOpen
                ? "border-positive/30 bg-positive-soft text-positive"
                : "border-border bg-surfaceMuted text-textSecondary"
            )}>
              <span className={cn("size-1.5 rounded-full", marketStatus.isOpen ? "bg-positive animate-pulse" : "bg-textMuted")} />
              {marketStatus.label}
            </span>
            <span className="font-mono text-[10px] text-textSecondary">NSE · 09:15 – 15:30 IST</span>
          </div>
        </div>
      </div>

      {/* ── Guest Banner ─────────────────────────────────────────────── */}
      {!isAuthenticated && (
        <div className="mx-6 mt-4 p-4 rounded-2xl bg-gradient-to-r from-accentSoft to-accentSoft/40 border border-accent/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-textSecondary select-none">
          <div className="flex items-center gap-2.5">
            <div className="size-7 rounded-full bg-accent/15 border border-accent/20 flex items-center justify-center shrink-0">
              <span className="size-2 rounded-full bg-accent animate-pulse" />
            </div>
            <span className="font-medium">Track your watchlist, build custom screeners, and get real-time price alerts.</span>
          </div>
          <Link to="/register" className="font-bold text-accent hover:text-accent/80 uppercase tracking-wider text-[11px] shrink-0 bg-white/50 dark:bg-surface/50 border border-accent/20 rounded-lg px-3 py-1.5 transition-colors hover:bg-accentSoft">
            Create Free Account
          </Link>
        </div>
      )}

      {/* ── Ticker strip — index cards ────────────────────────────────── */}
      <div className="px-4 pt-5 pb-0 lg:px-6">
        <MarketOverview loading={loading} indices={indices} />
      </div>

      {/* ── Breadth + Market Status Row ──────────────────────────────── */}
      <div className="px-4 pt-4 pb-0 lg:px-6">
        <BreadthCards loading={loading} indices={indices} quotes={quotes} />
      </div>

      {/* ── Main grid ────────────────────────────────────────────────── */}
      <div className="px-4 py-5 lg:px-6 lg:py-5">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[250px_1fr] xl:grid-cols-[250px_1fr_280px]">

          {/* ══ LEFT: Watchlists + Quick Stats + Refreshed Stocks ═══════ */}
          <div className="space-y-4">
            {/* My Watchlists */}
            <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-[var(--shadow-sm)]">
              <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between bg-surfaceMuted/40">
                <div className="flex items-center gap-1.5">
                  <Star className="size-3.5 text-accent" />
                  <span className="text-[11px] font-bold text-textPrimary uppercase tracking-wider">My Watchlists</span>
                </div>
                <button className="size-6 rounded-md bg-accentSoft border border-accent/20 flex items-center justify-center text-accent hover:bg-accent hover:text-white transition-colors">
                  <Plus className="size-3.5" />
                </button>
              </div>
              <div className="divide-y divide-border/50">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-3">
                      <div className="h-4 w-24 rounded shimmer-skeleton" />
                      <div className="h-4 w-12 rounded shimmer-skeleton" />
                    </div>
                  ))
                ) : (
                  mappedWatchlists.map((wl) => (
                    <Link key={wl.name} to="/watchlists" className="flex items-center justify-between px-4 py-3 hover:bg-surfaceMuted/60 transition-colors group">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="size-2 rounded-full bg-accent/40 group-hover:bg-accent transition-colors shrink-0" />
                        <span className="text-xs font-semibold text-textPrimary truncate">{wl.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={cn("text-[10px] font-mono font-bold tabular-nums", wl.positive ? "text-positive" : "text-negative")}>{wl.change}</span>
                        <span className="text-[10px] font-mono text-textMuted bg-surfaceMuted rounded-full px-1.5 py-0.5">{String(wl.count).padStart(2, "0")}</span>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-[var(--shadow-sm)]">
              <div className="px-4 py-3 border-b border-border/60 bg-surfaceMuted/40">
                <div className="flex items-center gap-1.5">
                  <Activity className="size-3.5 text-accent" />
                  <span className="text-[11px] font-bold text-textPrimary uppercase tracking-wider">Quick Stats</span>
                </div>
              </div>
              <div className="px-4 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-textSecondary font-medium">Total Value</span>
                  <span className="text-sm font-mono font-bold text-textPrimary tabular-nums">₹42,85,900</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-textSecondary font-medium">Daily Change</span>
                  <span className="text-sm font-mono font-bold text-positive tabular-nums">+1.24%</span>
                </div>
                <div className="w-full h-1.5 bg-surfaceMuted rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-gradient-to-r from-positive to-accent rounded-full" style={{ width: "62%" }} />
                </div>
              </div>
            </div>

            {/* Refreshed Stocks */}
            <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-[var(--shadow-sm)]">
              <div className="px-4 py-3 border-b border-border/60 bg-surfaceMuted/40 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Activity className="size-3.5 text-accent" />
                  <span className="text-[11px] font-bold text-textPrimary uppercase tracking-wider">Recently Refreshed</span>
                </div>
                <span className="text-[9px] font-bold bg-accentSoft text-accent border border-accent/20 px-1.5 py-0.5 rounded-full">LIVE</span>
              </div>
              <div className="p-3 space-y-2">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between p-2">
                      <div className="space-y-1">
                        <div className="h-3 w-16 rounded shimmer-skeleton" />
                        <div className="h-2.5 w-10 rounded shimmer-skeleton" />
                      </div>
                      <div className="space-y-1 text-right">
                        <div className="h-3 w-14 rounded shimmer-skeleton ml-auto" />
                        <div className="h-2.5 w-10 rounded shimmer-skeleton ml-auto" />
                      </div>
                    </div>
                  ))
                ) : (
                  refreshedStocks.map((symbol) => {
                    const q = quotes[symbol] || {}
                    const changeVal = q.change ? parseFloat(q.change.replace('%', '')) : 0
                    const price = q.current_price || 0
                    return (
                      <Link key={symbol} to={`/company/${symbol}`} className="flex items-center justify-between p-2 rounded-lg hover:bg-surfaceMuted/40 transition-colors border border-transparent hover:border-border">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-textPrimary">{symbol}</span>
                          <span className="text-[10px] text-textMuted font-mono">1d ago</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-mono font-bold block tabular-nums">
                            ₹{price ? price.toFixed(2) : '0.00'}
                          </span>
                          <span className={cn("text-[10px] font-mono font-bold tabular-nums block", changeVal >= 0 ? "text-positive" : "text-negative")}>
                            {changeVal >= 0 ? '+' : ''}{changeVal.toFixed(2)}%
                          </span>
                        </div>
                      </Link>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          {/* ══ CENTER: Main content area ══════════════════════════════ */}
          <div className="space-y-5">
            {/* Top Gainers & Losers Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Top Gainers */}
              <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-[var(--shadow-sm)]">
                <div className="px-4 py-3 border-b border-border/50 flex items-center gap-1.5 bg-positive-soft/20">
                  <TrendingUp className="size-3.5 text-positive" />
                  <span className="text-[11px] font-bold text-positive uppercase tracking-wider">Top Gainers</span>
                </div>
                <div className="divide-y divide-border/40">
                  <div className="grid grid-cols-[1.5fr_1.1fr_1.1fr] px-3 py-1.5 bg-surfaceMuted">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-textMuted">SYMBOL</span>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-textMuted text-right">LTP</span>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-textMuted text-right">CHG %</span>
                  </div>
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="grid grid-cols-[1.5fr_1.1fr_1.1fr] px-3 py-3 gap-2">
                        <div className="h-4 w-12 rounded shimmer-skeleton" />
                        <div className="h-4 w-16 rounded shimmer-skeleton ml-auto" />
                        <div className="h-4 w-12 rounded shimmer-skeleton ml-auto" />
                      </div>
                    ))
                  ) : (
                    displayGainers.map((s) => (
                      <Link key={s.symbol} to={`/company/${s.symbol}`} className="grid grid-cols-[1.5fr_1.1fr_1.1fr] px-3 py-2.5 hover:bg-surfaceMuted/50 transition-colors">
                        <span className="text-xs font-bold text-accent font-mono truncate">{s.symbol}</span>
                        <span className="text-xs font-mono tabular-nums text-textSecondary text-right">{s.price.toFixed(2)}</span>
                        <span className="text-xs font-mono font-bold text-positive tabular-nums text-right">+{s.changePct.toFixed(2)}%</span>
                      </Link>
                    ))
                  )}
                </div>
              </div>

              {/* Top Losers */}
              <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-[var(--shadow-sm)]">
                <div className="px-4 py-3 border-b border-border/50 flex items-center gap-1.5 bg-negative-soft/20">
                  <TrendingDown className="size-3.5 text-negative" />
                  <span className="text-[11px] font-bold text-negative uppercase tracking-wider">Top Losers</span>
                </div>
                <div className="divide-y divide-border/40">
                  <div className="grid grid-cols-[1.5fr_1.1fr_1.1fr] px-3 py-1.5 bg-surfaceMuted">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-textMuted">SYMBOL</span>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-textMuted text-right">LTP</span>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-textMuted text-right">CHG %</span>
                  </div>
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="grid grid-cols-[1.5fr_1.1fr_1.1fr] px-3 py-3 gap-2">
                        <div className="h-4 w-12 rounded shimmer-skeleton" />
                        <div className="h-4 w-16 rounded shimmer-skeleton ml-auto" />
                        <div className="h-4 w-12 rounded shimmer-skeleton ml-auto" />
                      </div>
                    ))
                  ) : (
                    displayLosers.map((s) => (
                      <Link key={s.symbol} to={`/company/${s.symbol}`} className="grid grid-cols-[1.5fr_1.1fr_1.1fr] px-3 py-2.5 hover:bg-surfaceMuted/50 transition-colors">
                        <span className="text-xs font-bold text-accent font-mono truncate">{s.symbol}</span>
                        <span className="text-xs font-mono tabular-nums text-textSecondary text-right">{s.price.toFixed(2)}</span>
                        <span className="text-xs font-mono font-bold text-negative tabular-nums text-right">{s.changePct.toFixed(2)}%</span>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Market Pulse & Financial News Side-by-Side */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_280px] gap-5">
              {/* Market Pulse Feed */}
              <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-[var(--shadow-sm)]">
                <div className="px-5 py-3.5 border-b border-border/60 flex items-center justify-between bg-surfaceMuted/30">
                  <div className="flex items-center gap-2">
                    <Zap className="size-3.5 text-accent" />
                    <span className="text-sm font-bold text-textPrimary">Market Pulse &amp; Watchlist Updates</span>
                  </div>
                  <div className="flex items-center gap-1 bg-surfaceMuted border border-border rounded-lg p-0.5">
                    {(["all", "alerts"] as const).map((f) => (
                      <button key={f} onClick={() => setFeedFilter(f)}
                        className={cn("px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all",
                          feedFilter === f ? "bg-surface text-accent shadow-[var(--shadow-sm)]" : "text-textSecondary hover:text-textPrimary"
                        )}
                      >
                        {f === "all" ? "All" : "Alerts"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="divide-y divide-border/40">
                  {filteredFeed.map((item) => (
                    <div key={item.id} className={cn("px-5 py-4 hover:bg-surfaceMuted/30 transition-colors", item.highlight === "negative" && "border-l-2 border-negative")}>
                      <div className="flex items-start gap-3">
                        <FeedIcon type={item.type} icon={item.icon} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-textPrimary">{item.name}</span>
                              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-accentSoft text-accent border border-accent/20">{item.symbol}</span>
                              {item.highlight === "positive" && <TrendingUp className="size-3 text-positive" />}
                              {item.highlight === "negative" && <TrendingDown className="size-3 text-negative" />}
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-textMuted shrink-0">
                              <Clock className="size-2.5" />
                              <span className="font-mono">{item.time}</span>
                            </div>
                          </div>
                          <p className={cn("text-xs leading-relaxed font-medium", item.highlight === "negative" ? "text-negative" : "text-textSecondary")}>
                            {item.headline}
                          </p>
                          {item.sub && <p className="text-[10px] text-textMuted font-mono mt-0.5">{item.sub}</p>}
                          <div className="flex items-center gap-2 mt-3 flex-wrap">
                            {item.actions.map((action) => (
                              action.label === "Dismiss" ? (
                                <button key={action.label} className="text-[11px] font-semibold text-textMuted hover:text-textSecondary transition-colors">{action.label}</button>
                              ) : (
                                <Link key={action.label} to={action.href}
                                  className={cn("inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-all",
                                    (action.label === "Analyze Chart" || action.label === "Review Position")
                                      ? "bg-accent text-white border-transparent hover:bg-accent/90"
                                      : "bg-surface border-border text-textSecondary hover:bg-surfaceMuted hover:text-textPrimary"
                                  )}
                                >
                                  {action.icon === "external" && <ExternalLink className="size-3" />}
                                  {action.icon === "chart" && <BarChart2 className="size-3" />}
                                  {action.icon === "bell" && <Bell className="size-3" />}
                                  {action.icon === "bookmark" && <Bookmark className="size-3" />}
                                  {action.label}
                                </Link>
                              )
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial News */}
              <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-[var(--shadow-sm)]">
                <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between bg-surfaceMuted/30">
                  <div className="flex items-center gap-1.5">
                    <Newspaper className="size-3.5 text-accent" />
                    <span className="text-[11px] font-bold text-textPrimary uppercase tracking-wider">Financial News</span>
                  </div>
                  <button className="text-[10px] text-accent hover:underline font-bold">VIEW ALL</button>
                </div>
                <div className="divide-y divide-border/40">
                  {FINANCIAL_NEWS.map(news => (
                    <div key={news.id} className="px-4 py-3 hover:bg-surfaceMuted/20 transition-colors">
                      <p className={cn("text-[9px] font-bold uppercase tracking-widest mb-1", news.categoryColor)}>{news.category}</p>
                      <p className="text-[11px] font-semibold text-textPrimary leading-snug">{news.headline}</p>
                      {news.summary && <p className="text-[10px] text-textMuted leading-relaxed mt-0.5">{news.summary}</p>}
                      <p className="text-[9px] text-textMuted font-mono mt-1.5">{news.time} · {news.source}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent Custom Scans */}
            <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-[var(--shadow-sm)]">
              <div className="px-5 py-3.5 border-b border-border/50 flex items-center justify-between bg-surfaceMuted/30">
                <div className="flex items-center gap-2">
                  <Search className="size-3.5 text-accent" />
                  <span className="text-sm font-bold text-textPrimary">Recent Custom Scans</span>
                </div>
                <div className="flex items-center gap-2">
                  <button className="inline-flex items-center gap-1.5 text-[10px] font-bold text-textSecondary border border-border rounded-lg px-2.5 py-1.5 hover:bg-surfaceMuted transition-colors">
                    <RefreshCw className="size-3" /> REFRESH SCANS
                  </button>
                  <Link to="/screener" className="inline-flex items-center gap-1.5 text-[10px] font-bold text-white bg-accent border border-transparent rounded-lg px-2.5 py-1.5 hover:bg-accent/90 transition-colors">
                    <Plus className="size-3" /> NEW SCAN
                  </Link>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
                {CUSTOM_SCANS.map(scan => (
                  <Link key={scan.label} to="/screener/results" className="bg-surface border border-border rounded-xl p-4 hover:border-accent/30 hover:shadow-sm transition-all group">
                    <p className="text-[10px] font-bold text-textMuted uppercase tracking-wider mb-1">{scan.label}</p>
                    <p className="text-2xl font-black font-mono text-textPrimary tabular-nums group-hover:text-accent transition-colors">{scan.count} Stocks</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {scan.tickers.map(t => (
                        <span key={t} className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border", scan.color)}>{t}</span>
                      ))}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* ══ RIGHT: Upcoming Results + Market Sentiment ════════════ */}
          <div className="space-y-4 lg:col-span-2 xl:col-span-1 lg:grid lg:grid-cols-2 lg:gap-5 lg:space-y-0 xl:block xl:space-y-4">
            {/* Upcoming Results */}
            <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-[var(--shadow-sm)]">
              <div className="px-4 py-3 border-b border-border/60 bg-surfaceMuted/40">
                <div className="flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-accent" />
                  <span className="text-[11px] font-bold text-textPrimary uppercase tracking-wider">Upcoming Results</span>
                </div>
              </div>
              <div className="divide-y divide-border/40">
                {UPCOMING_RESULTS.map((day) => (
                  <div key={day.date} className="px-4 py-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-textMuted w-7">{day.day}</span>
                      <span className="text-[10px] font-mono text-textSecondary">{day.date}</span>
                    </div>
                    {day.items.length === 0 ? (
                      <p className="text-[10px] text-textMuted italic ml-9">No results scheduled</p>
                    ) : (
                      <div className="space-y-1.5 ml-9">
                        {day.items.map((item) => (
                          <Link key={item.symbol} to={`/company/${item.symbol}`} className="flex items-center justify-between group">
                            <span className="text-xs font-semibold text-textPrimary group-hover:text-accent transition-colors">{item.name}</span>
                            <ChevronRight className="size-3 text-textMuted group-hover:text-accent transition-colors" />
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Market Sentiment */}
            <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-[var(--shadow-sm)]">
              <div className="px-4 py-3 border-b border-border/60 bg-surfaceMuted/40">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="size-3.5 text-accent" />
                  <span className="text-[11px] font-bold text-textPrimary uppercase tracking-wider">Market Sentiment</span>
                </div>
              </div>
              <div className="px-4 py-4">
                <div className="flex items-center justify-between text-[10px] font-bold mb-2">
                  <span className="text-positive">Bullish {bullishPct}%</span>
                  <span className="text-negative">Bearish {bearishPct}%</span>
                </div>
                <div className="h-3 w-full rounded-full overflow-hidden flex bg-muted">
                  <div className="h-full bg-gradient-to-r from-positive to-green-400 transition-all" style={{ width: `${bullishPct}%` }} />
                  <div className="h-full bg-gradient-to-r from-red-400 to-negative transition-all" style={{ width: `${bearishPct}%` }} />
                </div>
                <div className="flex items-center justify-between mt-3 text-[10px] text-textMuted font-medium">
                  <span>Extreme Greed</span>
                  <span className="font-bold text-positive text-xs">BULLISH</span>
                  <span>Extreme Fear</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="bg-positive-soft/50 border border-positive/20 rounded-lg px-2.5 py-2 text-center">
                    <div className="text-lg font-black font-mono text-positive tabular-nums">
                      {loading ? "-" : advances}
                    </div>
                    <div className="text-[9px] text-textMuted uppercase tracking-wide">Advancing</div>
                  </div>
                  <div className="bg-negative-soft/50 border border-negative/20 rounded-lg px-2.5 py-2 text-center">
                    <div className="text-lg font-black font-mono text-negative tabular-nums">
                      {loading ? "-" : declines}
                    </div>
                    <div className="text-[9px] text-textMuted uppercase tracking-wide">Declining</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home
