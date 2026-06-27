/**
 * New Issues / IPO module — /market-pulse/new-issues
 * Tabbed card: Upcoming IPOs | Recent IPOs | Below IPO Price | Upcoming Rights
 */
import { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronRight, ArrowUp, ArrowDown, Inbox } from 'lucide-react'
import { iposUpcoming, iposRecent, type UpcomingIPO, type RecentIPO } from '@/lib/data/market-pulse'
import { AppFooter } from '@/components/shared/AppFooter'
import { Heading } from '@/components/ui/Heading'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table'
import { TableRowsSkeleton } from '@/components/ui/SkeletonLoader'
import { InlineError } from '@/components/ui/InlineError'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import { toast } from 'react-hot-toast'

const TABS = ['Upcoming IPOs', 'Recent IPOs', 'Below IPO Price', 'Upcoming Rights'] as const
type Tab = typeof TABS[number]

const TAB_MAPPING: Record<string, Tab> = {
  'upcoming-ipos': 'Upcoming IPOs',
  'recent-ipos': 'Recent IPOs',
  'below-ipo-price': 'Below IPO Price',
  'upcoming-rights': 'Upcoming Rights',
}

const REVERSE_TAB_MAPPING: Record<Tab, string> = {
  'Upcoming IPOs': 'upcoming-ipos',
  'Recent IPOs': 'recent-ipos',
  'Below IPO Price': 'below-ipo-price',
  'Upcoming Rights': 'upcoming-rights',
}

const TAB_DESCRIPTIONS: Record<Tab, string> = {
  'Upcoming IPOs': 'Companies with IPOs opening in the coming days.',
  'Recent IPOs': 'Companies listed in the last 3 years.',
  'Below IPO Price': 'Companies listed in the last 3 years trading below their IPO price.',
  'Upcoming Rights': 'Companies with upcoming rights issues; consider buying before ex‑date if participating.',
}

const RIGHTS_DATA = [
  { company: 'Reliance Industries', symbol: 'RELIANCE', exDate: '2026-07-20', ratio: '1:15', price: 1257, currentPrice: 2934.7, diffPct: 133.5 },
  { company: 'ONGC Ltd', symbol: 'ONGC', exDate: '2026-08-05', ratio: '3:10', price: 180, currentPrice: 286.4, diffPct: 59.1 },
  { company: 'Vodafone Idea', symbol: 'IDEA', exDate: '2026-07-12', ratio: '1:3', price: 10, currentPrice: 11.8, diffPct: 18.0 },
]

function SortableHeader({
  label,
  field,
  activeField,
  activeOrder,
  onSort,
  align = 'left',
}: {
  label: string
  field: string
  activeField: string
  activeOrder: 'asc' | 'desc'
  onSort: (field: any) => void
  align?: 'left' | 'center' | 'right'
}) {
  const isSorted = activeField === field
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
  const justifyClass = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'
  return (
    <TableHead
      onClick={() => onSort(field)}
      className={`text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-2.5 hover:text-accent cursor-pointer transition-colors select-none ${alignClass}`}
    >
      <div className={`flex items-center gap-1 ${justifyClass}`}>
        <span>{label}</span>
        {isSorted ? (
          activeOrder === 'asc' ? (
            <ArrowUp className="size-3 text-accent shrink-0 inline" />
          ) : (
            <ArrowDown className="size-3 text-accent shrink-0 inline" />
          )
        ) : (
          <ArrowUp className="size-3 text-textMuted/30 shrink-0 inline opacity-0 hover:opacity-100 transition-opacity" />
        )}
      </div>
    </TableHead>
  )
}

