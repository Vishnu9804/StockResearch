import { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronRight, ArrowUp, ArrowDown, Inbox, Building2, RefreshCw } from 'lucide-react'
import { industries as mockIndustries } from '@/lib/data/market-pulse'
import { AppFooter } from '@/components/shared/AppFooter'
import { Heading } from '@/components/ui/Heading'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table'
import { TableRowsSkeleton } from '@/components/ui/SkeletonLoader'
import { Skeleton } from '@/components/ui/skeleton'
import { InlineError } from '@/components/ui/InlineError'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import { finscreenClient } from '@/services/finscreenApi'

type SortField = 'name' | 'stocks' | 'marketCapCr' | 'peRatio' | 'pbRatio' | 'roePercent' | 'rocePct' | 'changePercent'

interface IndustryItem {
  name: string
  stocks: number
  marketCapCr: number
  peRatio: number
  pbRatio: number
  roePercent: number
  rocePct: number
  changePercent: number
}

export default function Industries() {
  const [searchParams, setSearchParams] = useSearchParams()
  const sortBy = (searchParams.get('sortBy') ?? 'marketCapCr') as SortField
  const sortOrder = (searchParams.get('sortOrder') ?? 'desc') as 'asc' | 'desc'

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [industriesList, setIndustriesList] = useState<IndustryItem[]>(mockIndustries)
  
  // Selected sector and its companies
  const [selectedSector, setSelectedSector] = useState<string>('Information Technology')
  const [sectorCompanies, setSectorCompanies] = useState<string[]>([])
  const [companiesLoading, setCompaniesLoading] = useState(false)
  const [companiesError, setCompaniesError] = useState<string | null>(null)

  // Mapping from UI sector name to API sector query parameter value
  const getApiSectorName = (name: string) => {
    if (name === 'Information Technology') return 'IT'
    if (name === 'Fast Moving Consumer Goods') return 'FMCG'
    if (name === 'Healthcare & Pharma') return 'Healthcare'
    if (name === 'Energy & Oil') return 'Energy'
    return name
  }

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const updatedList = [...mockIndustries]
      // Fetch live stock counts for each sector in parallel
      const promises = updatedList.map(async (ind) => {
        try {
          const apiSector = getApiSectorName(ind.name)
          const res = await finscreenClient.get('/stock-search', {
            params: { group: 'sector', value: apiSector }
          })
          return { name: ind.name, count: res.data?.symbols?.length || 0 }
        } catch (e) {
          console.warn(`Failed to fetch stock count for sector: ${ind.name}`, e)
          return { name: ind.name, count: ind.stocks }
        }
      })

      const results = await Promise.all(promises)
      results.forEach(res => {
        const item = updatedList.find(x => x.name === res.name)
        if (item) {
          item.stocks = res.count
        }
      })
      setIndustriesList(updatedList)
    } catch (err: any) {
      console.error(err)
      setError('Failed to fetch industries overview. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const loadSectorCompanies = async (sectorName: string) => {
    setCompaniesLoading(true)
    setCompaniesError(null)
    try {
      const apiSector = getApiSectorName(sectorName)
      const res = await finscreenClient.get('/stock-search', {
        params: { group: 'sector', value: apiSector }
      })
      setSectorCompanies(res.data?.symbols || [])
    } catch (err: any) {
      console.error(err)
      setCompaniesError(`Failed to load companies for ${sectorName}`)
    } finally {
      setCompaniesLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (selectedSector) {
      loadSectorCompanies(selectedSector)
    }
  }, [selectedSector])

  const handleRetry = () => {
    loadData()
    if (selectedSector) {
      loadSectorCompanies(selectedSector)
    }
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
    return [...industriesList].sort((a, b) => {
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
  }, [industriesList, sortBy, sortOrder])

  const renderSortIcon = (field: SortField) => {
    if (sortBy !== field) return null
    return sortOrder === 'asc' ? (
      <ArrowUp className="size-3 ml-1 text-accent inline shrink-0" />
    ) : (
      <ArrowDown className="size-3 ml-1 text-accent inline shrink-0" />
    )
  }

  return (
    <div className="min-h-screen bg-background font-sans select-none animate-[fadeInUp_0.15s_ease-out]">
      <div className="max-w-[1200px] mx-auto px-6 py-6 select-none">
        
        {/* Breadcrumb */}
        <div className="text-xs text-textSecondary/70 mb-2 flex items-center gap-1.5">
          <Link to="/" className="hover:text-accent transition-colors">Dashboard</Link>
          <ChevronRight className="size-3" />
          <Link to="/market-pulse" className="hover:text-accent transition-colors">Market Pulse</Link>
          <ChevronRight className="size-3" />
          <span className="text-accent font-medium">Industries Overview</span>
        </div>

        {/* Header */}
        <Heading level={1} variant="pageTitle" className="text-textPrimary mb-6">
          Industries Overview
        </Heading>

        {error ? (
          <InlineError message={error} onRetry={handleRetry} className="mb-8" />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            
            {/* Left/Middle: Sectors Table */}
            <div className="lg:col-span-2 bg-surface border border-border/40 rounded-xl overflow-hidden shadow-xs flex flex-col justify-between">
              <div className="overflow-x-auto">
                {loading ? (
                  <TableRowsSkeleton rows={7} cols={9} />
                ) : sortedData.length === 0 ? (
                  <Empty className="py-12 border-0">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Inbox className="size-6 text-textMuted" />
                      </EmptyMedia>
                      <EmptyTitle className="text-textPrimary font-semibold">No industry details found</EmptyTitle>
                      <EmptyDescription className="text-textSecondary">
                        Industry overview records are currently empty.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <Table className="min-w-[800px]">
                    <TableHeader className="bg-surfaceMuted/20">
                      <TableRow className="border-b border-border/40">
                        <TableHead className="w-12 text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3">#</TableHead>
                        <TableHead 
                          onClick={() => handleSort('name')}
                          className="text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                        >
                          <div className="flex items-center">
                            Industry {renderSortIcon('name')}
                          </div>
                        </TableHead>
                        <TableHead 
                          onClick={() => handleSort('stocks')}
                          className="text-right text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                        >
                          <div className="flex items-center justify-end">
                            Stocks {renderSortIcon('stocks')}
                          </div>
                        </TableHead>
                        <TableHead 
                          onClick={() => handleSort('marketCapCr')}
                          className="text-right text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                        >
                          <div className="flex items-center justify-end">
                            Market Cap (Cr) {renderSortIcon('marketCapCr')}
                          </div>
                        </TableHead>
                        <TableHead 
                          onClick={() => handleSort('peRatio')}
                          className="text-right text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                        >
                          <div className="flex items-center justify-end">
                            P/E {renderSortIcon('peRatio')}
                          </div>
                        </TableHead>
                        <TableHead 
                          onClick={() => handleSort('pbRatio')}
                          className="text-right text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                        >
                          <div className="flex items-center justify-end">
                            P/B {renderSortIcon('pbRatio')}
                          </div>
                        </TableHead>
                        <TableHead 
                          onClick={() => handleSort('roePercent')}
                          className="text-right text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                        >
                          <div className="flex items-center justify-end">
                            ROE % {renderSortIcon('roePercent')}
                          </div>
                        </TableHead>
                        <TableHead 
                          onClick={() => handleSort('rocePct')}
                          className="text-right text-xs font-semibold text-textSecondary uppercase tracking-wider px-4 py-3 hover:text-accent cursor-pointer transition-colors select-none"
                        >
                          <div className="flex items-center justify-end">
                            ROCE % {renderSortIcon('rocePct')}
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
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedData.map((ind, idx) => {
                        const isPositive = ind.changePercent >= 0
                        const isSelected = selectedSector === ind.name
                        return (
                          <TableRow 
                            key={ind.name} 
                            onClick={() => setSelectedSector(ind.name)}
                            className={`cursor-pointer transition-colors border-b border-border/30 ${
                              isSelected ? 'bg-accentSoft/30 border-l-4 border-l-accent' : 'hover:bg-surfaceMuted/30'
                            }`}
                          >
                            <TableCell className="text-sm text-textMuted px-4 py-3">{idx + 1}</TableCell>
                            <TableCell className="text-sm font-semibold text-textPrimary px-4 py-3">{ind.name}</TableCell>
                            <TableCell className="text-right text-sm text-textPrimary px-4 py-3 tabular font-medium text-accent">{ind.stocks}</TableCell>
                            <TableCell className="text-right text-sm text-textPrimary px-4 py-3 tabular">
                              ₹{ind.marketCapCr.toLocaleString('en-IN')}
                            </TableCell>
                            <TableCell className="text-right text-sm text-textPrimary px-4 py-3 tabular">{ind.peRatio}</TableCell>
                            <TableCell className="text-right text-sm text-textPrimary px-4 py-3 tabular">{ind.pbRatio}</TableCell>
                            <TableCell className="text-right text-sm text-textPrimary px-4 py-3 tabular">{ind.roePercent}%</TableCell>
                            <TableCell className="text-right text-sm text-textPrimary px-4 py-3 tabular">{ind.rocePct}%</TableCell>
                            <TableCell className={`text-right text-sm font-semibold px-4 py-3 tabular ${
                              isPositive ? 'text-positive' : 'text-negative'
                            }`}>
                              {isPositive ? '+' : ''}{ind.changePercent}%
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
              {!loading && (
                <div className="px-4 py-3 text-xs text-textMuted border-t border-border/40 bg-surfaceMuted/10">
                  Showing {sortedData.length} industries · Click on an industry to explore companies.
                </div>
              )}
            </div>

            {/* Right: Company List inside Selected Sector */}
            <div className="bg-surface border border-border/40 rounded-xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <Heading level={3} className="text-sm font-bold uppercase tracking-wider text-textSecondary mb-4 flex items-center gap-1.5">
                  <Building2 className="size-4 text-accent" />
                  {selectedSector} Stocks
                </Heading>

                {companiesError ? (
                  <div className="text-xs text-red-500 bg-red-50 dark:bg-red-950/20 p-3 rounded-lg flex items-center justify-between">
                    <span>{companiesError}</span>
                    <button onClick={() => loadSectorCompanies(selectedSector)} className="hover:text-red-700">
                      <RefreshCw className="size-3.5" />
                    </button>
                  </div>
                ) : companiesLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full bg-surfaceMuted animate-pulse rounded-lg" />
                    <Skeleton className="h-10 w-full bg-surfaceMuted animate-pulse rounded-lg" />
                    <Skeleton className="h-10 w-full bg-surfaceMuted animate-pulse rounded-lg" />
                  </div>
                ) : sectorCompanies.length === 0 ? (
                  <div className="py-8 text-center text-xs text-textMuted border border-dashed border-border rounded-lg">
                    No active symbols found in this sector.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
                    {sectorCompanies.map((symbol) => (
                      <Link
                        key={symbol}
                        to={`/company/${symbol}`}
                        className="flex items-center justify-between p-2.5 rounded-lg border border-border/30 hover:border-accentSoft hover:bg-accentSoft/10 transition-all group"
                      >
                        <span className="text-xs font-bold text-textPrimary font-mono group-hover:text-accent transition-colors">{symbol}</span>
                        <ChevronRight className="size-3 text-textMuted group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {!companiesLoading && sectorCompanies.length > 0 && (
                <div className="text-[11px] text-textMuted pt-4 border-t border-border/40 mt-4">
                  Showing {sectorCompanies.length} constituents for {selectedSector}.
                </div>
              )}
            </div>

          </div>
        )}
      </div>
      <AppFooter />
    </div>
  )
}
// Module 3 now uses live FinEdge stock-symbols and stock-search.
