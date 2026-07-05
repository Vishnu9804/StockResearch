import { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronRight, Search, Inbox } from 'lucide-react'
import type { Announcement } from '@/lib/data/market-pulse'
import { AppFooter } from '@/components/shared/AppFooter'
import { Heading } from '@/components/ui/Heading'
import { TableRowsSkeleton } from '@/components/ui/SkeletonLoader'
import { InlineError } from '@/components/ui/InlineError'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { AnnouncementItem } from '@/components/shared/AnnouncementItem'
import finscreenApi from '@/services/finscreenApi'
import { companies } from '@/lib/data/companies'

const CATEGORIES = ['All', 'Board Meeting', 'Concall', 'Annual Report', 'Dividend', 'Merger', 'Capacity', 'Resignation', 'Award', 'Results', 'Other']

function extractCompanyName(ann: any): string {
  const symbol = ann.stock_symbol || ann.nse_code || ann.symbol || ''
  // Try description extraction FIRST — FinEdge always has company name in description
  if (ann.description && typeof ann.description === 'string') {
    const match = ann.description.match(/^([A-Za-z0-9][A-Za-z0-9\s&()',.\-]{2,60}?(?:Limited|Ltd\.|Ltd|Corporation|Industries|Enterprises|Finance|Bank|Technologies|Services|Solutions|Holdings|Investments))\s+has\b/i)
    if (match && match[1]) return match[1].trim()
  }
  const localComp = companies.find(c => c.symbol === symbol.toUpperCase())
  return ann.company_name || ann.company || localComp?.name || (/^\d+$/.test(symbol) ? '' : symbol) || 'Unknown Company'
}

export default function Announcements() {
  const [searchParams, setSearchParams] = useSearchParams()
  const category = searchParams.get('category') ?? 'All'
  const search = searchParams.get('q') ?? ''

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [liveAnnouncements, setLiveAnnouncements] = useState<any[]>([])
  
  // Local storage persisted density state
  const [density, setDensity] = useLocalStorage<'comfortable' | 'compact'>('announcements_density', 'comfortable')

  async function loadAnnouncements() {
    try {
      setLoading(true)
      setError(null)
      const now = new Date()
      const pastDate = new Date(now)
      pastDate.setDate(pastDate.getDate() - 14)
      const data = await finscreenApi.fetchMarketAnnouncements({
        from_date: pastDate.toISOString().split('T')[0],
        to_date: now.toISOString().split('T')[0]
      })
      setLiveAnnouncements(data || [])
    } catch (err: any) {
      setError('Failed to load announcements. Please retry.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const mockError = searchParams.get('error') === 'true'
    if (mockError) {
      setError('Failed to load announcements. Please retry.')
      setLoading(false)
    } else {
      loadAnnouncements()
    }
  }, [])

  const handleRetry = () => {
    const newParams = new URLSearchParams(searchParams)
    newParams.delete('error')
    setSearchParams(newParams)
    loadAnnouncements()
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

  const handleCategoryChange = (cat: string) => {
    const newParams = new URLSearchParams(searchParams)
    newParams.set('category', cat)
    setSearchParams(newParams)
  }

  // Map live announcements to Announcement type
  const displayAnnouncements = useMemo((): Announcement[] => {
    if (liveAnnouncements.length > 0) {
      return liveAnnouncements.map((ann: any) => ({
        id: String(ann.id || Math.random()),
        company: extractCompanyName(ann),
        symbol: ann.stock_symbol || ann.nse_code || ann.symbol || '',
        date: ann.date || (ann.announcement_date ? ann.announcement_date.split(' ')[0] : new Date().toISOString().split('T')[0]),
        category: ann.category || 'Other',
        title: ann.title || ann.description || ann.summary || 'Announcement',
        summary: ann.summary || ann.description || ''
      }))
    }
    return []
  }, [liveAnnouncements])

  const filtered = useMemo(() => {
    return displayAnnouncements.filter((ann: Announcement) => {
      const matchesSearch =
        ann.company.toLowerCase().includes(search.toLowerCase()) ||
        ann.title.toLowerCase().includes(search.toLowerCase()) ||
        ann.summary.toLowerCase().includes(search.toLowerCase())
      const matchesCategory = category === 'All' || ann.category === category
      return matchesSearch && matchesCategory
    })
  }, [displayAnnouncements, search, category])


  return (
    <div className="min-h-screen bg-background font-sans select-none">
      <div className="max-w-[1200px] mx-auto px-6 py-6 select-none">
        
        {/* Breadcrumb */}
        <div className="text-xs text-textSecondary/70 mb-2 flex items-center gap-1.5">
          <Link to="/" className="hover:text-accent transition-colors">Dashboard</Link>
          <ChevronRight className="size-3" />
          <Link to="/market-pulse" className="hover:text-accent transition-colors">Market Pulse</Link>
          <ChevronRight className="size-3" />
          <span className="text-accent font-medium">Announcements</span>
        </div>

        {/* Page Title */}
        <Heading level={1} variant="pageTitle" className="text-textPrimary mb-6">
          Announcements
        </Heading>

        {error ? (
          <InlineError message={error} onRetry={handleRetry} className="mb-8" />
        ) : (
          /* Two-column responsive grid */
          <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 items-start">
            {/* LEFT: Announcements card */}
            <div className="lg:col-span-7 bg-surface border border-border/40 rounded-xl overflow-hidden shadow-xs">
              {/* Search bar */}
              <div className="p-4 border-b border-border/40">
                <div className="relative">
                  <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-textSecondary" />
                  <input
                    type="text"
                    placeholder="Search announcements..."
                    value={search}
                    onChange={e => handleSearchChange(e.target.value)}
                    className="w-full box-border pl-9 pr-4 py-2 text-sm border border-border/60 focus:border-accent rounded-lg bg-background text-textPrimary outline-none transition-colors"
                  />
                </div>
                {/* Subtle create search filter link */}
                {(search || category !== 'All') && (
                  <div className="mt-2 text-xs text-textSecondary flex justify-between items-center bg-surfaceMuted/15 border border-border/30 rounded-lg px-2.5 py-1.5 animate-[fadeIn_0.15s_ease-out]">
                    <span>Active filter: <span className="font-semibold text-textPrimary">"{search || category}"</span></span>
                    <Link
                      to={`/market-pulse/queries/new?query=${encodeURIComponent(search || category)}`}
                      className="text-accent font-semibold hover:underline outline-ring/45 focus-visible:outline decoration-none"
                    >
                      Create search filter
                    </Link>
                  </div>
                )}

                {/* Horizontal Category Chips and Density controls */}
                <div className="mt-3.5 flex items-center justify-between gap-3 flex-wrap border-t border-border/20 pt-3">
                  <div className="flex overflow-x-auto scrollbar-hide gap-1.5 w-full sm:w-auto -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
                    {['All', 'Results', 'Dividend', 'Concall', 'Annual Report', 'Merger'].map(cat => (
                      <button
                        key={cat}
                        onClick={() => handleCategoryChange(cat)}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-all cursor-pointer shrink-0 ${
                          category === cat
                            ? 'bg-accent border-accent text-white shadow-xs'
                            : 'bg-background border-border/60 hover:bg-surfaceMuted text-textSecondary'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  
                  {/* Density toggle (desktop only) */}
                  <div className="hidden md:flex items-center gap-1 bg-surfaceMuted p-1 rounded-lg border border-border/60 text-[11px] font-semibold text-textSecondary select-none">
                    <button
                      onClick={() => setDensity('comfortable')}
                      className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                        density === 'comfortable'
                          ? 'bg-surface text-accent shadow-xs'
                          : 'hover:text-textPrimary'
                      }`}
                    >
                      Comfortable
                    </button>
                    <button
                      onClick={() => setDensity('compact')}
                      className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                        density === 'compact'
                          ? 'bg-surface text-accent shadow-xs'
                          : 'hover:text-textPrimary'
                      }`}
                    >
                      Compact
                    </button>
                  </div>
                </div>
              </div>

              {/* Announcement list */}
              {loading ? (
                <TableRowsSkeleton rows={8} cols={4} />
              ) : filtered.length === 0 ? (
                <Empty className="py-12 border-0">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Inbox className="size-6 text-textMuted" />
                    </EmptyMedia>
                    <EmptyTitle className="text-textPrimary font-semibold">No announcements match the current filters</EmptyTitle>
                    <EmptyDescription className="text-textSecondary">
                      Try resetting the search query or selecting a different category filter.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="divide-y divide-border/40 animate-[fadeInUp_0.18s_ease-out]">
                  {filtered.map((ann: Announcement) => (
                    <AnnouncementItem
                      key={ann.id}
                      item={ann}
                      density={density}
                    />
                  ))}
                </div>
              )}

              {/* Count */}
              {!loading && (
                <div className="px-4 py-3 text-xs text-textMuted border-t border-border/40 bg-surfaceMuted/10">
                  Showing {filtered.length} announcements
                </div>
              )}
            </div>

            {/* RIGHT: Filter sidebar */}
            <div className="lg:col-span-3 bg-surface border border-border/40 rounded-xl overflow-hidden shadow-xs lg:sticky lg:top-6">
              <div className="p-4 border-b border-border/40 bg-surfaceMuted/20">
                <span className="text-sm font-semibold text-textPrimary">Filter</span>
              </div>
              <div className="p-4">
                <div className="text-xs font-semibold text-textSecondary uppercase tracking-wider mb-3">
                  Category
                </div>
                <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto pr-1">
                  {CATEGORIES.map(cat => (
                    <label
                      key={cat}
                      className="flex items-center gap-2 py-1 px-1.5 rounded hover:bg-surfaceMuted/40 cursor-pointer text-sm text-textPrimary select-none"
                    >
                      <input
                        type="checkbox"
                        checked={category === cat}
                        onChange={() => handleCategoryChange(cat)}
                        className="accent-accent cursor-pointer size-3.5 outline-ring/45 focus-visible:outline"
                      />
                      <span>{cat}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="p-4 border-t border-border/40 bg-surfaceMuted/10">
                <Link
                  to="/market-pulse/queries/new"
                  className="text-xs font-semibold text-accent hover:underline decoration-none block outline-ring/45 focus-visible:outline"
                >
                  Advanced Query Search →
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
      <AppFooter />
    </div>
  )
}
