import React, { useState, useEffect } from 'react'
import { useAppSelector, useAppDispatch } from '@/store/hooks'
import { ChevronDown, ChevronRight, BarChart3, Table2, FileSpreadsheet, AlertTriangle, Loader2 } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { FinancialRow } from '@/lib/data/financials'
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
} from 'recharts'
import {
  setStatementType,
  setPeriod,
  fetchCompanyFinancialsStart,
} from '@/store/slices/companySlice'
import { finscreenApi } from '@/services/finscreenApi'

export function BalanceSheetTable() {
  const dispatch = useAppDispatch()
  const [expandedRows, setExpandedRows] = useState<{ [key: string]: boolean }>({})
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table')
  
  // Footnotes state
  const [selectedRowNotes, setSelectedRowNotes] = useState<{ [key: string]: string | null }>({})
  const [notesLoading, setNotesLoading] = useState<{ [key: string]: boolean }>({})
  const [notesData, setNotesData] = useState<any>(null)

  const authUser = useAppSelector((state) => state.auth?.user)
  const isPro = authUser?.plan === 'PRO'

  // Redux Selectors
  const company = useAppSelector((state) => state.company?.data)
  const symbol = company?.symbol || 'STOCK'
  const statementType = useAppSelector((state) => state.company?.statementType || 's')
  const period = useAppSelector((state) => state.company?.period || 'annual')
  const financialsStatus = useAppSelector((state) => state.company?.financialsStatus)
  const storeBalanceSheet = useAppSelector((state) => state.company?.balanceSheet)

  // Data mapping — show empty arrays while API loads (triggers existing loading/isEmpty states)
  const activeBalanceSheet = storeBalanceSheet?.rows || []
  const columns = storeBalanceSheet?.columns || []
  const visibleYears = isPro ? columns : columns.slice(-5)
  const isEmpty = !activeBalanceSheet || activeBalanceSheet.length === 0

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
    const headers = ['Balance Sheet Metric', ...visibleYears]
    const csvRows: (string | number | null)[][] = []

    const addRow = (row: FinancialRow, depth = 0) => {
      const label = '  '.repeat(depth) + row.label
      const values = isPro ? row.values : row.values.slice(-5)
      csvRows.push([label, ...values])
      if (row.children) {
        row.children.forEach((c) => addRow(c, depth + 1))
      }
    }

    activeBalanceSheet.forEach((row: FinancialRow) => addRow(row, 0))
    exportToCSV(`${symbol.toLowerCase()}_balance_sheet.csv`, headers, csvRows)
  }

  // Chart data extraction (Capital Structure Liabilities Composition)
  const equityRow = activeBalanceSheet.find((r: FinancialRow) => r.label === 'Total Equity (Net Worth)')
  const borrowingsRow = activeBalanceSheet.find((r: FinancialRow) => r.label === 'Total Borrowings')
  const otherLiabilitiesRow = activeBalanceSheet.find((r: FinancialRow) => r.label === 'Other Liabilities')

  const chartData = visibleYears.map((year: string, idx: number) => {
    const yearIdx = isPro ? idx : idx + (columns.length - 5)
    return {
      year,
      Equity: equityRow ? equityRow.values[yearIdx] : 0,
      Borrowings: borrowingsRow ? borrowingsRow.values[yearIdx] : 0,
      'Other Liabilities': otherLiabilitiesRow ? otherLiabilitiesRow.values[yearIdx] : 0,
    }
  })

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
    <div className="bg-surface border border-border rounded-lg overflow-hidden select-none">
      <div className="px-5 py-4 border-b border-border/50 flex flex-wrap items-center justify-between gap-3 bg-surfaceMuted/50">
        <div>
          <h3 className="text-sm font-medium text-textPrimary uppercase tracking-wide">
            Balance Sheet
          </h3>
          <p className="text-xs text-textMuted mt-0.5">
            {period === 'annual' ? 'Annual' : 'Quarterly'} {statementType === 's' ? 'Standalone' : 'Consolidated'} figures in ₹ Crores
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
            title="Export Balance Sheet to CSV"
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
              The requested Balance Sheet figures could not be loaded from FinEdge. Consolidated statements may be missing for this stock symbol, or a network problem occurred.
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
                  Liabilities & Assets
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
            <TableBody>{activeBalanceSheet.map((row: FinancialRow) => renderRow(row))}</TableBody>
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
                <Bar dataKey="Equity" stackId="a" fill="#3b82f6" name="Equity (Net Worth)" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Borrowings" stackId="a" fill="#ef4444" name="Total Borrowings" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Other Liabilities" stackId="a" fill="#f59e0b" name="Other Liabilities" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
export default BalanceSheetTable
