import React, { useState } from 'react'
import { useAppSelector } from '@/store/hooks'
import { ChevronDown, ChevronRight, FileSpreadsheet } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { quarterlyResults, quarters, type FinancialRow } from '@/lib/data/financials'
import { formatIndian, formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { exportToCSV } from '@/utils/csv'

export function QuarterlyResultsTable() {
  const [expandedRows, setExpandedRows] = useState<{ [key: string]: boolean }>({})
  const storeQuarterly = useAppSelector((state) => (state.company as any)?.quarterly)
  const activeQuarterly = storeQuarterly || quarterlyResults
  const company = useAppSelector((state) => state.company?.data)
  const symbol = company?.symbol || 'STOCK'

  const toggleRow = (label: string) => {
    setExpandedRows((prev) => ({ ...prev, [label]: !prev[label] }))
  }

  const renderValue = (val: number | null, isPercent?: boolean) => {
    if (val === null) return '—'
    return isPercent ? `${formatNumber(val, 2)}%` : formatIndian(val)
  }

  const handleExportCSV = () => {
    const headers = ['Quarter Ending', ...quarters]
    const csvRows: (string | number | null)[][] = []

    const addRow = (row: FinancialRow, depth = 0) => {
      const label = '  '.repeat(depth) + row.label
      csvRows.push([label, ...row.values])
      if (row.children) {
        row.children.forEach((c) => addRow(c, depth + 1))
      }
    }

    activeQuarterly.forEach((row: FinancialRow) => addRow(row, 0))
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
            row.highlight ? 'bg-surfaceMuted font-bold' : '',
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
                row.highlight ? 'font-bold text-slate-950' : ''
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
          <h3 className="text-sm font-bold text-textPrimary uppercase tracking-wide">
            Quarterly Results
          </h3>
          <p className="text-[11px] text-textMuted mt-0.5">
            Consolidated Figures in ₹ Crores (except EPS)
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[10px] font-bold uppercase tracking-wider text-textSecondary hover:text-textPrimary hover:bg-surfaceMuted transition-colors"
          title="Export quarterly results to CSV"
        >
          <FileSpreadsheet className="size-3 text-positive" /> Export
        </button>
      </div>

      <div className="overflow-x-auto">
        <Table className="min-w-[800px]">
          <TableHeader className="bg-surfaceMuted">
            <TableRow>
              <TableHead className="sticky left-0 bg-surfaceMuted text-[10px] font-bold uppercase tracking-wider text-textMuted z-10">
                Quarter Ending
              </TableHead>
              {quarters.map((q) => (
                <TableHead
                  key={q}
                  className="text-right text-[10px] font-bold uppercase tracking-wider text-textMuted font-mono"
                >
                  {q}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>{activeQuarterly.map((row: FinancialRow) => renderRow(row))}</TableBody>
        </Table>
      </div>
    </div>
  )
}
export default QuarterlyResultsTable
