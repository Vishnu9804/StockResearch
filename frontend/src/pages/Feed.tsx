import { useMemo, useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Heading } from '@/components/ui/Heading'
import { Text } from '@/components/ui/Text'
import finscreenApi, { butterflyApi, type ButterflyAlertDto } from '@/services/finscreenApi'
import { AppFooter } from '@/components/shared/AppFooter'
import { ChevronRight, FileText, Calendar, Newspaper, ExternalLink, Bookmark, Search, Inbox, BellRing, X, LogIn } from 'lucide-react'
import { FeedCardSkeleton } from '@/components/ui/SkeletonLoader'
import { InlineError } from '@/components/ui/InlineError'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { AnnouncementItem } from '@/components/shared/AnnouncementItem'
import { PaginationBar } from '@/components/ui/PaginationBar'
import { companies } from '@/lib/data/companies'
import { fetchAnnouncementsStart } from '@/store/slices/marketPulseSlice'
import type { RootState, AppDispatch } from '@/store'
import type { Announcement } from '@/lib/data/market-pulse'

// ── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = ['All', 'Board Meeting', 'Concall', 'Annual Report', 'Dividend', 'Results']

// Exactly the categories the backend assigns in routers/news.py::CATEGORY_COLORS —
// kept in sync with that module so a chip here can never silently stop matching
// real data.
const NEWS_CATEGORIES = ['All', 'MACRO', 'MARKETS', 'COMMODITY', 'POLICY', 'GLOBAL', 'SECTOR', 'CORPORATE']

const ALERT_SEVERITIES = ['All', 'RED', 'ORANGE', 'YELLOW'] as const

