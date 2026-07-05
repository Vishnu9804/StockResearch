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
const DIV_TYPES = ['All', 'Final', 'Interim', 'Special']

type SortField = 'company' | 'exDate' | 'recordDate' | 'dividendType' | 'dividendPerShare' | 'fy'

interface DividendRow {
  company: string
  symbol: string
  exDate: string
  recordDate: string
  dividendType: 'Final' | 'Interim' | 'Special' | string
  dividendPerShare: number
  fy: string
}

export default function Dividends() {
  const [searchParams, setSearchParams] = useSearchParams()
  const year = searchParams.get('year') ?? '2026'
  const divType = searchParams.get('divType') ?? 'All'
  const sortBy = (searchParams.get('sortBy') ?? 'exDate') as SortField
  const sortOrder = (searchParams.get('sortOrder') ?? 'desc') as 'asc' | 'desc'

  const [dividends, setDividends] = useState<DividendRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDividends = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await finscreenClient.get('/finscreen/market/dividends')
      setDividends(res.data || [])
    } catch (err: any) {
      console.error(err)
      setError('Failed to fetch dividends data. Please retry.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDividends()
  }, [])

  const handleRetry = () => {
    fetchDividends()
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

  const handleTypeChange = (t: string) => {
    const newParams = new URLSearchParams(searchParams)
    newParams.set('divType', t)
    setSearchParams(newParams)
  }

  const sortedData = useMemo(() => {
    const list = dividends
    const filtered = list.filter(row => {
      const matchesType = divType === 'All' || row.dividendType === divType
      const matchesYear = !row.exDate || row.exDate.startsWith(year)
      return matchesType && matchesYear
    })
    
    // If year filtering returned empty but list itself has items, fallback to show list
    const displayData = filtered.length > 0 ? filtered : list

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
  }, [dividends, year, divType, sortBy, sortOrder])

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
          <span className="text-accent font-medium">Dividends Hub</span>
        </div>

        {/* Heading */}
        <Heading level={1} variant="pageTitle" className="text-textPrimary mb-4">
          Dividends Hub
        </Heading>

        {/* Filters panel */}
        <div className="flex flex-col gap-4 mb-6 md:flex-row md:items-center md:justify-between">
          {/* Year chips */}
          <div className="flex gap-2 flex-wrap">
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

          {/* Type dropdown buttons */}
          <div className="flex gap-2 flex-wrap">
            {DIV_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => handleTypeChange(t)}
                className={`px-3 py-1 rounded text-xs font-medium border transition-colors cursor-pointer ${
                  divType === t
                    ? 'bg-secondary text-textPrimary border-secondary'
                    : 'bg-surface border-border hover:bg-surfaceMuted text-textSecondary'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

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
                    <EmptyTitle className="text-textPrimary font-semibold">No dividends found</EmptyTitle>
                    <EmptyDescription className="text-textSecondary">
                      Try selecting a different year or filter option.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <Table className="min-w-[800px] animate-[fadeInUp_0.18s_ease-out]">
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
                      <TableHead 
                        onClick={() => handleSort('exDate')}
                        className="text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                      >
                        <div className="flex items-center">
                          Ex-Date {renderSortIcon('exDate')}
                        </div>
                      </TableHead>
                      <TableHead 
                        onClick={() => handleSort('recordDate')}
                        className="text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                      >
                        <div className="flex items-center">
                          Record Date {renderSortIcon('recordDate')}
                        </div>
                      </TableHead>
                      <TableHead 
                        onClick={() => handleSort('dividendType')}
                        className="text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                      >
                        <div className="flex items-center">
                          Type {renderSortIcon('dividendType')}
                        </div>
                      </TableHead>
                      <TableHead 
                        onClick={() => handleSort('dividendPerShare')}
                        className="text-right text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                      >
                        <div className="flex items-center justify-end">
                          Amount (₹) {renderSortIcon('dividendPerShare')}
                        </div>
                      </TableHead>
                      <TableHead 
                        onClick={() => handleSort('fy')}
                        className="text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                      >
                        <div className="flex items-center">
                          FY {renderSortIcon('fy')}
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedData.map((d, i) => {
                      return (
                        <TableRow key={i} className="hover:bg-surfaceMuted/30 transition-colors border-b border-border/30">
                          <TableCell className="text-sm text-textMuted px-4 py-3">{i + 1}</TableCell>
                          <TableCell className="text-sm px-4 py-3">
                            <Link to={`/company/${d.symbol.toLowerCase()}`} className="text-accent hover:underline font-semibold decoration-none outline-ring/45 focus-visible:outline">
                              {d.company}
                            </Link>
                          </TableCell>
                          <TableCell className="text-sm text-textPrimary px-4 py-3 whitespace-nowrap">{d.exDate || '—'}</TableCell>
                          <TableCell className="text-sm text-textPrimary px-4 py-3 whitespace-nowrap">{d.recordDate || '—'}</TableCell>
                          <TableCell className="text-sm px-4 py-3">
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-accentSoft text-accent">
                              {d.dividendType}
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-sm text-textPrimary px-4 py-3 tabular font-semibold">
                            ₹{d.dividendPerShare?.toFixed(2) || '0.00'}
                          </TableCell>
                          <TableCell className="text-sm text-textPrimary px-4 py-3 font-mono">{d.fy}</TableCell>
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
