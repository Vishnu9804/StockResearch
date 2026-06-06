'use client'

import { useState } from 'react'
import { useSelector } from 'react-redux'
import { ChevronDown, ChevronRight } from 'lucide-react'
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

export function BalanceSheetTable() {
  const [expandedRows, setExpandedRows] = useState<{ [key: string]: boolean }>({})
  const storeBalanceSheet = useSelector((state: any) => state.company?.balanceSheet)
  const activeBalanceSheet = storeBalanceSheet || balanceSheet

  const toggleRow = (label: string) => {
    setExpandedRows((prev) => ({ ...prev, [label]: !prev[label] }))
  }

  const renderValue = (val: number | null, isPercent?: boolean) => {
    if (val === null) return '—'
    return isPercent ? `${formatNumber(val, 2)}%` : formatIndian(val)
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
            className="sticky left-0 bg-surface font-medium text-xs text-textPrimary flex items-center min-w-[200px]"
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
            Balance Sheet
          </h3>
          <p className="text-[11px] text-textMuted mt-0.5">
            Consolidated Figures in ₹ Crores
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table className="min-w-[1000px]">
          <TableHeader className="bg-surfaceMuted">
            <TableRow>
              <TableHead className="sticky left-0 bg-surfaceMuted text-[10px] font-bold uppercase tracking-wider text-textMuted">
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
    </div>
  )
}

import React from 'react'
export default BalanceSheetTable
