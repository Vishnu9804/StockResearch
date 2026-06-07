
import { useState } from 'react'
import { useAppSelector } from '@/store/hooks'
import { ChevronDown, ChevronRight, TrendingUp } from 'lucide-react'
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

export function ProfitLossTable() {
  const [expandedRows, setExpandedRows] = useState<{ [key: string]: boolean }>({})
  const authUser = useAppSelector((state) => state.auth?.user)
  const isPro = authUser?.plan === 'PRO'
  const storeProfitLoss = useAppSelector((state) => state.company?.profitLoss)
  const activeProfitLoss = storeProfitLoss || profitLoss

  const visibleYears = isPro ? fiscalYears : fiscalYears.slice(-5)

  const toggleRow = (label: string) => {
    setExpandedRows((prev) => ({ ...prev, [label]: !prev[label] }))
  }

  const renderValue = (val: number | null, isPercent?: boolean) => {
    if (val === null) return '—'
    return isPercent ? `${formatNumber(val, 2)}%` : formatIndian(val)
  }

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
          {visibleValues.map((val, idx) => (
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
    <div className="space-y-6 select-none">
      {/* P&L Table */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between bg-surfaceMuted/50">
          <div>
            <h3 className="text-sm font-bold text-textPrimary uppercase tracking-wide">
              Profit & Loss Statement
            </h3>
            <p className="text-[11px] text-textMuted mt-0.5">
              Annual consolidated figures in ₹ Crores (except EPS)
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table className="min-w-[1000px]">
            <TableHeader className="bg-surfaceMuted">
              <TableRow>
                <TableHead className="sticky left-0 bg-surfaceMuted text-[10px] font-bold uppercase tracking-wider text-textMuted">
                  Year Ending
                </TableHead>
                {visibleYears.map((y) => (
                  <TableHead
                    key={y}
                    className="text-right text-[10px] font-bold uppercase tracking-wider text-textMuted font-mono"
                  >
                    {y}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>{activeProfitLoss.map((row: FinancialRow) => renderRow(row))}</TableBody>
          </Table>
        </div>
      </div>

      {!isPro && (
        <Card className="border-blue-200 bg-accentSoft/50 shadow-none p-5 text-center flex flex-col items-center justify-center space-y-3">
          <div className="flex items-center justify-center size-10 rounded-full bg-info/10 text-accent">
            <TrendingUp className="size-5" />
          </div>
          <div className="max-w-md">
            <h4 className="text-xs font-bold text-textPrimary uppercase tracking-wide">
              Unlock Full 15-Year Financial Statements
            </h4>
            <p className="text-[11px] text-textSecondary mt-1 leading-relaxed">
              You are currently viewing a limited 5-year snapshot. Upgrade to FinScreen Pro to unlock complete 15-year histories, CAGR calculators, and custom ratio builders.
            </p>
          </div>
          <a
            href="/pricing"
            className="inline-flex h-8 items-center justify-center rounded-md bg-accent px-4 text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:bg-accent/90 transition-colors"
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
              <span className="text-[11px] font-bold text-textPrimary uppercase tracking-wider">
                {item.title}
              </span>
            </div>
            <CardContent className="p-0">
              <table className="w-full text-xs font-medium">
                <tbody>
                  {item.stats.map((stat, i) => (
                    <tr key={stat.period} className={cn('border-b last:border-0 hover:bg-surfaceMuted/50 transition-colors', i % 2 === 1 ? 'bg-surfaceMuted/20' : '')}>
                      <td className="px-4 py-2.5 text-textSecondary font-semibold">{stat.period}:</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-textPrimary">{stat.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

import React from 'react'
export default ProfitLossTable
