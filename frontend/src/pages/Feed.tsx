import { useMemo, useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Heading } from '@/components/ui/Heading'
import { Text } from '@/components/ui/Text'
import { announcements, type Announcement } from '@/lib/data/market-pulse'
import finscreenApi from '@/services/finscreenApi'
import { AppFooter } from '@/components/shared/AppFooter'
import { ChevronRight, FileText, Calendar, Newspaper, ExternalLink, Bookmark, Search, Inbox } from 'lucide-react'
import { FeedCardSkeleton } from '@/components/ui/SkeletonLoader'
import { InlineError } from '@/components/ui/InlineError'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { AnnouncementItem } from '@/components/shared/AnnouncementItem'

const CATEGORY_STYLES: Record<string, { bg: string; text: string }> = {
  'Board Meeting': { bg: 'var(--fs-info-soft)', text: 'var(--fs-brand)' },
  'Concall':       { bg: 'var(--fs-positive-soft)', text: 'var(--fs-positive)' },
  'Annual Report': { bg: 'var(--fs-warning-soft)', text: 'var(--fs-warning)' },
  'Dividend':      { bg: 'var(--fs-positive-soft)', text: '#065F46' },
  'Merger':        { bg: '#FFF7ED', text: '#9A3412' },
  'Capacity':      { bg: 'var(--fs-info-soft)', text: 'var(--fs-brand)' },
  'Resignation':   { bg: '#FDF2F8', text: '#9D174D' },
  'Award':         { bg: 'var(--fs-positive-soft)', text: 'var(--fs-positive)' },
  'Results':       { bg: 'var(--fs-warning-soft)', text: '#92400E' },
  'Other':         { bg: 'var(--fs-surface-muted)', text: 'var(--fs-text-secondary)' },
}

const CATEGORIES = ['All', 'Board Meeting', 'Concall', 'Annual Report', 'Dividend', 'Results']

const FINANCIAL_NEWS = [
  { category: "ECONOMY", color: "var(--fs-brand)", headline: "RBI maintains status quo on repo rates for the 6th consecutive session", time: "14 mins ago · Reuters" },
  { category: "STOCKS", color: "var(--fs-positive)", headline: "Tata Motors reports 15% YoY jump in global sales for February", time: "42 mins ago · Bloomberg" },
  { category: "COMMODITIES", color: "var(--fs-warning)", headline: "Gold touches all-time high as USD index weakens on inflation data", time: "1 hour ago · CNBC" },
  { category: "TECH", color: "#534AB7", headline: "Zomato gets GST demand notice of ₹401 Crore; stock remains stable", time: "2 hours ago · ET" },
]

const UPCOMING_RESULTS = [
  { day: "MON", date: "Oct 14", items: [] },
  { day: "TUE", date: "Oct 15", items: ["ICICI Bank", "Axis Bank"] },
  { day: "WED", date: "Oct 16", items: ["Wipro"] },
  { day: "THU", date: "Oct 17", items: ["SBI", "Tata Motors"] },
  { day: "FRI", date: "Oct 18", items: ["Adani Ent."] },
]

function formatDateHeading(dateStr: string): string {
  if (dateStr === '2026-06-18') return 'Today'
  if (dateStr === '2026-06-17') return 'Yesterday'
  
  const parts = dateStr.split('-')
  if (parts.length === 3) {
    const year = parts[0]
    const monthIndex = parseInt(parts[1], 10) - 1
    const day = parseInt(parts[2], 10)
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    return `${months[monthIndex]} ${day}, ${year}`
  }
  return dateStr
}

