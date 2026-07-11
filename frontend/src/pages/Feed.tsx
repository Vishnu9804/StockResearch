import { useMemo, useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Heading } from '@/components/ui/Heading'
import { Text } from '@/components/ui/Text'
import finscreenApi from '@/services/finscreenApi'
import { AppFooter } from '@/components/shared/AppFooter'
import { ChevronRight, FileText, Calendar, Newspaper, ExternalLink, Bookmark, Search, Inbox } from 'lucide-react'
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

  // Sidebar state (still fetched locally — not paginated)
  const [resultsCalendar, setResultsCalendar] = useState<any[]>([])
  const [liveNews, setLiveNews]               = useState<any[]>([])
  const [sidebarLoading, setSidebarLoading]   = useState(true)

  // Density preference
  const [density, setDensity] = useLocalStorage<'comfortable' | 'compact'>('announcements_density', 'comfortable')

  // ── Redux state ────────────────────────────────────────────────────────────
  const { items: rawItems, total, page, limit, status, error } =
    useSelector((s: RootState) => s.marketPulse.announcements)

  const loading = status === 'loading' || status === 'idle'

  // ── Dispatch on mount and on page / limit change ──────────────────────────
  useEffect(() => {
    dispatch(fetchAnnouncementsStart({ page, limit }))
  }, [dispatch, page, limit])

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
  const handleCategoryChange = (cat: string) => {
    const p = new URLSearchParams(searchParams)
    cat === 'All' ? p.delete('category') : p.set('category', cat)
    setSearchParams(p)
  }

  const handleSearchChange = (val: string) => {
    const p = new URLSearchParams(searchParams)
    val ? p.set('q', val) : p.delete('q')
    setSearchParams(p)
  }

  const handleRetry = () => dispatch(fetchAnnouncementsStart({ page, limit }))

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

          {/* ── Left Column: Announcements list & controls ───────────────── */}
          <div className="space-y-4">

            {/* Filter controls */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-surface border border-border/40 p-4 rounded-xl shadow-xs">
              <div className="flex overflow-x-auto scrollbar-hide gap-1.5 w-full sm:w-auto -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => handleCategoryChange(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer shrink-0 ${
                      activeCategory === cat
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

            {/* Active search banner */}
            {(searchQuery || activeCategory !== 'All') && (
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

            {/* ── Announcements card ─────────────────────────────────────── */}
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
