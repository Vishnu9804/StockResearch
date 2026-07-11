import { useState, useEffect, useMemo } from "react"
import { MarketOverview, BreadthCards } from "@/components/dashboard/market-overview"
import { useMarketStatus } from "@/hooks/useMarketStatus"
import { cn } from "@/lib/utils"
import { Link } from "react-router-dom"
import { useAppSelector } from "@/store/hooks"
import finscreenApi, { finscreenClient } from "@/services/finscreenApi"
import axios from "axios"
import { companies } from "@/lib/data/companies"
import { useCompanyNameResolver } from "@/hooks/useCompanyNameResolver"
import {
  BarChart2, Bell, Bookmark, Calendar, ChevronRight, ExternalLink,
  FileText, Plus, RefreshCw, Star, TrendingUp, TrendingDown,
  TriangleAlert, Zap, Activity, Clock, Newspaper, Search
} from "lucide-react"

// Fallback news when API hasn't loaded yet
const FALLBACK_NEWS = [
  {
    id: "n1", category: "ECONOMY", categoryColor: "var(--fs-brand)",
    headline: "RBI maintains status quo on repo rates for the 6th consecutive session.",
    summary: "The MPC voted 5:1 to keep the benchmark rate at 6.5%.", time: "Today", source: "FinEdge"
  },
  {
    id: "n2", category: "MARKETS", categoryColor: "var(--fs-positive)",
    headline: "NSE Nifty closes above 22,500 for the third consecutive session.",
    summary: "The benchmark Index has gained 1.2% in the last 3 days.", time: "Today", source: "FinEdge"
  },
  {
    id: "n3", category: "COMMODITIES", categoryColor: "#f59e0b",
    headline: "Crude oil slips 2% on US inventory build amid demand concerns.",
    summary: "Brent Crude dropped below $82/barrel in early trade.", time: "Yesterday", source: "FinEdge"
  },
  {
    id: "n4", category: "CORPORATE", categoryColor: "#8b5cf6",
    headline: "RIL board approves ₹5,000 Cr buyback at ₹3,000 per share.",
    summary: "The open-market buyback will run for 12 months.", time: "Yesterday", source: "FinEdge"
  },
]

