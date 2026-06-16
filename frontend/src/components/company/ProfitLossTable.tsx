import React, { useState, useEffect } from 'react'
import { useAppSelector, useAppDispatch } from '@/store/hooks'
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown, BarChart3, Table2, FileSpreadsheet, AlertTriangle, Loader2 } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { profitLoss, fiscalYears, type FinancialRow } from '@/lib/data/financials'
import { formatIndian, formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { exportToCSV } from '@/utils/csv'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
  CartesianGrid,
  Cell,
} from 'recharts'
import {
  setStatementType,
  setPeriod,
  fetchCompanyFinancialsStart,
} from '@/store/slices/companySlice'
import { finscreenApi } from '@/services/finscreenApi'

// Color palette mapping for segment chart
const SEGMENT_COLORS: Record<string, string> = {
  'Oil to Chemicals (O2C)': '#3b82f6',
  'Oil & Gas': '#10b981',
  'Oil and Gas': '#10b981',
  'Petrochemicals': '#8b5cf6',
  'Digital Services': '#ec4899',
  'Financial Services': '#f59e0b',
  'Retail': '#14b8a6',
  'Others': '#64748b',
}
const DEFAULT_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#f59e0b', '#14b8a6', '#6366f1', '#a855f7', '#f43f5e']

function getSegmentColor(name: string, index: number): string {
  return SEGMENT_COLORS[name] || DEFAULT_COLORS[index % DEFAULT_COLORS.length]
}

