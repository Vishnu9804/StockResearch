import { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronRight, BookOpen, Inbox, ArrowUp, ArrowDown } from 'lucide-react'
import { annualReports as fallbackReports } from '@/lib/data/market-pulse'
import { AppFooter } from '@/components/shared/AppFooter'
import { Heading } from '@/components/ui/Heading'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table'
import { TableRowsSkeleton } from '@/components/ui/SkeletonLoader'
import { InlineError } from '@/components/ui/InlineError'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import { finscreenClient } from '@/services/finscreenApi'

const FY_OPTIONS = ['FY26', 'FY25', 'FY24']

type SortField = 'company' | 'revenue' | 'pat' | 'eps' | 'roe' | 'dividendPerShare'
type SortOrder = 'asc' | 'desc'

interface AnnualReport {
  company: string
  symbol: string
  fy: string
  revenue: number
  pat: number
  eps: number
  roe: number
  dividendPerShare: number
}

export default function AnnualReports() {
  const [searchParams, setSearchParams] = useSearchParams()
  const fy = searchParams.get('fy') ?? 'FY26'
  const sortBy = (searchParams.get('sortBy') ?? 'revenue') as SortField
  const sortOrder = (searchParams.get('sortOrder') ?? 'desc') as SortOrder

  const [reports, setReports] = useState<AnnualReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchReports = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await finscreenClient.get('/finscreen/market/annual-reports')
      setReports(res.data || [])
    } catch (err: any) {
      console.error(err)
      setError('Failed to load annual reports. Please retry.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReports()
  }, [])

  const handleRetry = () => {
    fetchReports()
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

  const handleFyChange = (selectedFy: string) => {
    const newParams = new URLSearchParams(searchParams)
    newParams.set('fy', selectedFy)
    setSearchParams(newParams)
  }

  const sortedData = useMemo(() => {
    const list = reports.length > 0 ? reports : fallbackReports
    const filtered = list.filter(r => r.fy === fy || fy === 'All')
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
  }, [reports, fy, sortBy, sortOrder])

  const renderSortIcon = (field: SortField) => {
    if (sortBy !== field) return null
    return sortOrder === 'asc' ? (
      <ArrowUp className="size-3 ml-1 text-accent transition-transform shrink-0" />
    ) : (
      <ArrowDown className="size-3 ml-1 text-accent transition-transform shrink-0" />
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
          <span className="text-accent font-medium">Annual Reports</span>
        </div>

        {/* H1 */}
        <Heading level={1} variant="pageTitle" className="text-textPrimary mb-4">
          Latest Annual Reports
        </Heading>

        {/* FY Chips */}
        <div className="flex gap-2 mb-6">
          {FY_OPTIONS.map(f => (
            <button
              key={f}
              onClick={() => handleFyChange(f)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                fy === f
                  ? 'bg-accent border-accent text-white shadow-sm'
                  : 'bg-surface border-border hover:bg-surfaceMuted/65 text-textPrimary'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {error ? (
          <InlineError message={error} onRetry={handleRetry} className="mb-8" />
        ) : (
          /* Two-column responsive grid */
          <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 items-start">
            {/* LEFT: Table card */}
            <div className="lg:col-span-7 bg-surface border border-border/40 rounded-xl overflow-hidden shadow-xs">
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
                      <EmptyTitle className="text-textPrimary font-semibold">No records match the current filters</EmptyTitle>
                      <EmptyDescription className="text-textSecondary">
                        Try clearing or changing the selected Fiscal Year filter.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <Table className="min-w-[640px] animate-[fadeInUp_0.18s_ease-out]">
                    <TableHeader className="bg-surfaceMuted/20">
                      <TableRow className="border-b border-border/40">
                        <TableHead 
                          onClick={() => handleSort('company')}
                          className="text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                        >
                          <div className="flex items-center">
                            Company {renderSortIcon('company')}
                          </div>
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3">FY</TableHead>
                        <TableHead 
                          onClick={() => handleSort('revenue')}
                          className="text-right text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                        >
                          <div className="flex items-center justify-end">
                            Revenue (Cr) {renderSortIcon('revenue')}
                          </div>
                        </TableHead>
                        <TableHead 
                          onClick={() => handleSort('pat')}
                          className="text-right text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                        >
                          <div className="flex items-center justify-end">
                            PAT (Cr) {renderSortIcon('pat')}
                          </div>
                        </TableHead>
                        <TableHead 
                          onClick={() => handleSort('eps')}
                          className="text-right text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                        >
                          <div className="flex items-center justify-end">
                            EPS {renderSortIcon('eps')}
                          </div>
                        </TableHead>
                        <TableHead 
                          onClick={() => handleSort('roe')}
                          className="text-right text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                        >
                          <div className="flex items-center justify-end">
                            ROE % {renderSortIcon('roe')}
                          </div>
                        </TableHead>
                        <TableHead 
                          onClick={() => handleSort('dividendPerShare')}
                          className="text-right text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                        >
                          <div className="flex items-center justify-end">
                            Div/Share {renderSortIcon('dividendPerShare')}
                          </div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedData.map(report => (
                        <TableRow key={report.symbol} className="hover:bg-surfaceMuted/30 transition-colors border-b border-border/30">
                          <TableCell className="text-sm px-4 py-3">
                            <div className="flex items-center gap-2">
                              <BookOpen className="size-3.5 text-textSecondary" />
                              <Link
                                to={`/company/${report.symbol.toLowerCase()}`}
                                className="text-accent hover:underline font-semibold decoration-none outline-ring/45 focus-visible:outline"
                              >
                                {report.company}
                              </Link>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-textPrimary px-4 py-3">{report.fy}</TableCell>
                          <TableCell className="text-right text-sm text-textPrimary px-4 py-3 tabular">
                            {report.revenue ? report.revenue.toLocaleString('en-IN') : '—'}
                          </TableCell>
                          <TableCell className="text-right text-sm text-textPrimary px-4 py-3 tabular">
                            {report.pat ? report.pat.toLocaleString('en-IN') : '—'}
                          </TableCell>
                          <TableCell className="text-right text-sm text-textPrimary px-4 py-3 tabular">
                            {report.eps || '—'}
                          </TableCell>
                          <TableCell className="text-right text-sm text-textPrimary px-4 py-3 tabular">
                            {report.roe ? `${report.roe}%` : '—'}
                          </TableCell>
                          <TableCell className="text-right text-sm text-textPrimary px-4 py-3 tabular">
                            {report.dividendPerShare ? `₹${report.dividendPerShare}` : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>

            {/* RIGHT: Filter sidebar */}
            <div className="lg:col-span-3 bg-surface border border-border/40 rounded-xl overflow-hidden shadow-xs lg:sticky lg:top-6">
              <div className="p-4 border-b border-border/40 bg-surfaceMuted/20">
                <span className="text-sm font-semibold text-textPrimary">Filter</span>
              </div>
              <div className="p-4">
                <div className="text-xs font-semibold text-textSecondary uppercase tracking-wider mb-3">
                  Sort By
                </div>
                <div className="flex flex-col gap-2 mb-5">
                  {(['revenue', 'pat'] as SortField[]).map(opt => (
                    <label key={opt} className="flex items-center gap-2 py-1 px-1.5 rounded hover:bg-surfaceMuted/40 cursor-pointer text-sm text-textPrimary select-none">
                      <input
                        type="radio"
                        name="sortBy"
                        checked={sortBy === opt}
                        onChange={() => handleSort(opt)}
                        className="accent-accent cursor-pointer size-3.5 outline-ring/45 focus-visible:outline"
                      />
                      <span className="capitalize">{opt === 'revenue' ? 'Revenue' : 'PAT'}</span>
                    </label>
                  ))}
                </div>

                <div className="text-xs font-semibold text-textSecondary uppercase tracking-wider mb-3">
                  Fiscal Year
                </div>
                <div className="flex flex-col gap-2">
                  {FY_OPTIONS.map(f => (
                    <label key={f} className="flex items-center gap-2 py-1 px-1.5 rounded hover:bg-surfaceMuted/40 cursor-pointer text-sm text-textPrimary select-none">
                      <input
                        type="radio"
                        name="fy"
                        checked={fy === f}
                        onChange={() => handleFyChange(f)}
                        className="accent-accent cursor-pointer size-3.5 outline-ring/45 focus-visible:outline"
                      />
                      <span>{f}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <AppFooter />
    </div>
  )
}