export function NewIssues() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTabParam = searchParams.get('tab') ?? 'upcoming-ipos'
  const activeTab = TAB_MAPPING[activeTabParam] ?? 'Upcoming IPOs'

  // Filter & Paging parameters
  const bucket = searchParams.get('bucket') ?? 'all'
  const pageSize = Number(searchParams.get('size') ?? '10')
  const page = Number(searchParams.get('page') ?? '1')

  // Sorting parameters
  const sortBy = searchParams.get('sortBy') ?? 'company'
  const sortOrder = (searchParams.get('sortOrder') ?? 'asc') as 'asc' | 'desc'

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const handleFetch = (showError = false) => {
    setLoading(true)
    setError(null)
    const delay = setTimeout(() => {
      if (showError) {
        setError('Failed to fetch new issues data. Please retry.')
      } else {
        setLoading(false)
      }
    }, 450)
    return () => clearTimeout(delay)
  }

  useEffect(() => {
    const mockError = searchParams.get('error') === 'true'
    const cleanup = handleFetch(mockError)
    return cleanup
  }, [searchParams])

  const handleRetry = () => {
    const newParams = new URLSearchParams(searchParams)
    newParams.delete('error')
    setSearchParams(newParams)
    handleFetch(false)
  }

  const handleTabChange = (tab: Tab) => {
    const newParams = new URLSearchParams(searchParams)
    newParams.set('tab', REVERSE_TAB_MAPPING[tab])
    newParams.delete('bucket')
    newParams.delete('page')
    newParams.delete('sortBy')
    newParams.delete('sortOrder')
    setSearchParams(newParams)
  }

  const handleBucketChange = (b: string) => {
    const newParams = new URLSearchParams(searchParams)
    if (b === 'all') {
      newParams.delete('bucket')
    } else {
      newParams.set('bucket', b)
    }
    newParams.delete('page') // Reset page on filter change
    setSearchParams(newParams)
  }

  const handlePageSizeChange = (sz: number) => {
    const newParams = new URLSearchParams(searchParams)
    newParams.set('size', sz.toString())
    newParams.delete('page')
    setSearchParams(newParams)
  }

  const handlePageChange = (p: number) => {
    const newParams = new URLSearchParams(searchParams)
    newParams.set('page', p.toString())
    setSearchParams(newParams)
  }

  const handleSort = (field: string) => {
    const newParams = new URLSearchParams(searchParams)
    if (sortBy === field) {
      newParams.set('sortOrder', sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      newParams.set('sortBy', field)
      newParams.set('sortOrder', 'asc')
    }
    setSearchParams(newParams)
  }

  // Filter raw data
  const rawData = useMemo(() => {
    if (activeTab === 'Upcoming IPOs') {
      return iposUpcoming
    }
    if (activeTab === 'Recent IPOs') {
      return iposRecent
    }
    if (activeTab === 'Below IPO Price') {
      return iposRecent.filter(r => r.changePercent < 0)
    }
    return RIGHTS_DATA
  }, [activeTab])

  // Apply bucket filters client-side
  const filteredData = useMemo(() => {
    if (bucket === 'all') return rawData

    if (activeTab === 'Upcoming IPOs') {
      const data = rawData as UpcomingIPO[]
      return data.filter(item => {
        if (bucket === 'large') return item.issueSize >= 5000
        if (bucket === 'mid') return item.issueSize >= 2000 && item.issueSize < 5000
        return item.issueSize < 2000
      })
    }

    if (activeTab === 'Recent IPOs' || activeTab === 'Below IPO Price') {
      const data = rawData as RecentIPO[]
      return data.filter(item => {
        if (bucket === 'large') return item.currentMarketCapCr >= 50000
        if (bucket === 'mid') return item.currentMarketCapCr >= 5000 && item.currentMarketCapCr < 50000
        return item.currentMarketCapCr < 5000
      })
    }

    return rawData
  }, [rawData, activeTab, bucket])

  // Sort filtered data
  const sortedData = useMemo(() => {
    return [...filteredData].sort((a: any, b: any) => {
      let valA = a[sortBy]
      let valB = b[sortBy]

      if (valA === undefined || valB === undefined) return 0

      if (typeof valA === 'string') {
        valA = valA.toLowerCase()
        valB = valB.toLowerCase()
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1
      return 0
    })
  }, [filteredData, sortBy, sortOrder])

  // Paginated sorted data
  const paginatedData = useMemo(() => {
    const start = (page - 1) * pageSize
    return sortedData.slice(start, start + pageSize)
  }, [sortedData, page, pageSize])

  const totalPages = Math.ceil(sortedData.length / pageSize)
  const showPagination = totalPages > 1
  const startEntry = (page - 1) * pageSize + 1
  const endEntry = Math.min(page * pageSize, sortedData.length)

  return (
    <div className="min-h-screen bg-background font-sans select-none">
      <div className="max-w-[1200px] mx-auto px-6 py-6 select-none">

        {/* Breadcrumb */}
        <div className="text-xs text-textSecondary/70 mb-2 flex items-center gap-1.5">
          <Link to="/" className="hover:text-accent transition-colors">Dashboard</Link>
          <ChevronRight className="size-3" />
          <Link to="/market-pulse" className="hover:text-accent transition-colors">Market Pulse</Link>
          <ChevronRight className="size-3" />
          <span className="text-accent font-medium">New Issues</span>
        </div>

        <Heading level={1} variant="pageTitle" className="text-textPrimary mb-6">
          New Issues
        </Heading>

        {error ? (
          <InlineError message={error} onRetry={handleRetry} className="mb-8" />
        ) : (
          /* Main tabbed card */
          <div className="bg-surface border border-border/40 rounded-xl overflow-hidden shadow-xs mb-8">
            {/* Tab header selectors */}
            <div className="border-b border-border/40 flex overflow-x-auto scrollbar-hide gap-1 px-4 bg-surfaceMuted/20">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => handleTabChange(tab)}
                  className={`py-3.5 px-4 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer outline-ring/45 focus-visible:outline ${
                    activeTab === tab
                      ? 'border-accent text-accent'
                      : 'border-transparent text-textSecondary hover:text-textPrimary'
                  }`}
                >
                  {tab}
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide shrink-0 ${
                    activeTab === tab
                      ? 'bg-accentSoft text-accent'
                      : 'bg-surfaceMuted text-textMuted'
                  }`}>
                    {activeTab === tab ? sortedData.length : rawData.length}
                  </span>
                </button>
              ))}
            </div>

            {/* Description bar */}
            <div className="px-5 py-3 border-b border-border/30 bg-surfaceMuted/5">
              <p className="text-xs text-textSecondary leading-normal">
                {TAB_DESCRIPTIONS[activeTab]}
              </p>
            </div>

            {/* Filter controls inside card */}
            <div className="px-5 py-3 border-b border-border/40 flex flex-col sm:flex-row gap-3 items-center justify-between bg-surfaceMuted/10">
              {/* Quick filter chips */}
              <div className="flex flex-wrap gap-1.5 items-center w-full sm:w-auto">
                {activeTab !== 'Upcoming Rights' && (
                  <>
                    <span className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider mr-1 select-none">
                      Filter:
                    </span>
                    {['all', 'large', 'mid', 'small'].map(b => {
                      let label = b.toUpperCase()
                      if (activeTab === 'Upcoming IPOs') {
                        if (b === 'all') label = 'All'
                        else if (b === 'large') label = 'Large (> 5k Cr)'
                        else if (b === 'mid') label = 'Mid (2k - 5k Cr)'
                        else if (b === 'small') label = 'Small (< 2k Cr)'
                      } else {
                        if (b === 'all') label = 'All'
                        else if (b === 'large') label = 'Large (> 50k Cr)'
                        else if (b === 'mid') label = 'Mid (5k - 50k Cr)'
                        else if (b === 'small') label = 'Small (< 5k Cr)'
                      }
                      return (
                        <button
                          key={b}
                          onClick={() => handleBucketChange(b)}
                          className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-all cursor-pointer ${
                            bucket === b
                              ? 'bg-accent border-accent text-white shadow-xs'
                              : 'bg-background border-border/60 hover:bg-surfaceMuted text-textSecondary'
                          }`}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </>
                )}
              </div>
              
              {/* Results size page entry selector */}
              <div className="flex items-center gap-2 ml-auto shrink-0 text-xs text-textSecondary select-none">
                <span>Show</span>
                <select
                  value={pageSize}
                  onChange={e => handlePageSizeChange(Number(e.target.value))}
                  className="bg-background border border-border/60 rounded px-2 py-1 outline-none font-semibold text-textPrimary cursor-pointer focus:border-accent"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
                <span>entries</span>
              </div>
            </div>

            {/* Showing X of Y companies status bar with filters and sort status */}
            {!loading && !error && (
              <div className="px-5 py-2 border-b border-border/30 bg-surfaceMuted/5 text-xs text-textSecondary flex flex-wrap gap-2 items-center">
                <span>Showing <span className="font-semibold text-textPrimary">{sortedData.length}</span> of <span className="font-semibold text-textSecondary">{rawData.length}</span> companies</span>
                {bucket !== 'all' && (
                  <span className="bg-accentSoft text-accent px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                    Filter: {bucket}
                  </span>
                )}
                {sortBy && (
                  <span className="bg-surfaceMuted text-textSecondary px-2 py-0.5 rounded text-[10px] font-semibold">
                    Sorted by: {sortBy} ({sortOrder})
                  </span>
                )}
              </div>
            )}

            {/* Table data body content */}
            {loading ? (
              <TableRowsSkeleton rows={4} cols={activeTab === 'Upcoming Rights' ? 7 : 8} />
            ) : sortedData.length === 0 ? (
              <Empty className="py-12 border-0">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Inbox className="size-6 text-textMuted" />
                  </EmptyMedia>
                  <EmptyTitle className="text-textPrimary font-semibold">No companies match this selection</EmptyTitle>
                  <EmptyDescription className="text-textSecondary">
                    Try changing the filter size parameters or choosing another tab listing.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <>
                {/* ─── DESKTOP TABLE VIEW ─── */}
                <div className="hidden md:block overflow-x-auto">
                  <Table className="w-full">
                    <TableHeader className="bg-surfaceMuted/20 border-b border-border/40">
                      <TableRow>
                        <TableHead className="w-12 text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-2.5 text-left">#</TableHead>
                        
                        {activeTab === 'Upcoming IPOs' && (
                          <>
                            <SortableHeader label="Company" field="company" activeField={sortBy} activeOrder={sortOrder} onSort={handleSort} align="left" />
                            <SortableHeader label="Subscription Period" field="subscriptionStart" activeField={sortBy} activeOrder={sortOrder} onSort={handleSort} align="center" />
                            <SortableHeader label="Listing Date" field="listingDate" activeField={sortBy} activeOrder={sortOrder} onSort={handleSort} align="center" />
                            <SortableHeader label="Issue Size (Cr)" field="issueSize" activeField={sortBy} activeOrder={sortOrder} onSort={handleSort} align="right" />
                            <TableHead className="text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-2.5 text-center">Price Band</TableHead>
                            <TableHead className="text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-2.5 text-center">Category</TableHead>
                          </>
                        )}

                        {(activeTab === 'Recent IPOs' || activeTab === 'Below IPO Price') && (
                          <>
                            <SortableHeader label="Company" field="company" activeField={sortBy} activeOrder={sortOrder} onSort={handleSort} align="left" />
                            <SortableHeader label="Listing Date" field="listingDate" activeField={sortBy} activeOrder={sortOrder} onSort={handleSort} align="center" />
                            <SortableHeader label="IPO Price (₹)" field="ipoPrice" activeField={sortBy} activeOrder={sortOrder} onSort={handleSort} align="right" />
                            <SortableHeader label="Current Price (₹)" field="currentPrice" activeField={sortBy} activeOrder={sortOrder} onSort={handleSort} align="right" />
                            <SortableHeader label="Change %" field="changePercent" activeField={sortBy} activeOrder={sortOrder} onSort={handleSort} align="right" />
                            <SortableHeader label="IPO Mkt Cap (Cr)" field="ipoMarketCapCr" activeField={sortBy} activeOrder={sortOrder} onSort={handleSort} align="right" />
                            <SortableHeader label="Current Mkt Cap (Cr)" field="currentMarketCapCr" activeField={sortBy} activeOrder={sortOrder} onSort={handleSort} align="right" />
                          </>
                        )}

                        {activeTab === 'Upcoming Rights' && (
                          <>
                            <SortableHeader label="Company" field="company" activeField={sortBy} activeOrder={sortOrder} onSort={handleSort} align="left" />
                            <SortableHeader label="Ex Date" field="exDate" activeField={sortBy} activeOrder={sortOrder} onSort={handleSort} align="center" />
                            <TableHead className="text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-2.5 text-center">Ratio</TableHead>
                            <SortableHeader label="Rights Price (₹)" field="price" activeField={sortBy} activeOrder={sortOrder} onSort={handleSort} align="right" />
                            <SortableHeader label="Current Price (₹)" field="currentPrice" activeField={sortBy} activeOrder={sortOrder} onSort={handleSort} align="right" />
                            <SortableHeader label="% Diff" field="diffPct" activeField={sortBy} activeOrder={sortOrder} onSort={handleSort} align="right" />
                          </>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedData.map((item: any, i) => {
                        const globalIdx = (page - 1) * pageSize + i + 1
                        
                        if (activeTab === 'Upcoming IPOs') {
                          const ipo = item as UpcomingIPO
                          return (
                            <TableRow key={i} className="hover:bg-surfaceMuted/30 transition-colors border-b border-border/30">
                              <TableCell className="text-sm text-textMuted px-4 py-2.5 text-left">{globalIdx}</TableCell>
                              <TableCell className="text-sm font-semibold text-textPrimary px-4 py-2.5 text-left">{ipo.company}</TableCell>
                              <TableCell className="text-sm text-textSecondary px-4 py-2.5 text-center">{ipo.subscriptionStart} to {ipo.subscriptionEnd}</TableCell>
                              <TableCell className="text-sm text-textSecondary px-4 py-2.5 text-center">{ipo.listingDate}</TableCell>
                              <TableCell className="text-right text-sm text-textPrimary font-semibold px-4 py-2.5 tabular">₹{ipo.issueSize.toLocaleString('en-IN')}</TableCell>
                              <TableCell className="text-sm text-textPrimary px-4 py-2.5 font-mono text-center">{ipo.priceband}</TableCell>
                              <TableCell className="text-sm text-textSecondary px-4 py-2.5 text-center">{ipo.category}</TableCell>
                            </TableRow>
                          )
                        }

                        if (activeTab === 'Recent IPOs' || activeTab === 'Below IPO Price') {
                          const ipo = item as RecentIPO
                          const isPositive = ipo.changePercent > 0
                          const isNegative = ipo.changePercent < 0
                          return (
                            <TableRow key={i} className="hover:bg-surfaceMuted/30 transition-colors border-b border-border/30">
                              <TableCell className="text-sm text-textMuted px-4 py-2.5 text-left">{globalIdx}</TableCell>
                              <TableCell className="text-sm px-4 py-2.5 text-left">
                                <Link to={`/company/${ipo.symbol}`} className="font-semibold text-accent hover:underline decoration-none outline-ring/45 focus-visible:outline">
                                  {ipo.company}
                                </Link>
                              </TableCell>
                              <TableCell className="text-sm text-textSecondary px-4 py-2.5 text-center">{ipo.listingDate}</TableCell>
                              <TableCell className="text-right text-sm text-textSecondary px-4 py-2.5 tabular">₹{ipo.ipoPrice.toLocaleString('en-IN')}</TableCell>
                              <TableCell className="text-right text-sm text-textPrimary px-4 py-2.5 tabular font-semibold">₹{ipo.currentPrice.toLocaleString('en-IN')}</TableCell>
                              <TableCell className={`text-right text-sm font-semibold px-4 py-2.5 tabular ${
                                isPositive ? 'text-positive' : isNegative ? 'text-negative' : 'text-textPrimary'
                              }`}>
                                {isPositive ? '+' : ''}{ipo.changePercent.toFixed(1)}%
                              </TableCell>
                              <TableCell className="text-right text-sm text-textMuted px-4 py-2.5 tabular">₹{ipo.ipoMarketCapCr.toLocaleString('en-IN')}</TableCell>
                              <TableCell className="text-right text-sm text-textMuted px-4 py-2.5 tabular font-medium">₹{ipo.currentMarketCapCr.toLocaleString('en-IN')}</TableCell>
                            </TableRow>
                          )
                        }

                        // Upcoming Rights
                        const right = item
                        const isPositive = right.diffPct > 0
                        const isNegative = right.diffPct < 0
                        return (
                          <TableRow key={i} className="hover:bg-surfaceMuted/30 transition-colors border-b border-border/30">
                            <TableCell className="text-sm text-textMuted px-4 py-2.5 text-left">{globalIdx}</TableCell>
                            <TableCell className="text-sm px-4 py-2.5 text-left">
                              <Link to={`/company/${right.symbol}`} className="font-semibold text-accent hover:underline decoration-none outline-ring/45 focus-visible:outline">
                                {right.company}
                              </Link>
                            </TableCell>
                            <TableCell className="text-sm text-textSecondary px-4 py-2.5 text-center">{right.exDate}</TableCell>
                            <TableCell className="text-sm text-textPrimary px-4 py-2.5 font-medium text-center">{right.ratio}</TableCell>
                            <TableCell className="text-right text-sm text-textPrimary px-4 py-2.5 tabular">₹{right.price.toLocaleString('en-IN')}</TableCell>
                            <TableCell className="text-right text-sm text-textPrimary px-4 py-2.5 tabular font-semibold">₹{right.currentPrice.toLocaleString('en-IN')}</TableCell>
                            <TableCell className={`text-right text-sm font-semibold px-4 py-2.5 tabular ${
                              isPositive ? 'text-positive' : isNegative ? 'text-negative' : 'text-textPrimary'
                            }`}>
                              {isPositive ? '+' : ''}{right.diffPct.toFixed(1)}%
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* ─── MOBILE STACKED LIST VIEW ─── */}
                <div className="block md:hidden divide-y divide-border/40 bg-surface">
                  {paginatedData.map((item: any, i) => {
                    if (activeTab === 'Upcoming IPOs') {
                      const ipo = item as UpcomingIPO
                      return (
                        <div key={i} className="p-4 space-y-2.5 min-h-[44px]">
                          <div className="flex justify-between items-start">
                            <span className="text-sm font-bold text-textPrimary">{ipo.company}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accentSoft text-accent uppercase tracking-wider">
                              {ipo.category}
                            </span>
                          </div>
                          <div className="text-xs text-textSecondary flex justify-between">
                            <span>Subs: <span className="font-semibold text-textPrimary">{ipo.subscriptionStart} to {ipo.subscriptionEnd}</span></span>
                            <span>Listing: <span className="font-semibold text-textPrimary">{ipo.listingDate}</span></span>
                          </div>
                          <div className="text-xs text-textSecondary flex justify-between pt-1.5 border-t border-border/10">
                            <span>Issue Size: <span className="font-semibold text-textPrimary">₹{ipo.issueSize.toLocaleString('en-IN')} Cr</span></span>
                            <span>Band: <span className="font-mono font-semibold text-textPrimary">{ipo.priceband}</span></span>
                          </div>
                        </div>
                      )
                    }

                    if (activeTab === 'Recent IPOs' || activeTab === 'Below IPO Price') {
                      const ipo = item as RecentIPO
                      const isPositive = ipo.changePercent > 0
                      const isNegative = ipo.changePercent < 0
                      return (
                        <div key={i} className="p-4 space-y-2.5 min-h-[44px]">
                          <div className="flex justify-between items-start">
                            <Link to={`/company/${ipo.symbol}`} className="text-sm font-bold text-accent hover:underline outline-ring/45 focus-visible:outline decoration-none">
                              {ipo.company}
                            </Link>
                            <span className="text-[11px] text-textSecondary font-medium">List: {ipo.listingDate}</span>
                          </div>
                          <div className="text-xs text-textSecondary flex justify-between">
                            <span>Market Cap: <span className="font-semibold text-textPrimary">₹{ipo.currentMarketCapCr.toLocaleString('en-IN')} Cr</span></span>
                            <span>IPO Cap: <span className="font-semibold text-textSecondary">₹{ipo.ipoMarketCapCr.toLocaleString('en-IN')} Cr</span></span>
                          </div>
                          <div className="text-xs flex justify-between items-center pt-1.5 border-t border-border/10">
                            <div className="text-textSecondary">
                              IPO: <span className="font-medium text-textPrimary">₹{ipo.ipoPrice}</span>
                              <span className="mx-1.5 text-textMuted">→</span>
                              Current: <span className="font-semibold text-textPrimary">₹{ipo.currentPrice}</span>
                            </div>
                            <span className={`font-bold px-1.5 py-0.5 rounded text-[11px] ${
                              isPositive ? 'bg-positive-soft text-positive' : isNegative ? 'bg-negative-soft text-negative' : 'bg-surfaceMuted text-textPrimary'
                            }`}>
                              {isPositive ? '+' : ''}{ipo.changePercent.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      )
                    }

                    // Upcoming Rights
                    const right = item
                    const isPositive = right.diffPct > 0
                    const isNegative = right.diffPct < 0
                    return (
                      <div key={i} className="p-4 space-y-2.5 min-h-[44px]">
                        <div className="flex justify-between items-start">
                          <Link to={`/company/${right.symbol}`} className="text-sm font-bold text-accent hover:underline outline-ring/45 focus-visible:outline decoration-none">
                            {right.company}
                          </Link>
                          <span className="text-[11px] text-textSecondary font-medium">Ex-Date: {right.exDate}</span>
                        </div>
                        <div className="text-xs text-textSecondary">
                          Ratio: <span className="font-semibold text-textPrimary">{right.ratio}</span>
                        </div>
                        <div className="text-xs flex justify-between items-center pt-1.5 border-t border-border/10">
                          <div className="text-textSecondary">
                            Rights Price: <span className="font-medium text-textPrimary">₹{right.price}</span>
                            <span className="mx-1.5 text-textMuted">→</span>
                            Current: <span className="font-semibold text-textPrimary">₹{right.currentPrice}</span>
                          </div>
                          <span className={`font-bold px-1.5 py-0.5 rounded text-[11px] ${
                            isPositive ? 'bg-positive-soft text-positive' : isNegative ? 'bg-negative-soft text-negative' : 'bg-surfaceMuted text-textPrimary'
                          }`}>
                            Diff: {isPositive ? '+' : ''}{right.diffPct.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {/* Pagination / Total count Footer */}
            {showPagination && !loading && !error ? (
              <div className="flex items-center justify-between border-t border-border/40 px-5 py-3 text-xs text-textMuted bg-surfaceMuted/15">
                <span>Showing {startEntry}-{endEntry} of {sortedData.length} companies</span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => handlePageChange(page - 1)}
                    className="h-7 px-3 text-xs font-semibold cursor-pointer border-border/60 hover:bg-surfaceMuted"
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === totalPages}
                    onClick={() => handlePageChange(page + 1)}
                    className="h-7 px-3 text-xs font-semibold cursor-pointer border-border/60 hover:bg-surfaceMuted"
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : !loading && !error ? (
              <div className="px-5 py-3 border-t border-border/40 text-xs text-textMuted bg-surfaceMuted/5">
                Showing {sortedData.length} companies
              </div>
            ) : null}
          </div>
        )}
      </div>

      <AppFooter />
    </div>
  )
}

export default NewIssues