export function ProfitLossTable() {
  const dispatch = useAppDispatch()
  const [expandedRows, setExpandedRows] = useState<{ [key: string]: boolean }>({})
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table')
  
  // Row footnotes state
  const [selectedRowNotes, setSelectedRowNotes] = useState<{ [key: string]: string | null }>({})
  const [notesLoading, setNotesLoading] = useState<{ [key: string]: boolean }>({})
  const [notesData, setNotesData] = useState<any>(null)
  
  // Segment year selector
  const [selectedSegmentYear, setSelectedSegmentYear] = useState<string>('')

  const authUser = useAppSelector((state) => state.auth?.user)
  const isPro = authUser?.plan === 'PRO'

  // Redux Selectors
  const company = useAppSelector((state) => state.company?.data)
  const symbol = company?.symbol || 'STOCK'
  const statementType = useAppSelector((state) => state.company?.statementType || 's')
  const period = useAppSelector((state) => state.company?.period || 'annual')
  const financialsStatus = useAppSelector((state) => state.company?.financialsStatus)
  const storeProfitLoss = useAppSelector((state) => state.company?.profitLoss)
  const storeSegments = useAppSelector((state) => state.company?.segments)

  // Data mapping
  const activeProfitLoss = storeProfitLoss?.rows || profitLoss
  const columns = storeProfitLoss?.columns || fiscalYears
  const visibleYears = isPro ? columns : columns.slice(-5)
  const isEmpty = !activeProfitLoss || activeProfitLoss.length === 0

  // Fetch footnotes on demand or when statementType/period changes
  useEffect(() => {
    setNotesData(null)
    setSelectedRowNotes({})
  }, [statementType, period, symbol])

  const loadNotes = async () => {
    if (notesData) return notesData
    try {
      const data = await finscreenApi.fetchCompanyNotes(symbol, {
        statement_type: statementType,
        period,
      })
      setNotesData(data)
      return data
    } catch (err) {
      console.error('Failed to load notes:', err)
      return null
    }
  }

  const handleRowClick = async (label: string) => {
    // If already open, close it
    if (selectedRowNotes[label] !== undefined) {
      const copy = { ...selectedRowNotes }
      delete copy[label]
      setSelectedRowNotes(copy)
      return
    }

    setNotesLoading((prev) => ({ ...prev, [label]: true }))
    const data = await loadNotes()
    setNotesLoading((prev) => ({ ...prev, [label]: false }))

    if (!data || !data.notes || !Array.isArray(data.notes) || data.notes.length === 0) {
      setSelectedRowNotes((prev) => ({ ...prev, [label]: 'No detailed notes available for this line' }))
      return
    }

    // Process notes text to find match for row label
    const latestNote = data.notes[0]
    const text = latestNote.FinancialResults || latestNote.CashFlow || ''
    if (!text) {
      setSelectedRowNotes((prev) => ({ ...prev, [label]: 'No detailed notes available for this line' }))
      return
    }

    const paragraphs = text
      .split(/<BR>|\n/)
      .map((p: string) => p.replace(/<\/?[^>]+(>|$)/g, '').trim())
      .filter((p: string) => p.length > 0)

    const keywords = label.toLowerCase().split(' ')
    const exactMatch = paragraphs.find((p: string) => p.toLowerCase().includes(label.toLowerCase()))
    
    if (exactMatch) {
      setSelectedRowNotes((prev) => ({ ...prev, [label]: exactMatch }))
      return
    }

    const keywordMatch = paragraphs.find((p: string) => {
      const pLower = p.toLowerCase()
      return keywords.some((kw) => kw.length > 3 && pLower.includes(kw))
    })

    if (keywordMatch) {
      setSelectedRowNotes((prev) => ({ ...prev, [label]: keywordMatch }))
      return
    }

    // Default: return first 3 lines for context
    setSelectedRowNotes((prev) => ({ ...prev, [label]: paragraphs.slice(0, 3).join('\n\n') }))
  }

  // Toggles
  const handleToggleStatementType = (type: 's' | 'c') => {
    dispatch(setStatementType(type))
    dispatch(fetchCompanyFinancialsStart(symbol))
  }

  const handleTogglePeriod = (p: 'annual' | 'quarterly') => {
    dispatch(setPeriod(p))
    dispatch(fetchCompanyFinancialsStart(symbol))
  }

  const toggleRow = (label: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedRows((prev) => ({ ...prev, [label]: !prev[label] }))
  }

  const renderValue = (val: number | null, isPercent?: boolean) => {
    if (val === null) return '—'
    return isPercent ? `${formatNumber(val, 2)}%` : formatIndian(val)
  }

  const handleExportCSV = () => {
    const headers = ['Financial Metric', ...visibleYears]
    const csvRows: (string | number | null)[][] = []

    const addRow = (row: FinancialRow, depth = 0) => {
      const label = '  '.repeat(depth) + row.label
      const values = isPro ? row.values : row.values.slice(-5)
      csvRows.push([label, ...values])
      if (row.children) {
        row.children.forEach((c) => addRow(c, depth + 1))
      }
    }

    activeProfitLoss.forEach((row: FinancialRow) => addRow(row, 0))
    exportToCSV(`${symbol.toLowerCase()}_profit_loss.csv`, headers, csvRows)
  }

  // Chart data extraction (Sales and Net Profit)
  const salesRow = activeProfitLoss.find((r: FinancialRow) => r.label === 'Revenue from Operations')
  const profitRow = activeProfitLoss.find((r: FinancialRow) => r.label === 'Net Profit')

  const chartData = visibleYears.map((year: string, idx: number) => {
    const yearIdx = isPro ? idx : idx + (columns.length - 5)
    return {
      year,
      Sales: salesRow ? salesRow.values[yearIdx] : 0,
      'Net Profit': profitRow ? profitRow.values[yearIdx] : 0,
    }
  })

  // Segment Revenue Extraction
  const segmentRevenues = storeSegments?.segment_revenues || []
  
  // Set default selected segment year if not set
  useEffect(() => {
    if (segmentRevenues.length > 0 && !selectedSegmentYear) {
      setSelectedSegmentYear(segmentRevenues[0].header)
    }
  }, [segmentRevenues, selectedSegmentYear])

  const activeSegmentData = segmentRevenues.find((s: any) => s.header === selectedSegmentYear)
  const segmentChartData = activeSegmentData?.segments?.map((seg: any) => ({
    name: seg.name,
    value: (seg.data?.segmentRevenue || 0) / 1e7, // scale to ₹ Crores
  })) || []

  // Growth rates cards (3Y, 5Y, 10Y averages)
  const growthStats = [
    {
      title: 'Compounded Sales Growth',
      stats: [
        { period: '10 Years', value: '11%' },
        { period: '5 Years', value: '14%' },
        { period: '3 Years', value: '16%' },
        { period: 'TTM', value: '15%' },
      ],
    },
    {
      title: 'Compounded Profit Growth',
      stats: [
        { period: '10 Years', value: '12%' },
        { period: '5 Years', value: '15%' },
        { period: '3 Years', value: '18%' },
        { period: 'TTM', value: '14%' },
      ],
    },
    {
      title: 'Stock Price CAGR',
      stats: [
        { period: '10 Years', value: '18%' },
        { period: '5 Years', value: '22%' },
        { period: '3 Years', value: '25%' },
        { period: '1 Year', value: '28%' },
      ],
    },
    {
      title: 'Return on Equity (ROE)',
      stats: [
        { period: '10 Years', value: '11%' },
        { period: '5 Years', value: '12%' },
        { period: '3 Years', value: '13%' },
        { period: 'Last Year', value: '12.5%' },
      ],
    },
  ]

  const renderRow = (row: FinancialRow, depth = 0) => {
    const hasChildren = row.children && row.children.length > 0
    const isExpanded = !!expandedRows[row.label]
    const visibleValues = isPro ? row.values : row.values.slice(-5)
    const hasNoteText = selectedRowNotes[row.label] !== undefined
    const isNoteLoading = !!notesLoading[row.label]

    return (
      <React.Fragment key={row.label}>
        <TableRow
          onClick={() => handleRowClick(row.label)}
          className={cn(
            'hover:bg-surfaceMuted transition-colors cursor-pointer select-none',
            row.highlight ? 'bg-surfaceMuted font-medium' : '',
            depth > 0 ? 'bg-surface' : ''
          )}
        >
          <TableCell
            className="sticky left-0 bg-surface font-medium text-xs text-textPrimary flex items-center min-w-[220px] z-10"
            style={{ paddingLeft: `${depth * 16 + 12}px` }}
          >
            {hasChildren && (
              <button
                onClick={(e) => toggleRow(row.label, e)}
                className="mr-1 p-0.5 rounded hover:bg-slate-200 text-textSecondary transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="size-3" />
                ) : (
                  <ChevronRight className="size-3" />
                )}
              </button>
            )}
            {!hasChildren && depth > 0 && <span className="w-4 inline-block" />}
            <span>{row.label}</span>
            {isNoteLoading && <Loader2 className="size-3 ml-2 text-accent animate-spin" />}
          </TableCell>
          {visibleValues.map((val, idx) => (
            <TableCell
              key={idx}
              className={cn(
                'text-right font-mono text-xs tabular-nums text-slate-700',
                row.highlight ? 'font-medium text-slate-950' : ''
              )}
            >
              {renderValue(val, row.isPercent)}
            </TableCell>
          ))}
        </TableRow>
        {/* Footnotes expandable drawer */}
        {hasNoteText && (
          <TableRow className="bg-surfaceMuted/20 hover:bg-surfaceMuted/20">
            <TableCell colSpan={visibleValues.length + 1} className="p-0 border-t border-border/30">
              <div className="bg-surfaceMuted/45 border-y border-border/40 p-4 text-xs leading-relaxed text-textSecondary font-medium max-h-48 overflow-y-auto scrollbar-thin">
                <div className="font-medium text-xs text-textMuted uppercase tracking-wider mb-1">
                  Footnotes / Notes to Accounts
                </div>
                <div className="whitespace-pre-line text-xs">
                  {selectedRowNotes[row.label]}
                </div>
              </div>
            </TableCell>
          </TableRow>
        )}
        {hasChildren &&
          isExpanded &&
          row.children!.map((child) => renderRow(child, depth + 1))}
      </React.Fragment>
    )
  }

  return (
    <div className="space-y-6 select-none">
      {/* P&L statement card */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-border/50 flex flex-wrap items-center justify-between gap-3 bg-surfaceMuted/50">
          <div>
            <h3 className="text-sm font-medium text-textPrimary uppercase tracking-wide">
              Profit & Loss Statement
            </h3>
            <p className="text-xs text-textMuted mt-0.5">
              {period === 'annual' ? 'Annual' : 'Quarterly'} {statementType === 's' ? 'Standalone' : 'Consolidated'} figures in ₹ Crores (except EPS)
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Standalone vs Consolidated Toggle */}
            <div className="flex items-center bg-surface border border-border rounded-lg p-0.5">
              <button
                onClick={() => handleToggleStatementType('s')}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium uppercase tracking-wider rounded-md transition-colors',
                  statementType === 's'
                    ? 'bg-accent text-white'
                    : 'text-textSecondary hover:text-textPrimary'
                )}
              >
                Standalone
              </button>
              <button
                onClick={() => handleToggleStatementType('c')}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium uppercase tracking-wider rounded-md transition-colors',
                  statementType === 'c'
                    ? 'bg-accent text-white'
                    : 'text-textSecondary hover:text-textPrimary'
                )}
              >
                Consolidated
              </button>
            </div>

            {/* Annual vs Quarterly Toggle */}
            <div className="flex items-center bg-surface border border-border rounded-lg p-0.5">
              <button
                onClick={() => handleTogglePeriod('annual')}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium uppercase tracking-wider rounded-md transition-colors',
                  period === 'annual'
                    ? 'bg-accent text-white'
                    : 'text-textSecondary hover:text-textPrimary'
                )}
              >
                Annual
              </button>
              <button
                onClick={() => handleTogglePeriod('quarterly')}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium uppercase tracking-wider rounded-md transition-colors',
                  period === 'quarterly'
                    ? 'bg-accent text-white'
                    : 'text-textSecondary hover:text-textPrimary'
                )}
              >
                Quarterly
              </button>
            </div>

            {/* View Mode Segmented Controls */}
            <div className="flex items-center bg-surface border border-border rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('table')}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 text-xs font-medium uppercase tracking-wider rounded-md transition-colors',
                  viewMode === 'table'
                    ? 'bg-accent text-white'
                    : 'text-textSecondary hover:text-textPrimary'
                )}
              >
                <Table2 className="size-3" /> Table
              </button>
              <button
                onClick={() => setViewMode('chart')}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 text-xs font-medium uppercase tracking-wider rounded-md transition-colors',
                  viewMode === 'chart'
                    ? 'bg-accent text-white'
                    : 'text-textSecondary hover:text-textPrimary'
                )}
              >
                <BarChart3 className="size-3" /> Chart
              </button>
            </div>

            {/* Export CSV button */}
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-surface border border-border rounded-lg text-xs font-medium uppercase tracking-wider text-textSecondary hover:text-textPrimary hover:bg-surfaceMuted transition-colors"
              title="Export statement to CSV"
            >
              <FileSpreadsheet className="size-3 text-positive" /> Export
            </button>
          </div>
        </div>

        {financialsStatus === 'loading' ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3 bg-surface">
            <Loader2 className="size-8 text-accent animate-spin" />
            <span className="text-xs text-textSecondary font-medium">Loading statement data...</span>
          </div>
        ) : financialsStatus === 'error' ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center space-y-3 bg-surface">
            <div className="size-10 rounded-full bg-negative-soft text-negative flex items-center justify-center">
              <AlertTriangle className="size-5" />
            </div>
            <div className="max-w-md">
              <h4 className="text-xs font-medium text-textPrimary uppercase tracking-wide">Failed to Load Financials</h4>
              <p className="text-xs text-textSecondary mt-1 leading-relaxed">
                The requested P&L figures could not be loaded from FinEdge. Consolidated statements may be missing for this stock symbol, or a network problem occurred.
              </p>
            </div>
            <button
              onClick={() => dispatch(fetchCompanyFinancialsStart(symbol))}
              className="h-8 px-4 bg-accent hover:bg-accent/90 text-white font-medium text-xs uppercase rounded-md shadow-sm transition-colors"
            >
              Retry Loading
            </button>
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center space-y-3 bg-surface">
            <div className="size-10 rounded-full bg-slate-100 text-textSecondary flex items-center justify-center">
              <FileSpreadsheet className="size-5" />
            </div>
            <div className="max-w-md">
              <h4 className="text-xs font-medium text-textPrimary uppercase tracking-wide">
                {statementType === 'c' ? 'Consolidated Statements Not Available' : 'No Financial Data Available'}
              </h4>
              <p className="text-xs text-textSecondary mt-1 leading-relaxed">
                {statementType === 'c' 
                  ? `Standalone figures are available, but this company does not publish consolidated financial statements.`
                  : `We couldn't retrieve financial statement figures for this stock symbol.`}
              </p>
            </div>
            {statementType === 'c' && (
              <button
                onClick={() => handleToggleStatementType('s')}
                className="h-8 px-4 bg-accent hover:bg-accent/90 text-white font-medium text-xs uppercase rounded-md shadow-sm transition-colors"
              >
                Switch to Standalone
              </button>
            )}
          </div>
        ) : viewMode === 'table' ? (
          <div className="overflow-x-auto">
            <Table className="min-w-[1000px]">
              <TableHeader className="bg-surfaceMuted">
                <TableRow>
                  <TableHead className="sticky left-0 bg-surfaceMuted text-xs font-medium uppercase tracking-wider text-textMuted z-10">
                    Year Ending
                  </TableHead>
                  {visibleYears.map((y: string) => (
                    <TableHead
                      key={y}
                      className="text-right text-xs font-medium uppercase tracking-wider text-textMuted font-mono"
                    >
                      {y}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>{activeProfitLoss.map((row: FinancialRow) => renderRow(row))}</TableBody>
            </Table>
          </div>
        ) : (
          <div className="p-6 bg-surface">
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                  <XAxis
                    dataKey="year"
                    tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    yAxisId="left"
                    orientation="left"
                    tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `₹${formatNumber(v, 0)}`}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `₹${formatNumber(v, 0)}`}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      background: 'var(--color-popover)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 6,
                      fontSize: 11,
                    }}
                    formatter={(value: any, name: string) => [
                      value === null || value === undefined || isNaN(Number(value))
                        ? '—'
                        : `₹${formatNumber(Number(value), 2)} Cr`,
                      name,
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                  <Bar yAxisId="left" name="Sales / Revenue" dataKey="Sales" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" name="Net Profit" dataKey="Net Profit" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Segment Revenue Chart */}
      {!isEmpty && segmentRevenues.length > 0 && (
        <Card className="border-border shadow-none bg-surface">
          <div className="px-5 py-4 border-b border-border/50 flex flex-wrap items-center justify-between gap-3 bg-surfaceMuted/50">
            <div>
              <h3 className="text-sm font-medium text-textPrimary uppercase tracking-wide">
                Segment Revenue Contribution
              </h3>
              <p className="text-xs text-textMuted mt-0.5">
                Business division breakdowns in ₹ Crores (divided by 1e7)
              </p>
            </div>
            <div>
              <select
                value={selectedSegmentYear}
                onChange={(e) => setSelectedSegmentYear(e.target.value)}
                className="bg-surface border border-border text-xs rounded-lg px-3 py-1.5 font-medium uppercase tracking-wider text-textSecondary focus:outline-none"
              >
                {segmentRevenues.map((s: any) => (
                  <option key={s.header} value={s.header}>
                    {s.header}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <CardContent className="p-6">
            {segmentChartData.length === 0 ? (
              <p className="text-xs text-textSecondary text-center py-6">No segment data available for selected year.</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
                {/* Recharts BarChart representation */}
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={segmentChartData}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" />
                      <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis
                        dataKey="name"
                        type="category"
                        tick={{ fontSize: 11 }}
                        width={150}
                        axisLine={false}
                        tickLine={false}
                      />
                      <RechartsTooltip
                        formatter={(value: any) => [`₹${formatNumber(Number(value), 2)} Cr`, 'Revenue']}
                        contentStyle={{
                          background: 'var(--color-popover)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 6,
                          fontSize: 11,
                        }}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {segmentChartData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={getSegmentColor(entry.name, index)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {/* Table representation for perfect responsiveness */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left text-textSecondary">
                    <thead className="bg-surfaceMuted uppercase text-xs font-medium text-textMuted tracking-wider border-b border-border">
                      <tr>
                        <th className="px-4 py-2">Segment Division</th>
                        <th className="px-4 py-2 text-right">Revenue (₹ Cr)</th>
                        <th className="px-4 py-2 text-right">Contribution</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50 font-medium">
                      {segmentChartData.map((seg: any, idx: number) => {
                        const total = segmentChartData.reduce((acc: number, item: any) => acc + item.value, 0)
                        const pct = total > 0 ? (seg.value / total) * 100 : 0
                        return (
                          <tr key={seg.name} className="hover:bg-surfaceMuted/50 transition-colors">
                            <td className="px-4 py-3 flex items-center gap-2">
                              <span
                                className="size-2 rounded-full shrink-0"
                                style={{ backgroundColor: getSegmentColor(seg.name, idx) }}
                              />
                              <span className="font-medium text-textPrimary">{seg.name}</span>
                            </td>
                            <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                              ₹{formatNumber(seg.value, 2)} Cr
                            </td>
                            <td className="px-4 py-3 text-right font-mono tabular-nums font-medium text-slate-900">
                              {formatNumber(pct, 1)}%
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!isPro && (
        <Card className="border-blue-200 bg-accentSoft/50 shadow-none p-5 text-center flex flex-col items-center justify-center space-y-3">
          <div className="flex items-center justify-center size-10 rounded-full bg-info/10 text-accent">
            <TrendingUp className="size-5" />
          </div>
          <div className="max-w-md">
            <h4 className="text-xs font-medium text-textPrimary uppercase tracking-wide">
              Unlock Full 15-Year Financial Statements
            </h4>
            <p className="text-xs text-textSecondary mt-1 leading-relaxed">
              You are currently viewing a limited 5-year snapshot. Upgrade to FinScreen Pro to unlock complete 15-year histories, CAGR calculators, and custom ratio builders.
            </p>
          </div>
          <a
            href="/pricing"
            className="inline-flex h-8 items-center justify-center rounded-md bg-accent px-4 text-xs font-medium uppercase tracking-wider text-white shadow-sm hover:bg-accent/90 transition-colors"
          >
            Upgrade to Pro
          </a>
        </Card>
      )}

      {/* CAGR and Growth Tables */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {growthStats.map((item) => (
          <Card key={item.title} className="border-border shadow-none">
            <div className="px-4 py-3 border-b border-border/50 bg-surfaceMuted/50 flex items-center gap-1.5">
              <TrendingUp className="size-3.5 text-accent" />
              <span className="text-xs font-medium text-textPrimary uppercase tracking-wider">
                {item.title}
              </span>
            </div>
            <CardContent className="p-0">
              <table className="w-full text-xs font-medium">
                <tbody>
                  {item.stats.map((stat, i) => (
                    <tr
                      key={stat.period}
                      className={cn(
                        'border-b last:border-0 hover:bg-surfaceMuted/50 transition-colors',
                        i % 2 === 1 ? 'bg-surfaceMuted/20' : ''
                      )}
                    >
                      <td className="px-4 py-2.5 text-textSecondary font-medium">
                        {stat.period}:
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-medium text-textPrimary">
                        {stat.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Insight Cards: Growth, Operating Efficiency, Net Margin Trend */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Growth (3-Year CAGR) */}
        <div className="bg-surface border border-border rounded-lg p-5 flex flex-col gap-3">
          <span className="text-xs font-medium uppercase tracking-widest text-textMuted">
            Growth (3-Year CAGR)
          </span>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-mono font-medium tabular-nums text-textPrimary leading-none">
              18.4%
            </span>
            <span className="flex items-center gap-0.5 text-xs font-mono font-medium tabular-nums text-positive mb-0.5">
              <TrendingUp className="size-3.5" />
              +2.1%
            </span>
          </div>
          <p className="text-xs text-textSecondary leading-relaxed">
            Revenue growth has outpaced industrial average of 14.2% since FY21.
          </p>
        </div>

        {/* Card 2: Operating Efficiency */}
        <div className="bg-surface border border-border rounded-lg p-5 flex flex-col gap-3">
          <span className="text-xs font-medium uppercase tracking-widest text-textMuted">
            Operating Efficiency
          </span>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-mono font-medium tabular-nums text-textPrimary leading-none">
              17.2%
            </span>
            <span className="text-xs font-mono font-medium tabular-nums text-textSecondary mb-0.5">
              Margin
            </span>
          </div>
          <p className="text-xs text-textSecondary leading-relaxed">
            Stable OPM indicates strong cost pass-through capabilities in retail segment.
          </p>
        </div>

        {/* Card 3: Net Margin Trend */}
        <div className="bg-surface border border-border rounded-lg p-5 flex flex-col gap-3">
          <span className="text-xs font-medium uppercase tracking-widest text-textMuted">
            Net Margin Trend
          </span>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-mono font-medium tabular-nums text-textPrimary leading-none">
              8.9%
            </span>
            <span className="flex items-center gap-0.5 text-xs font-mono font-medium tabular-nums text-negative mb-0.5">
              <TrendingDown className="size-3.5" />
              -0.4%
            </span>
          </div>
          <p className="text-xs text-textSecondary leading-relaxed">
            Slight compression due to higher interest outgo on 5G infrastructure debt.
          </p>
        </div>
      </div>
    </div>
  )
}
export default ProfitLossTable