export function Feed() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeCategory = searchParams.get('category') ?? 'All'
  const searchQuery = searchParams.get('q') ?? ''

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [liveAnnouncements, setLiveAnnouncements] = useState<any[]>([])
  const [resultsCalendar, setResultsCalendar] = useState<any[]>([])
  
  // Local storage persisted density state
  const [density, setDensity] = useLocalStorage<'comfortable' | 'compact'>('announcements_density', 'comfortable')

  async function loadFeedData() {
    try {
      setLoading(true)
      setError(null)
      
      const now = new Date()
      const pastDate = new Date(now)
      pastDate.setDate(pastDate.getDate() - 7)
      
      const [annData, resData] = await Promise.allSettled([
        finscreenApi.fetchMarketAnnouncements({
          from_date: pastDate.toISOString().split('T')[0],
          to_date: now.toISOString().split('T')[0]
        }),
        finscreenApi.fetchResultsCalendar()
      ])

      if (annData.status === 'fulfilled') {
        setLiveAnnouncements(annData.value || [])
      }
      if (resData.status === 'fulfilled') {
        setResultsCalendar(resData.value || [])
      }
    } catch (err: any) {
      console.error('Failed to fetch feed data:', err)
      setError('Unable to load feed announcements right now. Please retry.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const mockError = searchParams.get('error') === 'true'
    if (mockError) {
      setError('Unable to load feed announcements right now. Please retry.')
      setLoading(false)
    } else {
      loadFeedData()
    }
  }, [searchParams])

  const handleRetry = () => {
    const newParams = new URLSearchParams(searchParams)
    newParams.delete('error')
    setSearchParams(newParams)
  }

  const displayAnnouncements = useMemo(() => {
    if (liveAnnouncements.length > 0) {
      return liveAnnouncements.map((ann: any) => ({
        id: ann.id || Math.random().toString(),
        company: ann.company_name || ann.company || ann.symbol || 'Unknown Company',
        symbol: ann.symbol || '',
        date: ann.date || (ann.announcement_date ? ann.announcement_date.split(' ')[0] : new Date().toISOString().split('T')[0]),
        category: ann.category || 'Other',
        title: ann.title || ann.description || ann.summary || 'Announcement',
        summary: ann.summary || ann.description || ''
      }))
    }
    return announcements
  }, [liveAnnouncements])

  // Filter announcements based on category and search query
  const filteredAnnouncements = useMemo(() => {
    return displayAnnouncements.filter((ann) => {
      const matchesCategory = activeCategory === 'All' || ann.category === activeCategory
      const matchesSearch =
        (ann.company || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ann.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ann.summary || '').toLowerCase().includes(searchQuery.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }, [displayAnnouncements, activeCategory, searchQuery])

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
        .filter((item: any) => item.date === dateStr)
        .map((item: any) => item.company_name || item.name || item.symbol)
        .slice(0, 2)
        
      days.push({
        day: dayNames[d.getDay()],
        date: `${monthNames[d.getMonth()]} ${d.getDate()}`,
        items: dayItems
      })
    }
    return days
  }, [resultsCalendar])

  const displayResults = (upcomingResultsList.some(d => d.items.length > 0))
    ? upcomingResultsList
    : UPCOMING_RESULTS

  // Group filtered announcements by date
  const groupedAnnouncements = useMemo(() => {
    const groups: Record<string, Announcement[]> = {}
    filteredAnnouncements.forEach((ann) => {
      if (!groups[ann.date]) {
        groups[ann.date] = []
      }
      groups[ann.date].push(ann)
    })
    
    return Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .map(date => ({
        date,
        heading: formatDateHeading(date),
        items: groups[date],
      }))
  }, [filteredAnnouncements])

  const handleCategoryChange = (cat: string) => {
    const newParams = new URLSearchParams(searchParams)
    if (cat === 'All') {
      newParams.delete('category')
    } else {
      newParams.set('category', cat)
    }
    setSearchParams(newParams)
  }

  const handleSearchChange = (val: string) => {
    const newParams = new URLSearchParams(searchParams)
    if (!val) {
      newParams.delete('q')
    } else {
      newParams.set('q', val)
    }
    setSearchParams(newParams)
  }

  return (
    <div className="min-h-screen bg-background font-sans select-none">
      {/* Page Header */}
      <div className="sticky top-0 z-20 bg-surface border-b border-border/40 px-6 py-4 flex-shrink-0">
        <div className="max-w-[1400px] mx-auto">
          {/* Breadcrumb */}
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
          
          {/* Left Column: Announcements list & controls */}
          <div className="space-y-6">
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
                {/* Density Toggle Group (Desktop Only) */}
                <div className="hidden md:flex items-center gap-1 bg-surfaceMuted p-1 rounded-lg border border-border/60 text-xs font-semibold text-textSecondary select-none">
                  <button
                    onClick={() => setDensity('comfortable')}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      density === 'comfortable'
                        ? 'bg-surface text-accent shadow-xs'
                        : 'hover:text-textPrimary'
                    }`}
                  >
                    Comfortable
                  </button>
                  <button
                    onClick={() => setDensity('compact')}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      density === 'compact'
                        ? 'bg-surface text-accent shadow-xs'
                        : 'hover:text-textPrimary'
                    }`}
                  >
                    Compact
                  </button>
                </div>

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

            {/* Active search filter link banner */}
            {(searchQuery || activeCategory !== 'All') && (
              <div className="bg-surface border border-border/40 px-5 py-3 rounded-xl flex items-center justify-between text-xs text-textSecondary shadow-xs mb-4 animate-[fadeIn_0.15s_ease-out]">
                <span>Active feed search: <span className="font-semibold text-textPrimary">"{searchQuery || activeCategory}"</span></span>
                <Link
                  to={`/market-pulse/queries/new?query=${encodeURIComponent(searchQuery || activeCategory)}`}
                  className="text-accent font-semibold hover:underline outline-ring/45 focus-visible:outline decoration-none"
                >
                  Create search filter
                </Link>
              </div>
            )}

            {/* Content states */}
            {error ? (
              <InlineError message={error} onRetry={handleRetry} />
            ) : loading ? (
              <FeedCardSkeleton count={3} />
            ) : filteredAnnouncements.length === 0 ? (
              <Empty className="bg-surface border border-border/40 py-12 shadow-xs">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Inbox className="size-6 text-textMuted" />
                  </EmptyMedia>
                  <EmptyTitle className="text-textPrimary font-semibold">No announcements for this selection</EmptyTitle>
                  <EmptyDescription className="text-textSecondary">
                    Try changing your search keywords, clearing category filters, or selecting a different date range.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              groupedAnnouncements.map((group) => (
                <div key={group.date} className="space-y-3">
                  <Heading level={3} className="text-xs font-semibold text-textSecondary uppercase tracking-widest px-1">
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
              ))
            )}
          </div>

          {/* Right Column: Sidebar Widgets */}
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
                {FINANCIAL_NEWS.map((news) => (
                  <div key={news.headline} className="py-3 flex flex-col gap-1">
                    <span style={{ color: news.color }} className="text-[11px] font-semibold uppercase tracking-wider leading-none">
                      {news.category}
                    </span>
                    <Text variant="body" className="font-semibold leading-snug text-textPrimary">
                      {news.headline}
                    </Text>
                    <span className="text-[12px] text-textMuted font-medium">
                      {news.time}
                    </span>
                  </div>
                ))}
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
                          const label = typeof item === 'string' ? item : (item.name || item.symbol || '')
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
