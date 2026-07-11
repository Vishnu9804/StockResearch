import React, { useState, useEffect } from 'react'
import { useAppSelector, useAppDispatch } from '@/store/hooks'
import { ChevronDown, ChevronRight, FileSpreadsheet } from 'lucide-react'
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
import { fetchQuarterlyResults } from '@/store/slices/companySlice'
import { TableRowsSkeleton } from '@/components/ui/SkeletonLoader'

export function QuarterlyResultsTable() {
  const dispatch = useAppDispatch()
  const [expandedRows, setExpandedRows] = useState<{ [key: string]: boolean }>({})
  const storeQuarterly = useAppSelector((state) => (state.company as any)?.quarterly)
  const { financialsStatus, financialsError } = useAppSelector((state) => state.company)
  const company = useAppSelector((state) => state.company?.data)
  const symbol = company?.symbol || 'STOCK'

  useEffect(() => {
    if (symbol && symbol !== 'STOCK') {
      fetchQuarterlyResults(symbol)(dispatch)
    }
  }, [symbol, dispatch])

  // Data mapping — show empty arrays while API loads
  const columnsList = storeQuarterly?.columns || []
  const rowsList = storeQuarterly?.rows || []

  const toggleRow = (label: string) => {
    setExpandedRows((prev) => ({ ...prev, [label]: !prev[label] }))
  }

  const renderValue = (val: number | null, isPercent?: boolean) => {
    if (val === null) return '—'
    return isPercent ? `${formatNumber(val, 2)}%` : formatIndian(val)
  }

  const handleExportCSV = () => {
    const headers = ['Quarter Ending', ...columnsList]
    const csvRows: (string | number | null)[][] = []

    const addRow = (row: FinancialRow, depth = 0) => {
      const label = '  '.repeat(depth) + row.label
      csvRows.push([label, ...row.values])
      if (row.children) {
        row.children.forEach((c) => addRow(c, depth + 1))
      }
    }

    rowsList.forEach((row: FinancialRow) => addRow(row, 0))
    exportToCSV(`${symbol.toLowerCase()}_quarterly_results.csv`, headers, csvRows)
  }

  const renderRow = (row: FinancialRow, depth = 0) => {
    const hasChildren = row.children && row.children.length > 0
    const isExpanded = !!expandedRows[row.label]

    return (
      <React.Fragment key={row.label}>
        <TableRow
          className={cn(
            'hover:bg-surfaceMuted transition-colors',
            row.highlight ? 'bg-surfaceMuted font-medium' : '',
            depth > 0 ? 'bg-surface' : ''
          )}
        >
          <TableCell
            className="sticky left-0 bg-surface font-medium text-xs text-textPrimary flex items-center min-w-[200px] z-10"
            style={{ paddingLeft: `${depth * 16 + 12}px` }}
          >
            {hasChildren && (
              <button
                onClick={() => toggleRow(row.label)}
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
            {row.label}
          </TableCell>
          {row.values.map((val, idx) => (
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
        {hasChildren &&
          isExpanded &&
          row.children!.map((child) => renderRow(child, depth + 1))}
      </React.Fragment>
    )
  }

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden select-none">
      <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between bg-surfaceMuted/50">
        <div>
          <h3 className="text-sm font-medium text-textPrimary uppercase tracking-wide">
            Quarterly Results
          </h3>
          <p className="text-xs text-textMuted mt-0.5">
            Consolidated Figures in ₹ Crores (except EPS)
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={financialsStatus === 'loading' || financialsStatus === 'error'}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-surface border border-border rounded-lg text-xs font-medium uppercase tracking-wider text-textSecondary hover:text-textPrimary hover:bg-surfaceMuted transition-colors disabled:opacity-50"
          title="Export quarterly results to CSV"
        >
          <FileSpreadsheet className="size-3 text-positive" /> Export
        </button>
      </div>

      <div className="overflow-x-auto">
        {financialsStatus === 'loading' ? (
          <div className="p-5">
            <TableRowsSkeleton rows={6} cols={columnsList.length + 1} />
          </div>
        ) : financialsStatus === 'error' ? (
          <div className="p-8 text-center">
            <p className="text-sm text-destructive font-medium mb-3">
              {financialsError || 'Failed to load quarterly results'}
            </p>
            <button
              onClick={() => fetchQuarterlyResults(symbol)(dispatch)}
              className="px-4 py-2 bg-secondary rounded-lg text-xs font-semibold hover:bg-secondary/80 transition-colors border"
            >
              Retry
            </button>
          </div>
        ) : (
          <Table className="min-w-[800px]">
            <TableHeader className="bg-surfaceMuted">
              <TableRow>
                <TableHead className="sticky left-0 bg-surfaceMuted text-xs font-medium uppercase tracking-wider text-textMuted z-10">
                  Quarter Ending
                </TableHead>
                {columnsList.map((q: string) => (
                  <TableHead
                    key={q}
                    className="text-right text-xs font-medium uppercase tracking-wider text-textMuted font-mono"
                  >
                    {q}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>{rowsList.map((row: FinancialRow) => renderRow(row))}</TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
export default QuarterlyResultsTable
