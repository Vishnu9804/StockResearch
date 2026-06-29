import { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronRight, ArrowUp, ArrowDown, Inbox } from 'lucide-react'
import { concalls as fallbackConcalls, upcomingConcalls } from '@/lib/data/market-pulse'
import { AppFooter } from '@/components/shared/AppFooter'
import { Heading } from '@/components/ui/Heading'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table'
import { TableRowsSkeleton } from '@/components/ui/SkeletonLoader'
import { InlineError } from '@/components/ui/InlineError'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import { toast } from 'react-hot-toast'
import { finscreenClient } from '@/services/finscreenApi'

type SortField = 'company' | 'date'

interface Concall {
  company: string
  symbol: string
  date: string
  quarter: string
  hasRecording: boolean
  hasTranscript: boolean
  hasSummary: boolean
}

export function Concalls() {
  const [searchParams, setSearchParams] = useSearchParams()
  const sortBy = (searchParams.get('sortBy') ?? 'date') as SortField
  const sortOrder = (searchParams.get('sortOrder') ?? 'desc') as 'asc' | 'desc'

  const [concallsList, setConcallsList] = useState<Concall[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchConcalls = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await finscreenClient.get('/finscreen/market/concalls')
      setConcallsList(res.data || [])
    } catch (err: any) {
      console.error(err)
      setError('Failed to fetch concalls data. Please retry.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConcalls()
  }, [])

  const handleRetry = () => {
    fetchConcalls()
  }

  const handleSort = (field: SortField) => {
    const newParams = new URLSearchParams(searchParams)
    if (sortBy === field) {
      newParams.set('sortOrder', sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      newParams.set('sortBy', field)
      newParams.set('sortOrder', 'desc')
    }
    setSearchParams(newParams)
  }

  const sortedData = useMemo(() => {
    const list = concallsList.length > 0 ? concallsList : fallbackConcalls
    return [...list].sort((a, b) => {
      let valA = (a[sortBy] || '').toLowerCase()
      let valB = (b[sortBy] || '').toLowerCase()
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1
      return 0
    })
  }, [concallsList, sortBy, sortOrder])

  const renderSortIcon = (field: SortField) => {
    if (sortBy !== field) return null
    return sortOrder === 'asc' ? (
      <ArrowUp className="size-3 ml-1 text-accent inline shrink-0" />
    ) : (
      <ArrowDown className="size-3 ml-1 text-accent inline shrink-0" />
    )
  }

  return (
    <div className="min-h-screen bg-background font-sans select-none">
      <div className="max-w-[1200px] mx-auto px-6 py-6 select-none">
        {/* Breadcrumb */}
        <div className="text-xs text-textSecondary/70 mb-2 flex items-center gap-1.5">
          <Link to="/" className="hover:text-accent transition-colors">Dashboard</Link>
          <ChevronRight className="size-3" />
          <Link to="/market-pulse" className="hover:text-accent transition-colors">Market Pulse</Link>
          <ChevronRight className="size-3" />
          <span className="text-accent font-medium">Concalls</span>
        </div>

        {/* Heading */}
        <Heading level={1} variant="pageTitle" className="text-textPrimary mb-6">
          Concalls
        </Heading>

        {error ? (
          <InlineError message={error} onRetry={handleRetry} className="mb-8" />
        ) : (
          /* Table card */
          <div className="bg-surface border border-border/40 rounded-xl overflow-hidden shadow-xs mb-8">
            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-5">
                  <TableRowsSkeleton rows={6} cols={7} />
                </div>
              ) : sortedData.length === 0 ? (
                <Empty className="py-12 border-0">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Inbox className="size-6 text-textMuted" />
                    </EmptyMedia>
                    <EmptyTitle className="text-textPrimary font-semibold">No concalls available</EmptyTitle>
                    <EmptyDescription className="text-textSecondary">
                      There are no recent concall audio reports listed right now.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <Table className="min-w-[768px] animate-[fadeInUp_0.18s_ease-out]">
                  <TableHeader className="bg-surfaceMuted/20">
                    <TableRow className="border-b border-border/40">
                      <TableHead className="w-12 text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3">#</TableHead>
                      <TableHead 
                        onClick={() => handleSort('company')}
                        className="text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                      >
                        <div className="flex items-center">
                          Company {renderSortIcon('company')}
                        </div>
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3">Quarter</TableHead>
                      <TableHead 
                        onClick={() => handleSort('date')}
                        className="text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                      >
                        <div className="flex items-center">
                          Date {renderSortIcon('date')}
                        </div>
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3">Recording</TableHead>
                      <TableHead className="text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3">Transcript</TableHead>
                      <TableHead className="text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3">Summary</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedData.map((d, i) => (
                      <TableRow key={i} className="hover:bg-surfaceMuted/30 transition-colors border-b border-border/30">
                        <TableCell className="text-sm text-textMuted px-4 py-3">{i + 1}</TableCell>
                        <TableCell className="text-sm px-4 py-3">
                          <Link to={`/company/${d.symbol.toLowerCase()}`} className="text-accent hover:underline font-semibold decoration-none outline-ring/45 focus-visible:outline">
                            {d.company}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm text-textPrimary px-4 py-3">{d.quarter}</TableCell>
                        <TableCell className="text-sm text-textPrimary px-4 py-3 whitespace-nowrap">{d.date || '—'}</TableCell>
                        <TableCell className="text-sm px-4 py-3">
                          {d.hasRecording ? (
                            <a href="#" onClick={(e) => { e.preventDefault(); toast.success('Opening recording...') }} className="text-xs font-semibold text-accent hover:underline decoration-none outline-ring/45 focus-visible:outline">
                              View
                            </a>
                          ) : (
                            <span className="text-textMuted">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm px-4 py-3">
                          {d.hasTranscript ? (
                            <a href="#" onClick={(e) => { e.preventDefault(); toast.success('Opening transcript...') }} className="text-xs font-semibold text-accent hover:underline decoration-none outline-ring/45 focus-visible:outline">
                              View
                            </a>
                          ) : (
                            <span className="text-textMuted">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm px-4 py-3">
                          {d.hasSummary ? (
                            <a href="#" onClick={(e) => { e.preventDefault(); toast.success('Opening summary...') }} className="text-xs font-semibold text-accent hover:underline decoration-none outline-ring/45 focus-visible:outline">
                              View
                            </a>
                          ) : (
                            <span className="text-textMuted">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        )}
      </div>
      <AppFooter />
    </div>
  )
}

export function UpcomingConcalls() {
  const [searchParams, setSearchParams] = useSearchParams()
  const sortBy = (searchParams.get('sortBy') ?? 'date') as SortField
  const sortOrder = (searchParams.get('sortOrder') ?? 'asc') as 'asc' | 'desc'

  const [loading, setLoading] = useState(true)
  const [error] = useState<string | null>(null)

  useEffect(() => {
    const delay = setTimeout(() => {
      setLoading(false)
    }, 450)
    return () => clearTimeout(delay)
  }, [searchParams])

  const handleSort = (field: SortField) => {
    const newParams = new URLSearchParams(searchParams)
    if (sortBy === field) {
      newParams.set('sortOrder', sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      newParams.set('sortBy', field)
      newParams.set('sortOrder', 'asc')
    }
    setSearchParams(newParams)
  }

  const sortedUpcoming = useMemo(() => {
    return [...upcomingConcalls].sort((a, b) => {
      let valA = a[sortBy].toLowerCase()
      let valB = b[sortBy].toLowerCase()
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1
      return 0
    })
  }, [sortBy, sortOrder])

  const renderSortIcon = (field: SortField) => {
    if (sortBy !== field) return null
    return sortOrder === 'asc' ? (
      <ArrowUp className="size-3 ml-1 text-accent inline shrink-0" />
    ) : (
      <ArrowDown className="size-3 ml-1 text-accent inline shrink-0" />
    )
  }

  return (
    <div className="min-h-screen bg-background font-sans select-none">
      <div className="max-w-[1200px] mx-auto px-6 py-6 select-none">
        {/* Breadcrumb */}
        <div className="text-xs text-textSecondary/70 mb-2 flex items-center gap-1.5">
          <Link to="/" className="hover:text-accent transition-colors">Dashboard</Link>
          <ChevronRight className="size-3" />
          <Link to="/market-pulse" className="hover:text-accent transition-colors">Market Pulse</Link>
          <ChevronRight className="size-3" />
          <span className="text-accent font-medium">Upcoming Concalls</span>
        </div>

        {/* Heading */}
        <Heading level={1} variant="pageTitle" className="text-textPrimary mb-6">
          Upcoming Concalls
        </Heading>

        {error ? (
          <InlineError message={error} onRetry={() => {}} className="mb-8" />
        ) : (
          /* Table card */
          <div className="bg-surface border border-border/40 rounded-xl overflow-hidden shadow-xs mb-8">
            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-5">
                  <TableRowsSkeleton rows={4} cols={5} />
                </div>
              ) : sortedUpcoming.length === 0 ? (
                <Empty className="py-12 border-0">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Inbox className="size-6 text-textMuted" />
                    </EmptyMedia>
                    <EmptyTitle className="text-textPrimary font-semibold">No upcoming concalls scheduled</EmptyTitle>
                    <EmptyDescription className="text-textSecondary">
                      There are no upcoming corporate concalls listed at this moment.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <Table className="min-w-[640px] animate-[fadeInUp_0.18s_ease-out]">
                  <TableHeader className="bg-surfaceMuted/20">
                    <TableRow className="border-b border-border/40">
                      <TableHead className="w-12 text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3">#</TableHead>
                      <TableHead 
                        onClick={() => handleSort('company')}
                        className="text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                      >
                        <div className="flex items-center">
                          Company {renderSortIcon('company')}
                        </div>
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3">Quarter</TableHead>
                      <TableHead 
                        onClick={() => handleSort('date')}
                        className="text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                      >
                        <div className="flex items-center">
                          Date {renderSortIcon('date')}
                        </div>
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedUpcoming.map((d, i) => (
                      <TableRow key={i} className="hover:bg-surfaceMuted/30 transition-colors border-b border-border/30">
                        <TableCell className="text-sm text-textMuted px-4 py-3">{i + 1}</TableCell>
                        <TableCell className="text-sm px-4 py-3">
                          <Link to={`/company/${d.symbol.toLowerCase()}`} className="text-accent hover:underline font-semibold decoration-none outline-ring/45 focus-visible:outline">
                            {d.company}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm text-textPrimary px-4 py-3">{d.quarter}</TableCell>
                        <TableCell className="text-sm text-textPrimary px-4 py-3 whitespace-nowrap">{d.date}</TableCell>
                        <TableCell className="text-sm px-4 py-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toast.success(`Reminder set for ${d.company} concall`)}
                            className="font-semibold cursor-pointer outline-ring/45 focus-visible:outline"
                          >
                            Set Reminder
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        )}
      </div>
      <AppFooter />
    </div>
  )
}

export default Concalls
