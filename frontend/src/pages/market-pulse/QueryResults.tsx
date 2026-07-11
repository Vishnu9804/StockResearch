/**
 * Query Results — /market-pulse/queries/results?query=...
 * Shows announcements filtered by the query parameter.
 */
import { useMemo, useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { ChevronRight, Search, Inbox } from 'lucide-react'
import { announcements } from '@/lib/data/market-pulse'
import { finscreenApi } from '@/services/finscreenApi'
import { AppFooter } from '@/components/shared/AppFooter'
import { Heading } from '@/components/ui/Heading'
import { Button } from '@/components/ui/button'
import { FeedCardSkeleton } from '@/components/ui/SkeletonLoader'
import { InlineError } from '@/components/ui/InlineError'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import { useAppSelector } from '@/store/hooks'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { AnnouncementItem } from '@/components/shared/AnnouncementItem'
import { PaginationBar } from '@/components/ui/PaginationBar'

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  'Board Meeting': { bg: 'var(--fs-info-soft)', text: 'var(--fs-info)' },
  'Concall':       { bg: 'var(--fs-positive-soft)', text: 'var(--fs-positive)' },
  'Annual Report': { bg: 'var(--fs-warning-soft)', text: 'var(--fs-warning)' },
  'Dividend':      { bg: 'var(--fs-positive-soft)', text: 'var(--fs-positive)' },
  'Merger':        { bg: 'var(--fs-accent-soft)', text: 'var(--fs-accent)' },
  'Capacity':      { bg: 'var(--fs-accent-soft)', text: 'var(--fs-accent)' },
  'Resignation':   { bg: 'var(--fs-negative-soft)', text: 'var(--fs-negative)' },
  'Award':         { bg: 'var(--fs-positive-soft)', text: 'var(--fs-positive)' },
  'Results':       { bg: 'var(--fs-warning-soft)', text: 'var(--fs-warning)' },
  'Other':         { bg: 'var(--fs-surface-muted)', text: 'var(--fs-text-secondary)' },
}

