import React, { useState } from 'react'
import { useAppSelector } from '@/store/hooks'
import { ChevronDown, ChevronRight, BarChart3, Table2, FileSpreadsheet } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { balanceSheet, fiscalYears, type FinancialRow } from '@/lib/data/financials'
import { formatIndian, formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { exportToCSV } from '@/utils/csv'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts'

export function BalanceSheetTable() {
  const [expandedRows, setExpandedRows] = useState<{ [key: string]: boolean }>({})
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table')
  const storeBalanceSheet = useAppSelector((state) => state.company?.balanceSheet)
  const activeBalanceSheet = storeBalanceSheet || balanceSheet
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
    const headers = ['Balance Sheet Metric', ...fiscalYears]
    const csvRows: (string | number | null)[][] = []

    const addRow = (row: FinancialRow, depth = 0) => {
      const label = '  '.repeat(depth) + row.label
      csvRows.push([label, ...row.values])
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

  const chartData = fiscalYears.map((year, idx) => {
    return {
      year,
      Equity: equityRow ? equityRow.values[idx] : 0,
      Borrowings: borrowingsRow ? borrowingsRow.values[idx] : 0,
      'Other Liabilities': otherLiabilitiesRow ? otherLiabilitiesRow.values[idx] : 0,
    }
  })

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
      <div className="px-5 py-4 border-b border-border/50 flex flex-wrap items-center justify-between gap-3 bg-surfaceMuted/50">
        <div>
          <h3 className="text-sm font-bold text-textPrimary uppercase tracking-wide">
            Balance Sheet
          </h3>
          <p className="text-[11px] text-textMuted mt-0.5">
            Consolidated Figures in ₹ Crores
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Mode Segmented Controls */}
          <div className="flex items-center bg-surface border border-border rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('table')}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-colors',
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
                'flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-colors',
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
            className="flex items-center gap-1 px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[10px] font-bold uppercase tracking-wider text-textSecondary hover:text-textPrimary hover:bg-surfaceMuted transition-colors"
            title="Export Balance Sheet to CSV"
          >
            <FileSpreadsheet className="size-3 text-positive" /> Export
          </button>
        </div>
      </div>

      {viewMode === 'table' ? (
        <div className="overflow-x-auto">
          <Table className="min-w-[1000px]">
            <TableHeader className="bg-surfaceMuted">
              <TableRow>
                <TableHead className="sticky left-0 bg-surfaceMuted text-[10px] font-bold uppercase tracking-wider text-textMuted z-10">
                  Liabilities & Assets
                </TableHead>
                {fiscalYears.map((y) => (
                  <TableHead
                    key={y}
                    className="text-right text-[10px] font-bold uppercase tracking-wider text-textMuted font-mono"
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
                  tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `₹${formatNumber(v, 0)}`}
                />
                <Tooltip
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
                <Legend wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
                {/* Stacked liabilities mapping capital structure */}
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
