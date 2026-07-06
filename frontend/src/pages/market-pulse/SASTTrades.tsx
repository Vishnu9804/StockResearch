import { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronRight, ArrowUp, ArrowDown, Inbox } from 'lucide-react'
import { AppFooter } from '@/components/shared/AppFooter'
import { Heading } from '@/components/ui/Heading'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table'
import { TableRowsSkeleton } from '@/components/ui/SkeletonLoader'
import { InlineError } from '@/components/ui/InlineError'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import { finscreenClient } from '@/services/finscreenApi'

const YEARS = ['2026', '2025', '2024']

type SortField = 'company' | 'acquirer' | 'preHolding' | 'postHolding' | 'changePercent' | 'date'

interface SASTrade {
  date: string
  company: string
  symbol: string
  acquirer: string
  preHolding: number
  postHolding: number
  changePercent: number
  mode: 'Open Market' | 'Off-Market' | 'Preferential Allotment' | string
}

export default function SASTTrades() {
  const [searchParams, setSearchParams] = useSearchParams()
  const year = searchParams.get('year') ?? '2026'
  const sortBy = (searchParams.get('sortBy') ?? 'date') as SortField
  const sortOrder = (searchParams.get('sortOrder') ?? 'desc') as 'asc' | 'desc'

  const [trades, setTrades] = useState<SASTrade[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTrades = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await finscreenClient.get('/market/sast-trades')
      setTrades(res.data || [])
    } catch (err: any) {
      console.error(err)
      setError('Failed to fetch SAST trades data. Please retry.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTrades()
  }, [])

  const handleRetry = () => {
    fetchTrades()
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

  const handleYearChange = (y: string) => {
    const newParams = new URLSearchParams(searchParams)
    newParams.set('year', y)
    setSearchParams(newParams)
  }

  const sortedData = useMemo(() => {
    const filtered = trades.filter((d) => !d.date || d.date.startsWith(year))
    const displayData = filtered.length > 0 ? filtered : trades

    return [...displayData].sort((a, b) => {
      let valA: any = a[sortBy]
      let valB: any = b[sortBy]

      if (typeof valA === 'string') {
        valA = valA.toLowerCase()
        valB = valB.toLowerCase()
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1
      return 0
    })
  }, [trades, year, sortBy, sortOrder])

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
          <span className="text-accent font-medium">SAST Trades</span>
        </div>

        {/* Heading */}
        <Heading level={1} variant="pageTitle" className="text-textPrimary mb-4">
          SAST Trades <span className="text-sm font-normal text-textSecondary">(Substantial Acquisition of Shares)</span>
        </Heading>

        {/* Year chips */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {YEARS.map((y) => (
            <button
              key={y}
              onClick={() => handleYearChange(y)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                year === y
                  ? 'bg-accent border-accent text-white shadow-sm'
                  : 'bg-surface border-border hover:bg-surfaceMuted/65 text-textSecondary'
              }`}
            >
              {y}
            </button>
          ))}
        </div>

        {error ? (
          <InlineError message={error} onRetry={handleRetry} className="mb-8" />
        ) : (
          /* Table card */
          <div className="bg-surface border border-border/40 rounded-xl overflow-hidden shadow-xs mb-8">
            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-5">
                  <TableRowsSkeleton rows={6} cols={8} />
                </div>
              ) : sortedData.length === 0 ? (
                <Empty className="py-12 border-0">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Inbox className="size-6 text-textMuted" />
                    </EmptyMedia>
                    <EmptyTitle className="text-textPrimary font-semibold">No SAST trades found</EmptyTitle>
                    <EmptyDescription className="text-textSecondary">
                      Try selecting a different year chip or filter.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <Table className="min-w-[800px] animate-[fadeInUp_0.18s_ease-out]">
                  <TableHeader className="bg-surfaceMuted/20">
                    <TableRow className="border-b border-border/40">
                      <TableHead className="w-12 text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3">#</TableHead>
                      <TableHead 
                        onClick={() => handleSort('date')}
                        className="text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                      >
                        <div className="flex items-center">
                          Date {renderSortIcon('date')}
                        </div>
                      </TableHead>
                      <TableHead 
                        onClick={() => handleSort('company')}
                        className="text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                      >
                        <div className="flex items-center">
                          Company {renderSortIcon('company')}
                        </div>
                      </TableHead>
                      <TableHead 
                        onClick={() => handleSort('acquirer')}
                        className="text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                      >
                        <div className="flex items-center">
                          Acquirer {renderSortIcon('acquirer')}
                        </div>
                      </TableHead>
                      <TableHead 
                        onClick={() => handleSort('preHolding')}
                        className="text-right text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                      >
                        <div className="flex items-center justify-end">
                          Pre-Holding % {renderSortIcon('preHolding')}
                        </div>
                      </TableHead>
                      <TableHead 
                        onClick={() => handleSort('postHolding')}
                        className="text-right text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                      >
                        <div className="flex items-center justify-end">
                          Post-Holding % {renderSortIcon('postHolding')}
                        </div>
                      </TableHead>
                      <TableHead 
                        onClick={() => handleSort('changePercent')}
                        className="text-right text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                      >
                        <div className="flex items-center justify-end">
                          Change % {renderSortIcon('changePercent')}
                        </div>
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3">Acquisition Mode</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedData.map((d, i) => {
                      const isAcquisition = d.changePercent >= 0
                      return (
                        <TableRow key={i} className="hover:bg-surfaceMuted/30 transition-colors border-b border-border/30">
                          <TableCell className="text-sm text-textMuted px-4 py-3">{i + 1}</TableCell>
                          <TableCell className="text-sm text-textPrimary px-4 py-3 whitespace-nowrap">{d.date || '—'}</TableCell>
                          <TableCell className="text-sm px-4 py-3">
                            <Link to={`/company/${d.symbol.toLowerCase()}`} className="text-accent hover:underline font-semibold decoration-none outline-ring/45 focus-visible:outline">
                              {d.company}
                            </Link>
                          </TableCell>
                          <TableCell className="text-sm text-textPrimary px-4 py-3 max-w-[240px] truncate" title={d.acquirer}>
                            {d.acquirer}
                          </TableCell>
                          <TableCell className="text-right text-sm text-textSecondary px-4 py-3 font-mono">
                            {d.preHolding ? `${d.preHolding.toFixed(2)}%` : '—'}
                          </TableCell>
                          <TableCell className="text-right text-sm text-textPrimary px-4 py-3 font-mono">
                            {d.postHolding ? `${d.postHolding.toFixed(2)}%` : '—'}
                          </TableCell>
                          <TableCell className={`text-right text-sm px-4 py-3 font-mono font-semibold ${
                            isAcquisition ? 'text-positive' : 'text-negative'
                          }`}>
                            {isAcquisition ? '+' : ''}{d.changePercent?.toFixed(2)}%
                          </TableCell>
                          <TableCell className="text-sm px-4 py-3 text-textSecondary">
                            {d.mode}
                          </TableCell>
                        </TableRow>
                      )
                    })}
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