export function QueryResults() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const query = searchParams.get('query') ?? ''

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refinement, setRefinement] = useState<'all' | 'results' | 'concalls' | 'watchlist'>('all')
  const [liveAnnouncements, setLiveAnnouncements] = useState<any[]>([])

  // Local storage persisted density state
  const [density, setDensity] = useLocalStorage<'comfortable' | 'compact'>('announcements_density', 'comfortable')

  // Pagination local state
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(15)

  // Redux watchlist state
  const watchlists = useAppSelector((state) => state.watchlist?.watchlists || [])
  const activeWatchlistId = useAppSelector((state) => state.watchlist?.activeWatchlistId)
  const activeWatchlist = useMemo(() => {
    return watchlists.find(wl => wl.id === activeWatchlistId)
  }, [watchlists, activeWatchlistId])
  const watchlistSymbols = useMemo(() => {
    return activeWatchlist?.items.map(item => item.symbol.toUpperCase()) || []
  }, [activeWatchlist])

  const loadAnnouncements = async (showError = false) => {
    setLoading(true)
    setError(null)
    if (showError) {
      setError('Failed to execute query search. Please retry.')
      setLoading(false)
      return
    }

    try {
      const now = new Date()
      const pastDate = new Date(now)
      pastDate.setDate(pastDate.getDate() - 30) // last 30 days
      const res = await finscreenApi.fetchMarketAnnouncements({
        from_date: pastDate.toISOString().split('T')[0],
        to_date: now.toISOString().split('T')[0]
      })
      setLiveAnnouncements(Array.isArray(res) ? res : [])
    } catch (err) {
      console.error('Failed to load announcements for query results:', err)
      // will fall back to static announcements data
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const mockError = searchParams.get('error') === 'true'
    loadAnnouncements(mockError)
  }, [searchParams])

  const handleRetry = () => {
    const newParams = new URLSearchParams(searchParams)
    newParams.delete('error')
    setSearchParams(newParams)
  }

  const handleToggleRefinement = (ref: 'results' | 'concalls' | 'watchlist') => {
    setRefinement(prev => prev === ref ? 'all' : ref)
    setPage(1)
  }

  const displayAnnouncements = useMemo(() => {
    if (liveAnnouncements.length > 0) {
      return liveAnnouncements.map((ann: any) => {
        const symbol = ann.stock_symbol || ann.nse_code || ann.symbol || ''
        return {
          id: ann.id || Math.random().toString(),
          company: ann.company_name || ann.company || symbol || 'Unknown Company',
          symbol,
          date: ann.date || (ann.announcement_date ? ann.announcement_date.split(' ')[0] : new Date().toISOString().split('T')[0]),
          category: ann.category || 'Other',
          title: ann.title || ann.description || ann.summary || 'Announcement',
          summary: ann.summary || ann.description || ''
        }
      })
    }
    return announcements
  }, [liveAnnouncements])

  const filtered = useMemo(() => {
    let list = displayAnnouncements
    
    // 1. Query keyword filter
    if (query.trim()) {
      const terms = query.toLowerCase().split(/\s+OR\s+|\s+/).filter(Boolean)
      list = displayAnnouncements.filter((ann) => {
        const text = `${ann.company} ${ann.title} ${ann.summary} ${ann.category}`.toLowerCase()
        return terms.some(term => {
          const clean = term.startsWith('-') ? null : term.replace(/^"(.*)"$/, '$1')
          if (!clean) return !text.includes(term.slice(1))
          return text.includes(clean)
        })
      })
    }

    // 2. Refinement chips filter
    if (refinement === 'results') {
      list = list.filter(ann => ann.category === 'Results')
    } else if (refinement === 'concalls') {
      list = list.filter(ann => ann.category === 'Concall')
    } else if (refinement === 'watchlist') {
      list = list.filter(ann => watchlistSymbols.includes(ann.symbol.toUpperCase()))
    }

    return list
  }, [query, refinement, watchlistSymbols])

  // Reset page to 1 when query changes
  useEffect(() => {
    setPage(1)
  }, [query])

  const paginatedData = useMemo(() => {
    const start = (page - 1) * limit
    return filtered.slice(start, start + limit)
  }, [filtered, page, limit])

  return (
    <div className="min-h-screen bg-background font-sans select-none animate-[fadeInUp_0.15s_ease-out]">
      <div className="max-w-[1000px] mx-auto px-6 py-6 select-none">

        {/* Breadcrumb */}
        <div className="text-xs text-textSecondary/70 mb-2 flex items-center gap-1.5">
          <Link to="/" className="hover:text-accent transition-colors">Dashboard</Link>
          <ChevronRight className="size-3" />
          <Link to="/market-pulse" className="hover:text-accent transition-colors">Market Pulse</Link>
          <ChevronRight className="size-3" />
          <Link to="/market-pulse/queries/new" className="hover:text-accent transition-colors">Search Filter</Link>
          <ChevronRight className="size-3" />
          <span className="text-accent font-medium">Results</span>
        </div>

        {/* Header Block */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <Heading level={1} variant="pageTitle" className="text-textPrimary">
              Search Results
            </Heading>
            <p className="text-xs text-textSecondary mt-1 flex items-center gap-1">
              Query: <span className="font-semibold text-textPrimary font-mono">"{query}"</span>
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate(`/market-pulse/queries/new?query=${encodeURIComponent(query)}`)}
            className="text-xs font-bold border-border/60 hover:bg-surfaceMuted h-9 cursor-pointer"
          >
            Edit Query
          </Button>
        </div>

        {error ? (
          <InlineError message={error} onRetry={handleRetry} className="mb-8" />
        ) : loading ? (
          <FeedCardSkeleton count={3} />
        ) : filtered.length === 0 ? (
          <Empty className="bg-surface border border-border/40 py-12 shadow-xs mb-8">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Search className="size-6 text-textMuted" />
              </EmptyMedia>
              <EmptyTitle className="text-textPrimary font-semibold text-sm">No announcements match this query yet.</EmptyTitle>
              <EmptyDescription className="text-textSecondary max-w-[460px] mx-auto leading-relaxed mt-1 text-xs">
                Try broadening your query keywords, removing exclusions (using minus sign like <code className="bg-surfaceMuted px-1 py-0.5 rounded text-accent font-mono text-[11px]">-loss</code>), or clearing active refinement chips.
              </EmptyDescription>
            </EmptyHeader>
            <div className="pt-4 flex justify-center">
              <Button
                onClick={() => navigate(`/market-pulse/queries/new?query=${encodeURIComponent(query)}`)}
                className="font-bold text-xs cursor-pointer h-9 px-4 rounded-lg"
              >
                Edit Query
              </Button>
            </div>
          </Empty>
        ) : (
          <>
            {/* Refinement Chips */}
            <div className="flex flex-wrap gap-2 mb-4 items-center justify-between bg-surfaceMuted/15 border border-border/30 rounded-xl p-3">
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-[11px] font-bold text-textSecondary uppercase tracking-wider mr-1.5 select-none">
                  Refine:
                </span>
                <button
                  onClick={() => handleToggleRefinement('results')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                    refinement === 'results'
                      ? 'bg-accent border-accent text-white shadow-xs'
                      : 'bg-background border-border/60 hover:bg-surfaceMuted text-textSecondary'
                  }`}
                >
                  Only Results
                </button>
                <button
                  onClick={() => handleToggleRefinement('concalls')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                    refinement === 'concalls'
                      ? 'bg-accent border-accent text-white shadow-xs'
                      : 'bg-background border-border/60 hover:bg-surfaceMuted text-textSecondary'
                  }`}
                >
                  Only Concalls
                </button>
                <button
                  onClick={() => handleToggleRefinement('watchlist')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                    refinement === 'watchlist'
                      ? 'bg-accent border-accent text-white shadow-xs'
                      : 'bg-background border-border/60 hover:bg-surfaceMuted text-textSecondary'
                  }`}
                >
                  Only Core Watchlist
                </button>
                {refinement !== 'all' && (
                  <button
                    onClick={() => setRefinement('all')}
                    className="text-xs text-accent font-semibold hover:underline ml-1.5 cursor-pointer"
                  >
                    Clear refinements
                  </button>
                )}
              </div>
              
              <div className="flex items-center gap-3">
                {/* Density Toggle (Desktop Only) */}
                <div className="hidden md:flex items-center gap-1 bg-background p-0.5 rounded border border-border/60 text-[10px] font-semibold text-textSecondary select-none">
                  <button
                    onClick={() => setDensity('comfortable')}
                    className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                      density === 'comfortable'
                        ? 'bg-surface text-accent shadow-xs font-bold'
                        : 'hover:text-textPrimary'
                    }`}
                  >
                    Comfortable
                  </button>
                  <button
                    onClick={() => setDensity('compact')}
                    className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                      density === 'compact'
                        ? 'bg-surface text-accent shadow-xs font-bold'
                        : 'hover:text-textPrimary'
                    }`}
                  >
                    Compact
                  </button>
                </div>
                
                <span className="text-xs text-textMuted font-medium select-none">
                  {filtered.length} matches
                </span>
              </div>
            </div>

            {/* Results card */}
            <div className="bg-surface border border-border/40 rounded-xl overflow-hidden shadow-xs mb-8">
              <div className="divide-y divide-border/40">
                {paginatedData.map((ann) => (
                  <AnnouncementItem
                    key={ann.id}
                    item={ann}
                    density={density}
                  />
                ))}
              </div>

              {filtered.length > 0 && (
                <PaginationBar
                  total={filtered.length}
                  page={page}
                  limit={limit}
                  onPageChange={(p) => setPage(p)}
                  onLimitChange={(l) => {
                    setLimit(l)
                    setPage(1)
                  }}
                  limitOptions={[10, 15, 25, 50]}
                />
              )}
            </div>
          </>
        )}
      </div>

      <AppFooter />
    </div>
  )
}

export default QueryResults
