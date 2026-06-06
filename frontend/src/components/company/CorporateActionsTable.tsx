'use client'

import { useState } from 'react'
import { useSelector } from 'react-redux'
import { Calendar, Tag, ChevronLeft, ChevronRight, BarChart3 } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  corporateActions,
  upcomingEvents,
  dividendHistory,
  type CorporateAction,
} from '@/lib/data/corporate-actions'
import { formatDate } from '@/lib/formatters'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts'
import { cn } from '@/lib/utils'

export function CorporateActionsTable() {
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 8

  const storeActions = useSelector((state: any) => state.company?.corporateActions)
  const activeActions = storeActions?.corporateActions || corporateActions
  const activeUpcoming = storeActions?.upcomingEvents || upcomingEvents
  const activeDividends = storeActions?.dividendHistory || dividendHistory

  // Pagination calculations
  const totalItems = activeActions.length
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedActions = activeActions.slice(startIndex, startIndex + itemsPerPage)

  const getBadgeColor = (type: string) => {
    switch (type) {
      case 'Dividend':
        return 'bg-accentSoft text-accent border-blue-200'
      case 'Bonus':
        return 'bg-positive-soft/40 text-positive border-green-200'
      case 'Split':
        return 'bg-purple-50 text-purple-700 border-purple-200'
      default:
        return 'bg-warning-soft/40 text-warning border-amber-200'
    }
  }

  return (
    <div className="space-y-6 select-none">
      {/* 2-Column layout: Actions list & Upcoming Events + Dividend Chart */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-6">
        {/* Left: Actions List */}
        <div className="bg-surface border border-border rounded-lg overflow-hidden flex flex-col justify-between">
          <div>
            <div className="px-5 py-4 border-b border-border/50 bg-surfaceMuted/50">
              <h3 className="text-sm font-bold text-textPrimary uppercase tracking-wide">
                Corporate Actions
              </h3>
              <p className="text-[11px] text-textMuted mt-0.5">
                History of dividend payments, bonus issues, stock splits, and rights issues
              </p>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-surfaceMuted">
                  <TableRow>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-textMuted">
                      Type
                    </TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-textMuted">
                      Details
                    </TableHead>
                    <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider text-textMuted font-mono">
                      Announcement
                    </TableHead>
                    <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider text-textMuted font-mono">
                      Ex-Date
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedActions.map((action: CorporateAction) => (
                    <TableRow key={action.id} className="hover:bg-surfaceMuted transition-colors">
                      <TableCell className="py-3">
                        <Badge
                          variant="outline"
                          className={cn('text-[10px] font-bold uppercase tracking-wide rounded-md', getBadgeColor(action.type))}
                        >
                          {action.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-textPrimary py-3">
                        {action.details}
                      </TableCell>
                      <TableCell className="text-right text-xs text-textSecondary font-mono py-3">
                        {formatDate(action.announcementDate)}
                      </TableCell>
                      <TableCell className="text-right text-xs text-textSecondary font-mono py-3">
                        {formatDate(action.exDate)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Pagination controls */}
          <div className="px-5 py-4 border-t border-border/50 flex items-center justify-between bg-surfaceMuted/50 shrink-0">
            <span className="text-[11px] text-textSecondary font-semibold">
              Showing {startIndex + 1}–{Math.min(startIndex + itemsPerPage, totalItems)} of {totalItems} actions
            </span>
            <div className="flex gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Right: Upcoming Events & Dividend chart */}
        <div className="space-y-5">
          {/* Upcoming Events */}
          <Card className="border-border shadow-none">
            <div className="px-4 py-3 border-b border-border/50 bg-surfaceMuted/50 flex items-center gap-1.5">
              <Calendar className="size-3.5 text-accent" />
              <span className="text-[11px] font-bold text-textPrimary uppercase tracking-wider">
                Upcoming Events
              </span>
            </div>
            <CardContent className="p-4 space-y-4">
              {activeUpcoming.map((evt: any) => (
                <div key={evt.title} className="flex gap-3 items-start last:border-b-0 border-b border-border/50 pb-3 last:pb-0">
                  <div className="size-8 rounded-lg bg-accentSoft border border-blue-100 flex items-center justify-center shrink-0 text-accent font-bold text-[10px] uppercase font-mono">
                    {new Date(evt.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }).split(' ').join('\n')}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-textPrimary leading-snug">{evt.title}</h4>
                    <p className="text-[10px] text-textMuted font-medium font-mono mt-0.5">Date: {formatDate(evt.date)}</p>
                    <p className="text-[11px] text-textSecondary leading-relaxed mt-1">{evt.description}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Dividend Bar Chart */}
          <Card className="border-border shadow-none">
            <div className="px-4 py-3 border-b border-border/50 bg-surfaceMuted/50 flex items-center gap-1.5">
              <BarChart3 className="size-3.5 text-accent" />
              <span className="text-[11px] font-bold text-textPrimary uppercase tracking-wider">
                Dividend History (₹/Share)
              </span>
            </div>
            <CardContent className="p-4">
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activeDividends} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                    <XAxis dataKey="year" stroke="#94A3B8" fontSize={9} tickLine={false} />
                    <YAxis stroke="#94A3B8" fontSize={9} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: '#F1F5F9' }}
                      contentStyle={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '6px', fontSize: '10px', fontFamily: 'monospace' }}
                      formatter={(val: number) => [`₹${val.toFixed(2)}`, 'Dividend']}
                    />
                    <Bar dataKey="amount" fill="#1D4ED8" radius={[2, 2, 0, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default CorporateActionsTable