// The ONLY place a news item gets a RED/ORANGE/YELLOW danger color in this
// app — it comes from a real, scored user_news_alerts row written by the
// Butterfly Effect workflow (backend/agents/butterfly/, services/
// butterfly_scorer.py), never a UI heuristic. Keep in sync with the palette
// implied by backend/services/butterfly_scorer.py's three severities.
const SEVERITY_STYLES: Record<string, { text: string; bg: string; border: string; dot: string }> = {
  RED:    { text: 'text-red-700 dark:text-red-400',    bg: 'bg-red-50 dark:bg-red-950/30',    border: 'border-red-500/40',    dot: 'bg-red-600' },
  ORANGE: { text: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/30', border: 'border-orange-500/40', dot: 'bg-orange-500' },
  YELLOW: { text: 'text-amber-700 dark:text-amber-400',  bg: 'bg-amber-50 dark:bg-amber-950/30',  border: 'border-amber-500/40',  dot: 'bg-amber-500' },
}

const UPCOMING_RESULTS = [
  { day: "MON", date: "Oct 14", items: [] },
  { day: "TUE", date: "Oct 15", items: ["ICICI Bank", "Axis Bank"] },
  { day: "WED", date: "Oct 16", items: ["Wipro"] },
  { day: "THU", date: "Oct 17", items: ["SBI", "Tata Motors"] },
  { day: "FRI", date: "Oct 18", items: ["Adani Ent."] },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDateHeading(dateStr: string): string {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  if (dateStr === todayStr) return 'Today'
  if (dateStr === yesterdayStr) return 'Yesterday'

  const parts = dateStr.split('-')
  if (parts.length === 3) {
    const monthIndex = parseInt(parts[1], 10) - 1
    const day = parseInt(parts[2], 10)
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    return `${months[monthIndex]} ${day}, ${parts[0]}`
  }
  return dateStr
}

function extractCompanyName(ann: any): string {
  const symbol = ann.stock_symbol || ann.nse_code || ann.symbol || ''
  if (ann.description && typeof ann.description === 'string') {
    const match = ann.description.match(/^([A-Za-z0-9][A-Za-z0-9\s&()',.\\-]{2,60}?(?:Limited|Ltd\.|Ltd|Corporation|Industries|Enterprises|Finance|Bank|Technologies|Services|Solutions|Holdings|Investments))\s+has\b/i)
    if (match && match[1]) return match[1].trim()
  }
  const localComp = companies.find(c => c.symbol === symbol.toUpperCase())
  return ann.company_name || ann.company || localComp?.name || (/^\d+$/.test(symbol) ? '' : symbol) || 'Unknown Company'
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Feed() {
  const dispatch = useDispatch<AppDispatch>()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeCategory = searchParams.get('category') ?? 'All'
  const searchQuery    = searchParams.get('q') ?? ''

  // 'news' (default) mirrors the central news_items store exactly, newest
  // first. 'announcements' keeps the pre-existing FinEdge corp-announcements
  // list — a real but distinct data type (regulatory filings, not news
  // articles) that must never be blended into the same list as news.
  // 'alerts' is the user's own RED/ORANGE/YELLOW butterfly alerts — portfolio-
  // scoped, requires auth, never mixed into the public news/announcements lists.
  const tabParam = searchParams.get('tab')
  const activeTab: 'news' | 'announcements' | 'alerts' =
    tabParam === 'announcements' ? 'announcements' : tabParam === 'alerts' ? 'alerts' : 'news'
  const activeNewsCategory = searchParams.get('ncat') ?? 'All'
  const activeSeverity = (searchParams.get('sev') ?? 'All') as typeof ALERT_SEVERITIES[number]

  // ── News tab state (backend/routers/news.py — real ingested articles) ────
  const [newsItems, setNewsItems]     = useState<any[]>([])
  const [newsTotal, setNewsTotal]     = useState(0)
  const [newsPage, setNewsPage]       = useState(1)
  const [newsLimit, setNewsLimit]     = useState(25)
  const [newsLoading, setNewsLoading] = useState(true)
  const [newsError, setNewsError]     = useState<string | null>(null)
  // Set when the backend had nothing inside its freshness window and fell
  // back to the newest available stories regardless of age (routers/news.py)
  // — surfaced so "no recent news" and "no news at all" are never conflated.
  const [newsStale, setNewsStale]         = useState(false)
  const [newsNewestAt, setNewsNewestAt]   = useState<string | null>(null)

  // Sidebar state (still fetched locally — not paginated)
  const [resultsCalendar, setResultsCalendar] = useState<any[]>([])
  const [liveNews, setLiveNews]               = useState<any[]>([])
  const [sidebarLoading, setSidebarLoading]   = useState(true)

  // Density preference
  const [density, setDensity] = useLocalStorage<'comfortable' | 'compact'>('announcements_density', 'comfortable')

  // ── Alerts tab state (backend/routers/butterfly.py — real, scored,
  // portfolio-aware RED/ORANGE/YELLOW alerts; the ONLY source of that
  // severity coloring anywhere in the app) ─────────────────────────────────
  const isAuthenticated = useSelector((s: RootState) => s.auth.isAuthenticated)
  const [alertItems, setAlertItems]     = useState<ButterflyAlertDto[]>([])
  const [alertTotal, setAlertTotal]     = useState(0)
  const [alertPage, setAlertPage]       = useState(1)
  const [alertLimit] = useState(25)
  const [alertLoading, setAlertLoading] = useState(true)
  const [alertError, setAlertError]     = useState<string | null>(null)

  // ── Redux state ────────────────────────────────────────────────────────────
  const { items: rawItems, total, page, limit, status, error } =
    useSelector((s: RootState) => s.marketPulse.announcements)

  const loading = status === 'loading' || status === 'idle'

  // ── Dispatch on mount and on page / limit change ──────────────────────────
  useEffect(() => {
    dispatch(fetchAnnouncementsStart({ page, limit }))
  }, [dispatch, page, limit])

  // ── News tab fetch — straight from news_items, no client-side reordering ──
  // Category AND search both happen server-side (routers/news.py) — a search
  // box that only filtered the 25 items already on screen would wrongly
  // report "no results" for a term that exists elsewhere in the table, which
  // is exactly the bug this replaced. The list you get back is exactly the
  // DB's published_at DESC order (or, when searching, every match regardless
  // of recency — see routers/news.py::list_news for why).
  useEffect(() => {
    if (activeTab !== 'news') return
    let cancelled = false
    setNewsLoading(true)
    setNewsError(null)
    finscreenApi
      .fetchNews({
        page: newsPage,
        limit: newsLimit,
        ...(activeNewsCategory !== 'All' ? { category: activeNewsCategory } : {}),
        ...(searchQuery ? { q: searchQuery } : {}),
      })
      .then((res: any) => {
        if (cancelled) return
        setNewsItems(Array.isArray(res?.data) ? res.data : [])
        setNewsTotal(typeof res?.total === 'number' ? res.total : 0)
        setNewsStale(Boolean(res?.stale))
        setNewsNewestAt(res?.newestPublishedAt ?? null)
      })
      .catch((err: any) => {
        if (cancelled) return
        setNewsError(err?.message || 'Failed to load news')
      })
      .finally(() => {
        if (!cancelled) setNewsLoading(false)
      })
    return () => { cancelled = true }
  }, [activeTab, activeNewsCategory, searchQuery, newsPage, newsLimit])

  // Reset to page 1 whenever the news search term changes — otherwise a
  // search performed while sitting on, say, page 5 would silently query page
  // 5 of the new, much smaller result set and could show nothing at all even
  // when the term matches plenty of rows.
  useEffect(() => {
    if (activeTab === 'news') setNewsPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, activeTab])

  // ── Alerts tab fetch — GET /api/butterfly/alerts, requires auth since it's
  // scored against the signed-in user's own portfolio. Dismissed alerts are
  // excluded server-side by default (includeDismissed defaults to false).
  useEffect(() => {
    if (activeTab !== 'alerts' || !isAuthenticated) {
      setAlertLoading(false)
      return
    }
    let cancelled = false
    setAlertLoading(true)
    setAlertError(null)
    butterflyApi
      .listAlerts({
        page: alertPage,
        limit: alertLimit,
        ...(activeSeverity !== 'All' ? { severity: activeSeverity } : {}),
      })
      .then((res) => {
        if (cancelled) return
        setAlertItems(Array.isArray(res?.data) ? res.data : [])
        setAlertTotal(typeof res?.total === 'number' ? res.total : 0)
      })
      .catch((err: any) => {
        if (cancelled) return
        setAlertError(err?.response?.data?.detail || err?.message || 'Failed to load alerts')
      })
      .finally(() => {
        if (!cancelled) setAlertLoading(false)
      })
    return () => { cancelled = true }
  }, [activeTab, activeSeverity, alertPage, alertLimit, isAuthenticated])

  // ── Sidebar data (results calendar + news) ────────────────────────────────
  useEffect(() => {
    setSidebarLoading(true)
    Promise.allSettled([
      finscreenApi.fetchResultsCalendar(),
      finscreenApi.fetchMarketNews(),
    ]).then(([resData, newsData]) => {
      if (resData.status === 'fulfilled') setResultsCalendar(resData.value || [])
      if (newsData.status === 'fulfilled') setLiveNews(Array.isArray(newsData.value) ? newsData.value.slice(0, 6) : [])
    }).finally(() => setSidebarLoading(false))
  }, [])

  // ── Map raw API items → Announcement shape ─────────────────────────────────
  const displayAnnouncements = useMemo((): Announcement[] => {
    return rawItems.map((ann: any) => ({
      id:       String(ann.id || Math.random()),
      company:  extractCompanyName(ann),
      symbol:   ann.stock_symbol || ann.nse_code || ann.symbol || '',
      date:     ann.date || (ann.announcement_date ? ann.announcement_date.split(' ')[0] : new Date().toISOString().split('T')[0]),
      category: ann.category || 'Other',
      title:    ann.title || ann.description || ann.summary || 'Announcement',
      summary:  ann.summary || ann.description || '',
    }))
  }, [rawItems])

  // ── Client-side filter (search + category) ────────────────────────────────
  const filteredAnnouncements = useMemo(() => {
    return displayAnnouncements.filter((ann) => {
      const matchCat    = activeCategory === 'All' || ann.category === activeCategory
      const matchSearch =
        (ann.company || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ann.title   || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ann.summary || '').toLowerCase().includes(searchQuery.toLowerCase())
      return matchCat && matchSearch
    })
  }, [displayAnnouncements, activeCategory, searchQuery])

  // ── Group by date ──────────────────────────────────────────────────────────
  const groupedAnnouncements = useMemo(() => {
    const groups: Record<string, Announcement[]> = {}
    filteredAnnouncements.forEach((ann) => {
      if (!groups[ann.date]) groups[ann.date] = []
      groups[ann.date].push(ann)
    })
    return Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .map(date => ({ date, heading: formatDateHeading(date), items: groups[date] }))
  }, [filteredAnnouncements])

  // Category and search are both applied server-side (the fetch effect above
  // passes them to GET /api/news) precisely so this component never needs to
  // re-filter — newsItems IS the already-matching, already-ordered result set.

  // Grouped by calendar date for display only — items within each date group
  // keep the exact order they arrived in (backend published_at DESC), so
  // "latest to old" is never altered by this grouping step.
  const groupedNews = useMemo(() => {
    const groups: Record<string, any[]> = {}
    newsItems.forEach((item: any) => {
      const dateKey = (item.publishedAt || '').slice(0, 10) || 'unknown'
      if (!groups[dateKey]) groups[dateKey] = []
      groups[dateKey].push(item)
    })
    return Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .map(date => ({ date, heading: formatDateHeading(date), items: groups[date] }))
  }, [newsItems])

  // ── Upcoming results calendar ─────────────────────────────────────────────
  const upcomingResultsList = useMemo(() => {
    if (!resultsCalendar || !Array.isArray(resultsCalendar)) return []
    const dayNames   = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    const today = new Date()
    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(today)
      d.setDate(today.getDate() + i)
      const dateStr  = d.toISOString().split('T')[0]
      const dayItems = resultsCalendar
        .filter((item: any) => (item.expected_result_date || item.date) === dateStr)
        .map((item: any) => item.company_name || item.name || item.symbol)
        .slice(0, 2)
      return { day: dayNames[d.getDay()], date: `${monthNames[d.getMonth()]} ${d.getDate()}`, items: dayItems }
    })
  }, [resultsCalendar])

  const displayResults = upcomingResultsList.some(d => d.items.length > 0) ? upcomingResultsList : UPCOMING_RESULTS

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleTabChange = (tab: 'news' | 'announcements' | 'alerts') => {
    const p = new URLSearchParams(searchParams)
    tab === 'news' ? p.delete('tab') : p.set('tab', tab)
    setSearchParams(p)
  }

  const handleSeverityChange = (sev: string) => {
    const p = new URLSearchParams(searchParams)
    sev === 'All' ? p.delete('sev') : p.set('sev', sev)
    setSearchParams(p)
    setAlertPage(1)
  }

  const handleDismissAlert = (alertId: string) => {
    // Optimistic — this list only ever shows non-dismissed alerts (the
    // default includeDismissed=false), so dismissing removes it from view
    // immediately rather than waiting on a refetch.
    setAlertItems(items => items.filter(a => a.id !== alertId))
    setAlertTotal(t => Math.max(0, t - 1))
    butterflyApi.dismiss(alertId).catch(() => {
      // Best-effort — a failed dismiss just means it reappears on next load,
      // which is a safe failure mode (nothing destructive was assumed).
    })
  }

  const handleCategoryChange = (cat: string) => {
    const p = new URLSearchParams(searchParams)
    cat === 'All' ? p.delete('category') : p.set('category', cat)
    setSearchParams(p)
  }

  const handleNewsCategoryChange = (cat: string) => {
    const p = new URLSearchParams(searchParams)
    cat === 'All' ? p.delete('ncat') : p.set('ncat', cat)
    setSearchParams(p)
    setNewsPage(1)
  }

  const handleSearchChange = (val: string) => {
    const p = new URLSearchParams(searchParams)
    val ? p.set('q', val) : p.delete('q')
    setSearchParams(p)
  }

  const handleRetry = () => dispatch(fetchAnnouncementsStart({ page, limit }))
  const refetchNews = () => {
    setNewsLoading(true)
    setNewsError(null)
    finscreenApi
      .fetchNews({
        page: newsPage,
        limit: newsLimit,
        ...(activeNewsCategory !== 'All' ? { category: activeNewsCategory } : {}),
        ...(searchQuery ? { q: searchQuery } : {}),
      })
      .then((res: any) => {
        setNewsItems(Array.isArray(res?.data) ? res.data : [])
        setNewsTotal(typeof res?.total === 'number' ? res.total : 0)
        setNewsStale(Boolean(res?.stale))
        setNewsNewestAt(res?.newestPublishedAt ?? null)
      })
      .catch((err: any) => setNewsError(err?.message || 'Failed to load news'))
      .finally(() => setNewsLoading(false))
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background font-sans select-none">

      {/* Page Header */}
      <div className="sticky top-0 z-20 bg-surface border-b border-border/40 px-6 py-4 flex-shrink-0">
        <div className="max-w-[1400px] mx-auto">
          <div className="text-xs text-textSecondary/70 mb-1.5 flex items-center gap-1">
            <Link to="/" className="hover:text-accent transition-colors">Home</Link>
            <ChevronRight className="size-3" />
            <span className="text-accent font-medium">Feed</span>
          </div>
          <Heading level={1} variant="pageTitle" className="text-textPrimary">
            Market Feed
          </Heading>
          <p className="text-body text-textSecondary mt-1">
            Real-time feed of company announcements, corporate filings, and market news.
          </p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="max-w-[1400px] mx-auto px-6 py-6 select-none">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">

          {/* ── Left Column: News / Announcements list & controls ─────────── */}
          <div className="space-y-4">

            {/* Tab switcher — News (news_items, real ingested articles) is the
                default; Announcements (FinEdge corp-announcements, regulatory
                filings) is a distinct real data type kept on its own tab so
                the two are never visually blended into one list. */}
            <div className="flex items-center gap-1 bg-surfaceMuted p-1 rounded-lg border border-border/60 text-xs font-semibold text-textSecondary w-fit select-none">
              <button
                onClick={() => handleTabChange('news')}
                className={`px-3.5 py-1.5 rounded-md transition-all cursor-pointer ${activeTab === 'news' ? 'bg-surface text-accent shadow-xs' : 'hover:text-textPrimary'}`}
              >
                News
              </button>
              <button
                onClick={() => handleTabChange('announcements')}
                className={`px-3.5 py-1.5 rounded-md transition-all cursor-pointer ${activeTab === 'announcements' ? 'bg-surface text-accent shadow-xs' : 'hover:text-textPrimary'}`}
              >
                Announcements
              </button>
              <button
                onClick={() => handleTabChange('alerts')}
                className={`px-3.5 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${activeTab === 'alerts' ? 'bg-surface text-accent shadow-xs' : 'hover:text-textPrimary'}`}
              >
                <BellRing className="size-3.5" />
                Alerts
              </button>
            </div>

            {/* Severity filter — Alerts tab only, keyed to the same
                RED/ORANGE/YELLOW severities butterfly_scorer.py assigns. */}
            {activeTab === 'alerts' && isAuthenticated && (
              <div className="flex items-center gap-1.5 bg-surface border border-border/40 p-4 rounded-xl shadow-xs">
                {ALERT_SEVERITIES.map(sev => (
                  <button
                    key={sev}
                    onClick={() => handleSeverityChange(sev)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                      activeSeverity === sev
                        ? sev === 'All'
                          ? 'bg-accent border-accent text-white shadow-sm'
                          : `${SEVERITY_STYLES[sev].bg} ${SEVERITY_STYLES[sev].border} ${SEVERITY_STYLES[sev].text} shadow-sm`
                        : 'bg-background border-border/60 hover:bg-surfaceMuted/65 text-textSecondary'
                    }`}
                  >
                    {sev !== 'All' && <span className={`size-1.5 rounded-full ${SEVERITY_STYLES[sev].dot}`} />}
                    {sev === 'All' ? 'All' : sev.charAt(0) + sev.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            )}

            {/* Filter controls */}
            {activeTab !== 'alerts' && (
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-surface border border-border/40 p-4 rounded-xl shadow-xs">
              <div className="flex overflow-x-auto scrollbar-hide gap-1.5 w-full sm:w-auto -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
                {(activeTab === 'news' ? NEWS_CATEGORIES : CATEGORIES).map(cat => (
                  <button
                    key={cat}
                    onClick={() => activeTab === 'news' ? handleNewsCategoryChange(cat) : handleCategoryChange(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer shrink-0 ${
                      (activeTab === 'news' ? activeNewsCategory : activeCategory) === cat
                        ? 'bg-accent border-accent text-white shadow-sm'
                        : 'bg-background border-border/60 hover:bg-surfaceMuted/65 text-textSecondary'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                {/* Density Toggle */}
                <div className="hidden md:flex items-center gap-1 bg-surfaceMuted p-1 rounded-lg border border-border/60 text-xs font-semibold text-textSecondary select-none">
                  <button
                    onClick={() => setDensity('comfortable')}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${density === 'comfortable' ? 'bg-surface text-accent shadow-xs' : 'hover:text-textPrimary'}`}
                  >
                    Comfortable
                  </button>
                  <button
                    onClick={() => setDensity('compact')}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${density === 'compact' ? 'bg-surface text-accent shadow-xs' : 'hover:text-textPrimary'}`}
                  >
                    Compact
                  </button>
                </div>

                {/* Search */}
                <div className="relative w-full sm:w-64">
                  <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-textSecondary" />
                  <input
                    type="text"
                    placeholder="Search feed..."
                    value={searchQuery}
                    onChange={e => handleSearchChange(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-xs border border-border/60 focus:border-accent rounded-lg bg-background text-textPrimary outline-none transition-colors"
                  />
                </div>
              </div>
            </div>
            )}

            {/* Active search banner */}
            {activeTab !== 'alerts' && (searchQuery || activeCategory !== 'All') && (
              <div className="bg-surface border border-border/40 px-5 py-3 rounded-xl flex items-center justify-between text-xs text-textSecondary shadow-xs animate-[fadeIn_0.15s_ease-out]">
                <span>Active filter: <span className="font-semibold text-textPrimary">"{searchQuery || activeCategory}"</span></span>
                <Link
                  to={`/market-pulse/queries/new?query=${encodeURIComponent(searchQuery || activeCategory)}`}
                  className="text-accent font-semibold hover:underline outline-ring/45 focus-visible:outline decoration-none"
                >
                  Create search filter
                </Link>
              </div>
            )}

            {activeTab === 'news' ? (
              /* ── News card — mirrors news_items exactly: newest to oldest,
                  straight from the DB, every headline links to its real
                  source article so the primary source is always one click
                  away. ──────────────────────────────────────────────────── */
              <div className="bg-surface border border-border/40 rounded-xl overflow-hidden shadow-xs">

                {!newsLoading && !newsError && newsStale && newsItems.length > 0 && (
                  <div className="px-5 py-2.5 bg-amber-500/10 border-b border-amber-500/20 text-[12px] text-amber-700 dark:text-amber-400 font-medium">
                    Nothing published in the last few days — showing the most recent stories available
                    {newsNewestAt ? ` (newest: ${new Date(newsNewestAt).toLocaleString()})` : ''}.
                  </div>
                )}

                {newsError ? (
                  <div className="p-6">
                    <InlineError message={newsError} onRetry={refetchNews} />
                  </div>
                ) : newsLoading ? (
                  <div className="p-4">
                    <FeedCardSkeleton count={3} />
                  </div>
                ) : newsItems.length === 0 ? (
                  <Empty className="py-12 border-0">
                    <EmptyHeader>
                      <EmptyMedia variant="icon"><Inbox className="size-6 text-textMuted" /></EmptyMedia>
                      <EmptyTitle className="text-textPrimary font-semibold">No news for this selection</EmptyTitle>
                      <EmptyDescription className="text-textSecondary">
                        Try changing filters or selecting a different page.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <div className="divide-y divide-border/40 p-1">
                    {groupedNews.map((group) => (
                      <div key={group.date} className="p-3 space-y-2">
                        <Heading level={3} className="text-xs font-semibold text-textSecondary uppercase tracking-widest px-1 pt-1">
                          {group.heading}
                        </Heading>
                        <Card className="border-border/40 bg-surface shadow-xs rounded-xl overflow-hidden divide-y divide-border/40">
                          {group.items.map((item: any) => (
                            <div key={item.id} className="p-4 flex flex-col gap-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <span
                                  style={{ color: item.categoryColor || 'var(--fs-brand)' }}
                                  className="text-[11px] font-semibold uppercase tracking-wider leading-none"
                                >
                                  {item.category}
                                </span>
                                {item.symbols?.length > 0 && (
                                  <div className="flex gap-1 flex-wrap justify-end">
                                    {item.symbols.slice(0, 3).map((sym: string) => (
                                      <span key={sym} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-surfaceMuted text-textSecondary border border-border/40">
                                        {sym}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-body font-semibold leading-snug text-textPrimary hover:text-accent transition-colors"
                              >
                                {item.headline}
                              </a>
                              {item.summary && (
                                <p className="text-sm text-textSecondary leading-snug">{item.summary}</p>
                              )}
                              <span className="text-[12px] text-textMuted font-medium flex items-center gap-1">
                                {item.time} · {item.source}
                                <ExternalLink className="size-3 opacity-60" />
                              </span>
                            </div>
                          ))}
                        </Card>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Pagination bar ──────────────────────────────────────── */}
                {!newsLoading && !newsError && newsTotal > 0 && (
                  <PaginationBar
                    total={newsTotal}
                    page={newsPage}
                    limit={newsLimit}
                    onPageChange={(p) => setNewsPage(p)}
                    onLimitChange={(l) => { setNewsLimit(l); setNewsPage(1) }}
                    limitOptions={[25, 50, 100]}
                  />
                )}
              </div>
            ) : activeTab === 'announcements' ? (
              /* ── Announcements card — unchanged: FinEdge corp-announcements,
                  real regulatory filings, kept on their own tab. ──────────── */
              <div className="bg-surface border border-border/40 rounded-xl overflow-hidden shadow-xs">

                {error ? (
                  <div className="p-6">
                    <InlineError message={error} onRetry={handleRetry} />
                  </div>
                ) : loading ? (
                  <div className="p-4">
                    <FeedCardSkeleton count={3} />
                  </div>
                ) : filteredAnnouncements.length === 0 ? (
                  <Empty className="py-12 border-0">
                    <EmptyHeader>
                      <EmptyMedia variant="icon"><Inbox className="size-6 text-textMuted" /></EmptyMedia>
                      <EmptyTitle className="text-textPrimary font-semibold">No announcements for this selection</EmptyTitle>
                      <EmptyDescription className="text-textSecondary">
                        Try changing filters or selecting a different page.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <div className="divide-y divide-border/40 p-1">
                    {groupedAnnouncements.map((group) => (
                      <div key={group.date} className="p-3 space-y-2">
                        <Heading level={3} className="text-xs font-semibold text-textSecondary uppercase tracking-widest px-1 pt-1">
                          {group.heading}
                        </Heading>
                        <Card className="border-border/40 bg-surface shadow-xs rounded-xl overflow-hidden divide-y divide-border/40">
                          {group.items.map((item) => (
                            <AnnouncementItem
                              key={item.id}
                              item={item}
                              density={density}
                              actionButtons={
                                <>
                                  <a
                                    href="#"
                                    onClick={(e) => e.preventDefault()}
                                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border/60 hover:bg-surfaceMuted text-[11px] font-semibold text-textPrimary transition-colors outline-ring/45 focus-visible:outline decoration-none"
                                  >
                                    <ExternalLink className="size-3.5 text-textSecondary" />
                                    View report
                                  </a>
                                  <a
                                    href="#"
                                    onClick={(e) => e.preventDefault()}
                                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border/60 hover:bg-surfaceMuted text-[11px] font-semibold text-textPrimary transition-colors outline-ring/45 focus-visible:outline decoration-none"
                                  >
                                    <Bookmark className="size-3.5 text-textSecondary" />
                                    Save for later
                                  </a>
                                  <Link
                                    to={`/market-pulse/queries/new?query=${encodeURIComponent(item.category)}`}
                                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border/60 hover:bg-surfaceMuted text-[11px] font-semibold text-textPrimary transition-colors outline-ring/45 focus-visible:outline decoration-none"
                                  >
                                    <Search className="size-3.5 text-textSecondary" />
                                    Create search filter
                                  </Link>
                                </>
                              }
                            />
                          ))}
                        </Card>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Pagination bar ────────────────────────────────────────── */}
                {!loading && !error && total > 0 && (
                  <PaginationBar
                    total={total}
                    page={page}
                    limit={limit}
                    onPageChange={(p) => dispatch(fetchAnnouncementsStart({ page: p, limit }))}
                    onLimitChange={(l) => dispatch(fetchAnnouncementsStart({ page: 1, limit: l }))}
                    limitOptions={[25, 50, 100]}
                  />
                )}
              </div>
            ) : (
              /* ── Alerts card — backend/routers/butterfly.py's /api/butterfly/alerts.
                  The only place in this app a news item is colored RED/ORANGE/YELLOW:
                  every row here is a real, scored user_news_alerts write from the
                  Butterfly Effect workflow — never a UI heuristic. ───────────────── */
              <div className="bg-surface border border-border/40 rounded-xl overflow-hidden shadow-xs">
                {!isAuthenticated ? (
                  <Empty className="py-12 border-0">
                    <EmptyHeader>
                      <EmptyMedia variant="icon"><LogIn className="size-6 text-textMuted" /></EmptyMedia>
                      <EmptyTitle className="text-textPrimary font-semibold">Log in to see your alerts</EmptyTitle>
                      <EmptyDescription className="text-textSecondary">
                        Alerts are scored against your own portfolio, so they're only available signed in.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : alertError ? (
                  <div className="p-6">
                    <InlineError message={alertError} onRetry={() => setAlertPage(p => p)} />
                  </div>
                ) : alertLoading ? (
                  <div className="p-4">
                    <FeedCardSkeleton count={3} />
                  </div>
                ) : alertItems.length === 0 ? (
                  <Empty className="py-12 border-0">
                    <EmptyHeader>
                      <EmptyMedia variant="icon"><BellRing className="size-6 text-textMuted" /></EmptyMedia>
                      <EmptyTitle className="text-textPrimary font-semibold">No alerts for this selection</EmptyTitle>
                      <EmptyDescription className="text-textSecondary">
                        Nothing in your portfolio has scored high enough for an alert yet — or try a different severity filter.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <div className="divide-y divide-border/40 p-1">
                    {alertItems.map((alert) => {
                      const sv = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.YELLOW
                      return (
                        <div
                          key={alert.id}
                          className={`m-2 p-4 rounded-xl border ${sv.border} ${sv.bg} flex flex-col gap-1.5`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${sv.text} ${sv.bg} border ${sv.border}`}>
                                {alert.severity}
                              </span>
                              <span className="text-body font-semibold text-textPrimary">{alert.symbol}</span>
                              {alert.companyName && (
                                <span className="text-sm text-textSecondary">{alert.companyName}</span>
                              )}
                            </div>
                            <button
                              onClick={() => handleDismissAlert(alert.id)}
                              className="text-textMuted hover:text-textPrimary transition-colors cursor-pointer p-1 -m-1 rounded"
                              title="Dismiss"
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>
                          <p className="text-sm text-textPrimary leading-snug">{alert.explanation}</p>
                          {alert.news && (
                            <a
                              href={alert.news.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium text-accent hover:underline leading-snug flex items-center gap-1 w-fit"
                            >
                              {alert.news.title}
                              <ExternalLink className="size-3 opacity-60" />
                            </a>
                          )}
                          <span className="text-[12px] text-textMuted font-medium">
                            {alert.news?.sourceName ?? 'Unknown source'} · score {alert.score?.toFixed(2) ?? '—'}
                            {typeof alert.exposurePct === 'number' && alert.exposurePct > 0
                              ? ` · ${(alert.exposurePct * 100).toFixed(1)}% of portfolio`
                              : ''}
                            {' · '}{new Date(alert.createdAt).toLocaleString()}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {isAuthenticated && !alertLoading && !alertError && alertTotal > 0 && (
                  <PaginationBar
                    total={alertTotal}
                    page={alertPage}
                    limit={alertLimit}
                    onPageChange={(p) => setAlertPage(p)}
                    onLimitChange={() => {}}
                    limitOptions={[alertLimit]}
                  />
                )}
              </div>
            )}
          </div>

          {/* ── Right Column: Sidebar Widgets ──────────────────────────────── */}
          <div className="space-y-6 lg:sticky lg:top-[128px]">

            {/* Widget 1: Financial News */}
            <Card className="border-border/40 bg-surface shadow-xs rounded-xl overflow-hidden">
              <CardHeader className="border-b border-border/40 bg-surfaceMuted/20 px-5 py-4">
                <CardTitle className="text-xs font-semibold text-textSecondary uppercase tracking-wider flex items-center gap-1.5">
                  <Newspaper className="size-4 text-accent animate-pulse" />
                  Financial News
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 py-2 divide-y divide-border/40">
                {liveNews.length > 0 ? liveNews.map((news: any) => (
                  <div key={news.id || news.headline} className="py-3 flex flex-col gap-1">
                    <span style={{ color: news.categoryColor || 'var(--fs-brand)' }} className="text-[11px] font-semibold uppercase tracking-wider leading-none">
                      {news.category}
                    </span>
                    <Text variant="body" className="font-semibold leading-snug text-textPrimary">
                      {news.headline}
                    </Text>
                    <span className="text-[12px] text-textMuted font-medium">
                      {news.time} · {news.source || 'FinEdge'}
                    </span>
                  </div>
                )) : sidebarLoading ? (
                  <div className="space-y-3 py-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-12 bg-surfaceMuted/60 rounded animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <p className="py-4 text-xs text-textMuted">No news available right now.</p>
                )}
              </CardContent>
            </Card>

            {/* Widget 2: Upcoming Results */}
            <Card className="border-border/40 bg-surface shadow-xs rounded-xl overflow-hidden">
              <CardHeader className="border-b border-border/40 bg-surfaceMuted/20 px-5 py-4">
                <CardTitle className="text-xs font-semibold text-textSecondary uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="size-4 text-accent" />
                  Upcoming Results
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 py-3 divide-y divide-border/40">
                {displayResults.map((day) => (
                  <div key={day.date} className="py-2.5 flex items-center justify-between gap-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-textPrimary">{day.day}</span>
                      <span className="text-[11px] text-textMuted font-medium">{day.date}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 justify-end max-w-[180px]">
                      {day.items.length > 0 ? (
                        day.items.map((item: any) => {
                          const label   = typeof item === 'string' ? item : (item.name || item.symbol || '')
                          const itemKey = typeof item === 'string' ? item : (item.symbol || item.name || Math.random().toString())
                          return (
                            <span key={itemKey} className="bg-surfaceMuted text-textSecondary text-[11px] font-medium px-2 py-0.5 rounded border border-border/40">
                              {label}
                            </span>
                          )
                        })
                      ) : (
                        <span className="text-xs text-textMuted italic">No major results</span>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

          </div>
        </div>
      </div>
      
      <AppFooter />
    </div>
  )
}

export default Feed
