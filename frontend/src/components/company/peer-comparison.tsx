'use client'

import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { companies } from '@/lib/data/companies'
import { formatNumber, formatCrores, formatPct, changeClass } from '@/lib/formatters'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export function PeerComparison({ symbol, sector }: { symbol: string; sector: string }) {
  // Find all companies in the same sector
  const peers = companies.filter((c) => c.sector === sector).slice(0, 8)

  if (peers.length <= 1) return null

  return (
    <Card className="border-border shadow-none select-none">
      <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between bg-surfaceMuted/50">
        <div>
          <h3 className="text-sm font-bold text-textPrimary uppercase tracking-wide">
            Peer Comparison
          </h3>
          <p className="text-[11px] text-textMuted mt-0.5">
            Top companies operating in the same sector: <span className="font-semibold text-slate-700">{sector}</span>
          </p>
        </div>
      </div>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-surfaceMuted">
              <TableRow>
                <TableHead className="text-[10px] font-bold uppercase tracking-wider text-textMuted">
                  Company
                </TableHead>
                <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider text-textMuted font-mono">
                  CMP (₹)
                </TableHead>
                <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider text-textMuted font-mono">
                  Change %
                </TableHead>
                <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider text-textMuted font-mono">
                  M.Cap (₹ Cr)
                </TableHead>
                <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider text-textMuted font-mono">
                  P/E
                </TableHead>
                <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider text-textMuted font-mono">
                  ROE (%)
                </TableHead>
                <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider text-textMuted font-mono">
                  ROCE (%)
                </TableHead>
                <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider text-textMuted font-mono">
                  Div Yield (%)
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {peers.map((peer) => {
                const isCurrent = peer.symbol === symbol
                const positive = peer.change >= 0

                return (
                  <TableRow
                    key={peer.symbol}
                    className={cn(
                      'hover:bg-surfaceMuted transition-colors',
                      isCurrent ? 'bg-accentSoft/20 font-semibold' : ''
                    )}
                  >
                    <TableCell className="py-2.5">
                      <Link to={`/company/${peer.symbol}`} className="flex flex-col">
                        <span className="font-bold text-xs text-accent hover:underline">
                          {peer.symbol}
                        </span>
                        <span className="text-[10px] text-textMuted truncate max-w-[160px] mt-0.5">
                          {peer.name}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums text-slate-700 py-2.5">
                      {formatNumber(peer.price, 2)}
                    </TableCell>
                    <TableCell className="text-right py-2.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-0.5 font-mono text-xs tabular-nums font-semibold',
                          positive ? 'text-positive' : 'text-negative'
                        )}
                      >
                        {positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                        {positive ? '+' : ''}{peer.changePct.toFixed(2)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums text-slate-700 py-2.5">
                      {formatNumber(peer.marketCap, 0)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums text-slate-700 py-2.5">
                      {formatNumber(peer.pe)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums text-slate-700 py-2.5">
                      {formatNumber(peer.roe)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums text-slate-700 py-2.5">
                      {formatNumber(peer.roce)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums text-slate-700 py-2.5">
                      {formatNumber(peer.dividendYield)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
export default PeerComparison