// Fallback feed items when announcements haven't loaded
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
  const resolveName = useCompanyNameResolver()
  const { isAuthenticated } = useAppSelector((state) => state.auth)
  const { watchlists } = useAppSelector((state) => state.watchlist)
  const [feedFilter, setFeedFilter] = useState<"all" | "alerts">("all")

  // Live API States
  const [loading, setLoading] = useState(true)
  const [indices, setIndices] = useState<any[]>([])
  const [quotes, setQuotes] = useState<Record<string, any>>({})
  const [refreshedStocks, setRefreshedStocks] = useState<string[]>([])
  const [resultsCalendar, setResultsCalendar] = useState<any[]>([])
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [news, setNews] = useState<any[]>(FALLBACK_NEWS)
  const [savedScans, setSavedScans] = useState<any[]>([])
  const [scansLoading, setScansLoading] = useState(true)

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setLoading(true)

        const [indicesData, moversQuotes, refreshedData, resultsData, announcementsData, newsData] = await Promise.allSettled([
          finscreenApi.fetchMarketIndices(),
          finscreenApi.fetchMarketMovers(),
          finscreenApi.fetchRefreshedStocks(),
          finscreenApi.fetchResultsCalendar(),
          finscreenApi.fetchMarketAnnouncements(),
          finscreenClient.get('/market/news'),
        ])

        if (indicesData.status === 'fulfilled') {
          setIndices(indicesData.value)
        }
        if (moversQuotes.status === 'fulfilled') {
          setQuotes(moversQuotes.value)
        }
        if (refreshedData.status === 'fulfilled') {
          const rData = refreshedData.value
          if (rData && rData.fallback && Array.isArray(rData.data)) {
            setRefreshedStocks(rData.data)
          } else if (rData && Array.isArray(rData.data)) {
            setRefreshedStocks(rData.data)
          } else if (rData && Array.isArray(rData)) {
            setRefreshedStocks(rData)
          } else {
            setRefreshedStocks(['RELIANCE', 'TCS', 'HDFCBANK'])
          }
        } else {
          setRefreshedStocks(['RELIANCE', 'TCS', 'HDFCBANK'])
        }
        if (resultsData.status === 'fulfilled') {
          setResultsCalendar(resultsData.value || [])
        }
        if (announcementsData.status === 'fulfilled') {
          setAnnouncements(announcementsData.value || [])
        }
        if (newsData.status === 'fulfilled') {
          const nd = (newsData.value as any)?.data
          const arr = Array.isArray(nd) ? nd : Array.isArray(newsData.value) ? newsData.value as any[] : []
          if (arr.length > 0) setNews(arr)
        }
      } catch (err) {
        console.error('Error loading dashboard data:', err)
      } finally {
        setLoading(false)
      }
    }
    loadDashboardData()

    // Load saved screener scans separately (auth-gated, non-blocking)
    async function loadSavedScans() {
      setScansLoading(true)
      try {
        const BASE_API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
        const res = await axios.get(`${BASE_API.replace(/\/$/, '')}/screener/saved`, { withCredentials: true })
        const data = Array.isArray(res.data) ? res.data : (res.data?.screens || res.data?.data || [])
        setSavedScans(data)
      } catch (_e) {
        // Not authenticated or no saved scans — silently ignore
        setSavedScans([])
      } finally {
        setScansLoading(false)
      }
    }
    loadSavedScans()
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
      if (q) {
        const changeVal = typeof q.pct_change === 'number' ? q.pct_change
          : typeof q.change === 'number' ? q.change
            : parseFloat(String(q.pct_change || q.change || '0').replace('%', ''))
        if (changeVal !== 0) { totalChange += changeVal; count++ }
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

  // Calculate dynamic watchlist total value (assuming 1000 shares of each)
  const totalWatchlistValue = useMemo(() => {
    let sum = 0
    renderedWatchlists[0]?.items.forEach((item) => {
      const q = quotes[item.symbol]
      const price = q?.current_price || q?.close_price || (item.symbol === 'RELIANCE' ? 1396.50 : item.symbol === 'TCS' ? 2162.60 : 777.45)
      sum += price * 1000
    })
    return sum
  }, [quotes, renderedWatchlists])

  // Compute live Top Gainers & Losers from batch quotes
  const quoteList = Object.entries(quotes).map(([symbol, q]: [string, any]) => {
    const changePct = typeof q.pct_change === 'number' ? q.pct_change
      : typeof q.change === 'number' ? q.change
        : parseFloat(String(q.pct_change || q.change || '0').replace('%', ''))
    return {
      symbol,
      price: q.current_price || q.close_price || 0,
      changePct,
      volume: q.volume || 0,
    }
  })

  const liveTopGainers = [...quoteList]
    .filter((q) => q.changePct > 0 && q.price >= 10 && q.volume >= 5000)
    .sort((a, b) => b.changePct - a.changePct)
    .slice(0, 4)

  const liveTopLosers = [...quoteList]
    .filter((q) => q.changePct < 0 && q.price >= 10 && q.volume >= 5000)
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
    if (q) {
      const changeVal = typeof q.pct_change === 'number' ? q.pct_change
        : typeof q.change === 'number' ? q.change
          : parseFloat(String(q.pct_change || q.change || '0').replace('%', ''))
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

  // Group results calendar by day for the next 5 days
  const upcomingResultsList = useMemo(() => {
    if (!resultsCalendar || !Array.isArray(resultsCalendar)) return []

    const days: any[] = []
    const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    const today = new Date()
    for (let i = 0; i < 5; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() + i)
      const dateStr = d.toISOString().split('T')[0]

      const dayItems = resultsCalendar
        .filter((item: any) => (item.expected_result_date || item.date) === dateStr)
        .map((item: any) => item.company_name || item.name || item.symbol)

      days.push({
        day: dayNames[d.getDay()],
        date: `${monthNames[d.getMonth()]} ${d.getDate()}`,
        items: dayItems
      })
    }
    return days
  }, [resultsCalendar])

  const fallbackResults = [
    { day: "MON", date: "Oct 14", items: [] },
    { day: "TUE", date: "Oct 15", items: [{ name: "ICICI Bank", symbol: "ICICIBANK" }, { name: "Axis Bank", symbol: "AXISBANK" }] },
    { day: "WED", date: "Oct 16", items: [{ name: "Wipro", symbol: "WIPRO" }] },
    { day: "THU", date: "Oct 17", items: [{ name: "SBI", symbol: "SBIN" }, { name: "Tata Motors", symbol: "TATAMOTORS" }] },
    { day: "FRI", date: "Oct 18", items: [{ name: "Adani Ent.", symbol: "ADANIENT" }] },
  ]
  const displayResults = (upcomingResultsList.some(d => d.items.length > 0))
    ? upcomingResultsList
    : fallbackResults

  // Announcements processing
  const liveAnnouncements = useMemo(() => {
    if (!announcements || !Array.isArray(announcements)) return []
    return announcements.slice(0, 4).map((ann: any) => {
      let icon = "file"
      let type = "document"
      const category = ann.category || "Other"

      if (category.includes("Meeting") || category.includes("Board")) {
        icon = "file"
        type = "document"
      } else if (category.includes("Result") || category.includes("Dividend") || category.includes("High")) {
        icon = "trending-up"
        type = "alert"
      } else if (category.includes("Call") || category.includes("Calendar") || category.includes("Event")) {
        icon = "calendar"
        type = "event"
      } else {
        icon = "alert"
        type = "price-alert"
      }

      const symbol = ann.stock_symbol || ann.nse_code || ann.symbol || ''
      // Try description extraction FIRST — FinEdge always has company name in description
      let name = ''
      if (ann.description && typeof ann.description === 'string') {
        const match = ann.description.match(/^([A-Za-z0-9][A-Za-z0-9\s&()',.-]{2,60}?(?:Limited|Ltd\.|Ltd|Corporation|Industries|Enterprises|Finance|Bank|Technologies|Services|Solutions|Holdings|Investments))\s+has\b/i)
        if (match && match[1]) {
          name = match[1].trim()
        }
      }
      if (!name) {
        const localComp = companies.find(c => c.symbol === symbol.toUpperCase())
        name = ann.company_name || ann.company || localComp?.name || (/^\d+$/.test(symbol) ? '' : symbol) || 'Unknown Company'
      }

      return {
        id: ann.id || Math.random().toString(),
        symbol,
        name,
        type,
        icon,
        time: ann.date ? `${ann.date}` : (ann.announcement_date ? `${ann.announcement_date.split(' ')[0]}` : "Today"),
        headline: ann.title || ann.description || ann.summary || "Announcement",
        category,
        summary: ann.summary || ann.description || ""
      }
    })
  }, [announcements])


  const displayFeed = liveAnnouncements.length > 0 ? liveAnnouncements : FEED_ITEMS
  const filteredFeed = feedFilter === "alerts"
    ? displayFeed.filter(i => i.type === "price-alert" || i.type === "alert")
    : displayFeed

  return (
    <div className="min-h-screen bg-background">
      {/* ── Sticky Header ──────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-surface/95 backdrop-blur-sm border-b border-border px-6 py-3.5 shadow-[var(--shadow-xs)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-gradient leading-tight">Markets Today</h1>
            <p className="text-body text-textSecondary mt-0.5 font-normal">
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
            <span className="font-mono text-xs text-textSecondary">NSE · 09:15 – 15:30 IST</span>
          </div>
        </div>
      </div>

      {/* ── Guest Banner ─────────────────────────────────────────────── */}
      {!isAuthenticated && (
        <div className="mx-6 mt-5 p-4.5 rounded-2xl bg-gradient-to-r from-accentSoft to-accentSoft/40 border border-accent/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-textSecondary select-none">
          <div className="flex items-center gap-2.5">
            <div className="size-7 rounded-full bg-accent/15 border border-accent/20 flex items-center justify-center shrink-0">
              <span className="size-2 rounded-full bg-accent animate-pulse" />
            </div>
            <span className="font-medium">Track your watchlist, build custom screeners, and get real-time price alerts.</span>
          </div>
          <Link to="/register" className="font-medium text-accent hover:text-accent/80 uppercase tracking-wider text-xs shrink-0 bg-white/50 dark:bg-surface/50 border border-accent/20 rounded-lg px-3 py-1.5 transition-colors hover:bg-accentSoft">
            Create Free Account
          </Link>
        </div>
      )}

      {/* ── Markets at a Glance Top Section ──────────────────────────── */}
      <div className="mx-6 mt-6">
        <div className="bg-surface border border-border/40 shadow-xs rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-accent" />
              <h2 className="text-xl font-semibold text-textPrimary tracking-tight">Markets at a Glance</h2>
            </div>
            <span className="text-xs text-textMuted font-medium">NSE Indices & Breadth Summary</span>
          </div>
          <MarketOverview loading={loading} indices={indices} />
          <BreadthCards loading={loading} indices={indices} quotes={quotes} />
        </div>
      </div>

      {/* ── Main grid ────────────────────────────────────────────────── */}
      {/* ── Main grid (Redesigned Bottom Zone) ────────────────────────── */}
      <div
        className="px-6 pb-12 flex flex-col gap-4 max-w-[1400px] mx-auto w-full select-none"
        style={{ marginTop: '24px' }}
      >
        {/* PANEL 1 — MY WATCHLISTS CARD */}
        <div
          style={{
            background: 'var(--fs-surface)',
            border: 'var(--fs-border)',
            borderRadius: 'var(--fs-radius-md)',
            padding: 'var(--fs-space-lg) var(--fs-space-xl)'
          }}
          className="w-full flex flex-col gap-3"
        >
          <div className="flex items-center justify-between w-full">
            <div
              className="flex items-center gap-2 text-textPrimary text-lg font-semibold uppercase tracking-wider"
            >
              <Star className="size-4 text-[var(--fs-info)]" />
              MY WATCHLISTS
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-accentSoft text-accent px-2 py-0.5 rounded-full text-xs font-medium">
                {String(mappedWatchlists[0]?.count ?? 3).padStart(2, '0')} stocks
              </span>
              <span className={cn(
                "text-body font-medium",
                (mappedWatchlists[0]?.positive ?? true) ? "text-positive" : "text-negative"
              )}>
                {mappedWatchlists[0]?.change ?? "+1.24%"}
              </span>
              <button className="size-5 rounded-md border border-[var(--fs-border-color)] flex items-center justify-center text-textSecondary hover:bg-surfaceMuted transition-colors ml-1">
                <Plus className="size-3" />
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--fs-space-sm)' }} className="w-full">
            <div style={{ background: 'var(--fs-surface-muted)', borderRadius: 'var(--fs-radius-sm)', padding: 'var(--fs-space-sm) var(--fs-space-md)' }} className="flex flex-col gap-0.5 animate-count-up">
              <span className="text-xs text-textSecondary font-medium uppercase tracking-wider">TOTAL VALUE</span>
              <span className="text-lg font-semibold text-textPrimary font-mono">
                ₹{totalWatchlistValue.toLocaleString('en-IN')}
              </span>
            </div>
            <div style={{ background: 'var(--fs-surface-muted)', borderRadius: 'var(--fs-radius-sm)', padding: 'var(--fs-space-sm) var(--fs-space-md)' }} className="flex flex-col gap-0.5 animate-count-up">
              <span className="text-xs text-textSecondary font-medium uppercase tracking-wider">DAILY CHANGE</span>
              <span className={cn(
                "text-lg font-semibold font-mono",
                (mappedWatchlists[0]?.positive ?? true) ? "text-positive" : "text-negative"
              )}>
                {mappedWatchlists[0]?.change ?? "+1.24%"}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between w-full mt-1">
            <span className="text-xs text-textSecondary font-medium uppercase tracking-wider">RECENTLY REFRESHED</span>
            <span className="bg-positive-soft text-positive px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-[var(--fs-positive)] animate-pulse" />
              LIVE
            </span>
          </div>

          <div className="flex flex-col w-full">
            {[
              { symbol: "RELIANCE", defaultPrice: 1396.50, defaultChange: "+1.04%" },
              { symbol: "TCS", defaultPrice: 2162.60, defaultChange: "+0.06%" },
              { symbol: "HDFCBANK", defaultPrice: 777.45, defaultChange: "+0.45%" },
            ].map((s, idx, arr) => {
              const q = quotes[s.symbol] || {}
              const price = q.current_price || q.close_price || s.defaultPrice
              const changeVal = typeof q.pct_change === 'number' ? q.pct_change
                : typeof q.change === 'number' ? q.change
                  : q.change ? parseFloat(String(q.change).replace('%', ''))
                    : null
              const changeText = changeVal !== null ? (changeVal >= 0 ? `+${changeVal.toFixed(2)}%` : `${changeVal.toFixed(2)}%`) : s.defaultChange
              const isPos = changeVal !== null ? changeVal >= 0 : s.defaultChange.startsWith('+')

              return (
                <div
                  key={s.symbol}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '7px 0',
                    borderBottom: idx === arr.length - 1 ? 'none' : '0.5px solid var(--fs-border-color)'
                  }}
                  className="w-full"
                >
                  <div className="flex items-center gap-3">
                    <Link to={`/company/${s.symbol}`} className="text-body font-semibold text-accent hover:underline truncate max-w-[150px] block" title={resolveName(s.symbol)}>
                      {resolveName(s.symbol)}
                    </Link>
                    <span className="text-sm color-textSecondary font-normal">14s ago</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-body font-normal text-textPrimary">
                      ₹{price.toFixed(2)}
                    </span>
                    <span className={cn(
                      "font-mono w-16 text-right text-body font-medium",
                      isPos ? "text-positive" : "text-negative"
                    )}>
                      {changeText}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* PANEL 2 — TOP MOVERS CARD */}
        <div
          style={{
            background: 'var(--fs-surface)',
            border: 'var(--fs-border)',
            borderRadius: 'var(--fs-radius-md)',
            padding: 'var(--fs-space-lg) var(--fs-space-xl)'
          }}
          className="w-full flex flex-col gap-3"
        >
          <div className="flex items-center justify-between w-full">
            <div
              className="flex items-center gap-2 text-textPrimary text-lg font-semibold uppercase tracking-wider"
            >
              <TrendingUp className="size-4 text-[var(--fs-info)]" />
              TOP MOVERS
            </div>
            <span className="text-textSecondary text-sm font-normal">NSE daily overview</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--fs-space-lg)' }} className="w-full">
            {/* Top Gainers */}
            <div>
              <div
                className="text-xs font-semibold text-positive uppercase tracking-wider pb-1.5"
              >
                TOP GAINERS
              </div>
              <div className="flex flex-col w-full">
                {displayGainers.map((g, idx, arr) => (
                  <div
                    key={g.symbol}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '6px 0',
                      borderBottom: idx === arr.length - 1 ? 'none' : '0.5px solid var(--fs-border-color)'
                    }}
                    className="w-full font-mono text-body font-normal"
                  >
                    <Link to={`/company/${g.symbol}`} className="font-medium text-accent hover:underline truncate max-w-[130px] block" title={resolveName(g.symbol)}>
                      {resolveName(g.symbol)}
                    </Link>
                    <span style={{ color: 'var(--fs-text-secondary)' }}>
                      {typeof g.price === 'number' ? g.price.toFixed(2) : g.price}
                    </span>
                    <span style={{ fontWeight: 'var(--fs-weight-medium)', color: 'var(--fs-positive)' }}>
                      +{g.changePct.toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Losers */}
            <div>
              <div
                className="text-xs font-semibold text-negative uppercase tracking-wider pb-1.5"
              >
                TOP LOSERS
              </div>
              <div className="flex flex-col w-full">
                {displayLosers.map((l, idx, arr) => (
                  <div
                    key={l.symbol}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '6px 0',
                      borderBottom: idx === arr.length - 1 ? 'none' : '0.5px solid var(--fs-border-color)'
                    }}
                    className="w-full font-mono text-body font-normal"
                  >
                    <Link to={`/company/${l.symbol}`} className="font-medium text-accent hover:underline truncate max-w-[130px] block" title={resolveName(l.symbol)}>
                      {resolveName(l.symbol)}
                    </Link>
                    <span style={{ color: 'var(--fs-text-secondary)' }}>
                      {typeof l.price === 'number' ? l.price.toFixed(2) : l.price}
                    </span>
                    <span style={{ fontWeight: 'var(--fs-weight-medium)', color: 'var(--fs-negative)' }}>
                      {l.changePct.toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* PANEL 3 — MARKET PULSE CARD */}
        <div
          style={{
            background: 'var(--fs-surface)',
            border: 'var(--fs-border)',
            borderRadius: 'var(--fs-radius-md)',
            padding: 'var(--fs-space-lg) var(--fs-space-xl)'
          }}
          className="w-full flex flex-col gap-3"
        >
          <div className="flex items-center justify-between w-full">
            <div
              className="flex items-center gap-2 text-textPrimary text-lg font-semibold uppercase tracking-wider"
            >
              <Zap className="size-4 text-[var(--fs-info)]" />
              MARKET PULSE
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setFeedFilter("all")}
                style={{
                  background: feedFilter === 'all' ? '#e5e7eb' : 'transparent',
                  color: 'var(--fs-text-primary)',
                  padding: '3px 10px',
                  borderRadius: 'var(--fs-radius-md)'
                }}
                className="text-xs font-medium"
              >
                All
              </button>
              <button
                onClick={() => setFeedFilter("alerts")}
                style={{
                  background: feedFilter === 'alerts' ? 'var(--fs-warning-soft)' : 'transparent',
                  color: 'var(--fs-warning)',
                  padding: '3px 10px',
                  borderRadius: 'var(--fs-radius-md)'
                }}
                className="text-xs font-medium"
              >
                Alerts
              </button>
            </div>
          </div>

          <div className="flex flex-col w-full">
            {filteredFeed.map((item, idx, arr) => {
              const isPriceAlert = item.type === "price-alert";
              return (
                <div
                  key={item.id}
                  style={isPriceAlert ? {
                    borderLeft: '3px solid #E24B4A',
                    background: 'var(--fs-negative-soft)',
                    borderRadius: '0 8px 8px 0',
                    padding: '10px 12px',
                    marginTop: idx > 0 ? '10px' : '0',
                    display: 'flex',
                    gap: 'var(--fs-space-md)',
                    alignItems: 'flex-start'
                  } : {
                    display: 'flex',
                    gap: 'var(--fs-space-md)',
                    alignItems: 'flex-start',
                    padding: '12px 0',
                    borderBottom: idx === arr.length - 1 ? 'none' : 'var(--fs-border)'
                  }}
                  className="w-full"
                >
                  <div style={{
                    background: isPriceAlert ? 'var(--fs-surface)' : 'var(--fs-surface-muted)',
                    border: isPriceAlert ? '0.5px solid rgba(163,45,45,0.2)' : 'none',
                    borderRadius: 'var(--fs-radius-sm)',
                    width: '34px',
                    height: '34px'
                  }} className={cn("flex-shrink-0 flex items-center justify-center", isPriceAlert ? "text-[var(--fs-negative)]" : "text-[#666]")}>
                    {item.icon === "file" && <FileText className="size-4" />}
                    {item.icon === "trending-up" && <TrendingUp className="size-4 text-[var(--fs-positive)]" />}
                    {item.icon === "calendar" && <Calendar className="size-4 text-purple-600" />}
                    {item.icon === "alert" && <TriangleAlert className="size-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className={cn("text-body font-semibold", isPriceAlert ? "text-negative" : "text-textPrimary")}>{resolveName(item.symbol)}</span>
                      {item.symbol && !/^\d+$/.test(item.symbol) && (
                        <span className={cn("px-1.5 py-0.5 rounded text-xs font-mono font-medium", isPriceAlert ? "bg-negative-soft text-negative border border-negative/25" : "bg-accentSoft text-accent")}>{item.symbol}</span>
                      )}
                      <span className={cn("text-sm ml-auto", isPriceAlert ? "text-negative opacity-80" : "text-textSecondary")}>{item.time}</span>
                    </div>
                    <p className={cn("text-body font-normal leading-normal", isPriceAlert ? "text-negative" : "text-textPrimary")}>
                      {item.headline}
                    </p>
                    <div style={{ display: 'flex', gap: 'var(--fs-space-xs)', marginTop: '8px' }}>
                      {item.type === "price-alert" ? (
                        <>
                          <Link to={`/company/${item.symbol}`} style={{ background: 'var(--fs-negative)', color: 'var(--fs-surface)', border: 'none', borderRadius: 'var(--fs-radius-sm)', padding: '4px 10px' }} className="hover:bg-[#852424] transition-colors text-xs font-medium decoration-none">
                            Review position
                          </Link>
                          <a href="#" onClick={(e) => e.preventDefault()} style={{ border: '0.5px solid rgba(163,45,45,0.2)', borderRadius: 'var(--fs-radius-sm)', padding: '4px 10px', color: 'var(--fs-negative)' }} className="hover:bg-red-100/40 transition-colors text-xs font-medium decoration-none">
                            Dismiss
                          </a>
                        </>
                      ) : (
                        <>
                          {item.type === "document" && (
                            <a href="#" onClick={(e) => e.preventDefault()} style={{ border: 'var(--fs-border)', borderRadius: 'var(--fs-radius-sm)', padding: '4px 10px', color: 'var(--fs-text-primary)' }} className="flex items-center gap-1 hover:bg-surfaceMuted transition-colors text-xs font-medium decoration-none">
                              <ExternalLink className="size-3" /> View report
                            </a>
                          )}
                          {item.type === "event" && (
                            <a href="#" onClick={(e) => e.preventDefault()} style={{ border: 'var(--fs-border)', borderRadius: 'var(--fs-radius-sm)', padding: '4px 10px', color: 'var(--fs-text-primary)' }} className="flex items-center gap-1 hover:bg-surfaceMuted transition-colors text-xs font-medium decoration-none">
                              <Bell className="size-3" /> Set reminder
                            </a>
                          )}
                          {item.type === "alert" && (
                            <Link to={`/company/${item.symbol}`} style={{ background: 'var(--fs-info)', color: 'var(--fs-surface)', border: 'none', borderRadius: 'var(--fs-radius-sm)', padding: '4px 10px' }} className="flex items-center gap-1 hover:bg-[#09325c] transition-colors text-xs font-medium decoration-none">
                              <BarChart2 className="size-3" /> Analyze chart
                            </Link>
                          )}
                          <a href="#" onClick={(e) => e.preventDefault()} style={{ border: 'var(--fs-border)', borderRadius: 'var(--fs-radius-sm)', padding: '4px 10px', color: 'var(--fs-text-primary)' }} className="flex items-center gap-1 hover:bg-surfaceMuted transition-colors text-xs font-medium decoration-none">
                            {item.type === "document" ? <><Bookmark className="size-3" /> Save for later</> : "Compare peers"}
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* PANEL 4 — FINANCIAL NEWS CARD */}
        <div
          style={{
            background: 'var(--fs-surface)',
            border: 'var(--fs-border)',
            borderRadius: 'var(--fs-radius-md)',
            padding: 'var(--fs-space-lg) var(--fs-space-xl)'
          }}
          className="w-full flex flex-col gap-3"
        >
          <div className="flex items-center justify-between w-full">
            <div
              className="flex items-center gap-2 text-textPrimary text-lg font-semibold uppercase tracking-wider"
            >
              <Newspaper className="size-4 text-[var(--fs-info)]" />
              FINANCIAL NEWS
            </div>
            <Link to="/" className="text-accent text-sm font-medium flex items-center gap-0.5 hover:underline">
              View all <ChevronRight className="size-3.5" />
            </Link>
          </div>

          <div className="flex flex-col w-full">
            {loading ? (
              [1, 2, 3, 4].map(i => (
                <div key={i} style={{ padding: '11px 0', borderBottom: i < 4 ? '0.5px solid var(--fs-border-color)' : 'none' }} className="flex flex-col gap-1.5">
                  <div className="w-16 h-2.5 bg-surfaceMuted/70 rounded animate-pulse" />
                  <div className="w-full h-3.5 bg-surfaceMuted/50 rounded animate-pulse" />
                  <div className="w-1/3 h-2.5 bg-surfaceMuted/40 rounded animate-pulse" />
                </div>
              ))
            ) : news.slice(0, 4).map((item: any, idx: number, arr: any[]) => (
              <div
                key={item.id ?? item.headline}
                style={{
                  padding: '11px 0',
                  borderBottom: idx === arr.length - 1 ? 'none' : '0.5px solid var(--fs-border-color)'
                }}
                className="w-full flex flex-col gap-1"
              >
                <span style={{ color: item.categoryColor || 'var(--fs-brand)' }} className="text-xs font-semibold uppercase tracking-wider leading-none">
                  {item.category}
                </span>
                <p className="text-body font-medium leading-normal text-textPrimary">
                  {item.headline}
                </p>
                <span className="text-sm text-textSecondary font-normal">
                  {item.time}{item.source ? ` · ${item.source}` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* PANEL 5 — UPCOMING RESULTS CARD */}
        <div
          style={{
            background: 'var(--fs-surface)',
            border: 'var(--fs-border)',
            borderRadius: 'var(--fs-radius-md)',
            padding: 'var(--fs-space-lg) var(--fs-space-xl)'
          }}
          className="w-full flex flex-col gap-3"
        >
          <div className="flex items-center justify-between w-full">
            <div
              className="flex items-center gap-2 text-textPrimary text-lg font-semibold uppercase tracking-wider"
            >
              <Calendar className="size-4 text-[var(--fs-info)]" />
              UPCOMING RESULTS
            </div>
            <span className="text-textSecondary text-sm font-normal">This week</span>
          </div>

          <div className="flex flex-col w-full">
            {displayResults.map((day, idx, arr) => (
              <div
                key={day.date}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--fs-space-md)',
                  padding: '9px 0',
                  borderBottom: idx === arr.length - 1 ? 'none' : '0.5px solid var(--fs-border-color)'
                }}
                className="w-full"
              >
                <span className="text-sm font-semibold text-textSecondary uppercase flex-shrink-0 w-9">
                  {day.day}
                </span>
                <span className="text-sm text-textSecondary font-normal w-11 flex-shrink-0 font-mono">
                  {day.date}
                </span>
                <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
                  {day.items.length === 0 ? (
                    <span className="text-body text-textMuted font-normal italic">
                      No results scheduled
                    </span>
                  ) : (
                    day.items.map((item: any) => {
                      const label = typeof item === 'string' ? item : (item.name || item.symbol || '')
                      const itemKey = typeof item === 'string' ? item : (item.symbol || item.name || Math.random().toString())
                      return (
                        <span
                          key={itemKey}
                          style={{
                            padding: '2px 9px',
                            border: 'var(--fs-border)',
                            borderRadius: 'var(--fs-radius-xl)',
                            color: 'var(--fs-text-primary)'
                          }}
                          className="text-sm font-medium bg-white"
                        >
                          {label}
                        </span>
                      )
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PANEL 6 — MARKET SENTIMENT CARD */}
        <div
          style={{
            background: 'var(--fs-surface)',
            border: 'var(--fs-border)',
            borderRadius: 'var(--fs-radius-md)',
            padding: 'var(--fs-space-lg) var(--fs-space-xl)'
          }}
          className="w-full flex flex-col gap-3.5"
        >
          <div className="flex items-center justify-between w-full">
            <div
              className="flex items-center gap-2 text-textPrimary text-lg font-semibold uppercase tracking-wider"
            >
              <Activity className="size-4 text-[var(--fs-info)]" />
              MARKET SENTIMENT
            </div>
            <span className="text-textSecondary text-sm font-normal">NSE breadth</span>
          </div>

          <div className="w-full">
            <div className="flex items-center justify-between text-xs mb-1 font-medium">
              <span style={{ color: 'var(--fs-positive)' }}>Bullish {bullishPct}%</span>
              <span style={{ color: 'var(--fs-negative)' }}>Bearish {bearishPct}%</span>
            </div>
            <div style={{ height: '8px', borderRadius: '4px', background: '#F09595', overflow: 'hidden' }} className="w-full">
              <div style={{ width: `${bullishPct}%`, height: '100%', background: '#639922', borderRadius: '4px' }} />
            </div>
            <div className="flex items-center justify-between mt-1 text-xs font-medium text-textMuted uppercase tracking-wider">
              <span>Extreme greed</span>
              <span>Extreme fear</span>
            </div>
          </div>

          <div style={{ display: 'block', textAlign: 'center', margin: '6px 0' }} className="w-full">
            <span style={{ color: '#27500A', padding: '4px 18px', borderRadius: 'var(--fs-radius-xl)', display: 'inline-block' }} className="bg-positive-soft text-body font-medium">
              Bullish
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--fs-space-sm)' }} className="w-full mt-1">
            <div style={{ background: 'var(--fs-surface-muted)', borderRadius: 'var(--fs-radius-sm)', padding: 'var(--fs-space-md)', textAlign: 'center' }} className="flex flex-col items-center">
              <span className="text-2xl font-semibold color-positive font-mono tabular-nums leading-none mb-1">
                {loading ? "-" : advances}
              </span>
              <span className="text-xs text-textSecondary font-medium uppercase tracking-wider">ADVANCING</span>
            </div>
            <div style={{ background: 'var(--fs-surface-muted)', borderRadius: 'var(--fs-radius-sm)', padding: 'var(--fs-space-md)', textAlign: 'center' }} className="flex flex-col items-center">
              <span className="text-2xl font-semibold color-negative font-mono tabular-nums leading-none mb-1">
                {loading ? "-" : declines}
              </span>
              <span className="text-xs text-textSecondary font-medium uppercase tracking-wider">DECLINING</span>
            </div>
          </div>
        </div>

        {/* PANEL 7 — RECENT CUSTOM SCANS CARD */}
        <div
          style={{
            background: 'var(--fs-surface)',
            border: 'var(--fs-border)',
            borderRadius: 'var(--fs-radius-md)',
            padding: 'var(--fs-space-lg) var(--fs-space-xl)'
          }}
          className="w-full flex flex-col gap-3.5"
        >
          <div className="flex items-center justify-between w-full">
            <div
              className="flex items-center gap-2 text-textPrimary text-lg font-semibold uppercase tracking-wider"
            >
              <Search className="size-4 text-[var(--fs-info)]" />
              RECENT CUSTOM SCANS
            </div>
            <div className="flex items-center gap-2 text-xs">
              <button style={{ border: 'var(--fs-border)', borderRadius: 'var(--fs-radius-sm)', padding: '5px 12px', color: 'var(--fs-text-primary)' }} className="flex items-center gap-1 hover:bg-surfaceMuted transition-colors font-medium uppercase">
                <RefreshCw className="size-3" /> Refresh
              </button>
              <Link to="/screener" style={{ background: 'var(--fs-brand)', color: 'var(--fs-surface)', border: 'none', borderRadius: 'var(--fs-radius-sm)', padding: '5px 12px' }} className="flex items-center gap-1 hover:bg-[#124b82] transition-colors font-medium">
                <Plus className="size-3.5" /> + New Scan
              </Link>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--fs-space-md)', marginTop: '4px' }} className="w-full">
            {scansLoading ? (
              [1, 2, 3, 4].map(i => (
                <div key={i} style={{ background: 'var(--fs-surface-muted)', borderRadius: 'var(--fs-radius-sm)', padding: 'var(--fs-space-md) var(--fs-space-lg)' }} className="flex flex-col gap-2">
                  <div className="w-24 h-2.5 bg-surfaceMuted rounded animate-pulse" />
                  <div className="w-10 h-6 bg-surfaceMuted rounded animate-pulse" />
                </div>
              ))
            ) : savedScans.length > 0 ? (
              savedScans.slice(0, 4).map((scan: any) => {
                const title = scan.name || scan.title || scan.query || 'Custom Scan'
                const query = scan.query || scan.filter_query || scan.filters || ''
                const created = scan.created_at ? new Date(scan.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''
                return (
                  <Link
                    key={scan.id}
                    to={`/screener?scan=${scan.id}`}
                    style={{
                      background: 'var(--fs-surface-muted)',
                      borderRadius: 'var(--fs-radius-sm)',
                      padding: 'var(--fs-space-md) var(--fs-space-lg)'
                    }}
                    className="flex flex-col hover:bg-surfaceMuted/80 transition-colors"
                  >
                    <span className="text-xs text-textSecondary font-semibold uppercase tracking-wider mb-1 truncate">
                      {String(title).toUpperCase().slice(0, 22)}
                    </span>
                    <div className="font-mono text-body font-medium text-accent leading-none flex items-baseline gap-1 mt-1">
                      <span className="text-xs text-textMuted font-sans font-normal truncate max-w-full">{String(query).slice(0, 40)}</span>
                    </div>
                    {created && (
                      <span className="text-xs text-textMuted font-normal mt-2">Saved: {created}</span>
                    )}
                  </Link>
                )
              })
            ) : (
              // No saved scans — show empty state with CTA
              <div style={{ gridColumn: '1 / -1' }} className="flex flex-col items-center justify-center py-6 text-center">
                <Search className="size-8 text-textMuted mb-2" />
                <p className="text-sm text-textSecondary font-medium">No saved scans yet</p>
                <p className="text-xs text-textMuted mt-1">Create and save screener queries to see them here.</p>
                <Link to="/screener" style={{ background: 'var(--fs-brand)', color: 'white', borderRadius: 'var(--fs-radius-sm)', padding: '6px 16px' }} className="mt-3 text-xs font-medium inline-flex items-center gap-1 hover:opacity-90 transition-opacity">
                  <Plus className="size-3" /> Build a Screen
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home
