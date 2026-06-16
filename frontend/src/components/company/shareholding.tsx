
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAppSelector } from '@/store/hooks'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { shareholding } from "@/lib/data/financials"
import { formatNumber } from "@/lib/formatters"
import { cn } from "@/lib/utils"
import { Download, Share2, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"

// Color palette for shareholder segments
const SEGMENT_COLORS = {
  promoter: 'bg-accent',
  fii:      'bg-slate-600',
  dii:      'bg-blue-300',
  public:   'bg-slate-300',
  others:   'bg-slate-200',
}

const LEGEND = [
  { key: 'promoter', label: 'Promoters', color: 'bg-accent' },
  { key: 'fii',      label: 'FIIs',      color: 'bg-slate-600' },
  { key: 'dii',      label: 'DIIs',      color: 'bg-blue-300' },
  { key: 'public',   label: 'Public',    color: 'bg-slate-300' },
]

type SegmentKey = keyof typeof SEGMENT_COLORS

export function ShareholdingChart() {
  const storeShareholding = useAppSelector((state) => state.company?.shareholdingData)
  const activeShareholding = storeShareholding || shareholding

  // Show last 4 quarters
  const recent = activeShareholding.slice(-4)
  const latestQ = recent[recent.length - 1]

  return (
    <div className="space-y-5">
      {/* ── Full ownership dashboard card ─────────────────────────────── */}
      <Card className="border-border/40 shadow-xs bg-surface rounded-2xl">
        <CardHeader className="border-b border-border/40 pb-3.5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-medium text-textPrimary">Shareholding Pattern</CardTitle>
              <p className="text-xs text-textMuted mt-0.5">Institutional ownership and distribution analysis</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-7 text-xs font-medium border-border text-textSecondary shadow-none gap-1.5">
                <Download className="size-3" /> CSV
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs font-medium border-border text-textSecondary shadow-none gap-1.5">
                <Share2 className="size-3" /> Share
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-5">
          {/* Legend */}
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-xs font-medium text-textMuted uppercase tracking-wider">Historical Ownership Split (%):</span>
            {LEGEND.map((l) => (
              <div key={l.key} className="flex items-center gap-1.5">
                <span className={cn("size-2.5 rounded-sm shrink-0", l.color)} />
                <span className="text-xs font-medium text-textSecondary">{l.label}</span>
              </div>
            ))}
          </div>

          {/* CSS stacked horizontal bars */}
          <div className="space-y-3">
            {recent.map((row: any) => (
              <div key={row.quarter} className="flex items-center gap-3">
                <span className="text-xs font-mono font-medium text-textSecondary w-16 shrink-0 text-right">{row.quarter}</span>
                <div className="flex-1 h-7 rounded-md overflow-hidden flex">
                  {(['promoter', 'fii', 'dii', 'public'] as SegmentKey[]).map((seg) => {
                    const pct = row[seg] || 0
                    return (
                      <div
                        key={seg}
                        className={cn("h-full group relative transition-all", SEGMENT_COLORS[seg])}
                        style={{ width: `${pct}%` }}
                        title={`${seg}: ${pct.toFixed(2)}%`}
                      >
                        {pct > 8 && (
                          <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white mix-blend-overlay">
                            {pct.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
                <span className="text-xs font-mono font-medium text-textMuted w-8 shrink-0">100%</span>
              </div>
            ))}
          </div>

          {/* Holdings table */}
          <div className="overflow-x-auto mt-2">
            <Table>
              <TableHeader>
                <TableRow className="border-border bg-surfaceMuted">
                  <TableHead className="text-xs font-medium uppercase tracking-wider text-textMuted">Holders</TableHead>
                  {recent.map((r: any) => (
                    <TableHead key={r.quarter} className="text-right text-xs font-medium uppercase tracking-wider text-textMuted">{r.quarter}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(['promoter', 'fii', 'dii', 'public'] as SegmentKey[]).map((seg) => {
                  const segLabel: Record<SegmentKey, string> = { promoter: 'Promoters', fii: 'FIIs', dii: 'DIIs', public: 'Public', others: 'Others' }
                  return (
                    <TableRow key={seg} className="hover:bg-surfaceMuted/40 border-border">
                      <TableCell className="text-xs font-medium text-textPrimary py-3">{segLabel[seg]}</TableCell>
                      {recent.map((row: any) => (
                        <TableCell key={row.quarter} className="text-right font-mono tabular-nums text-xs text-textSecondary py-3">
                          {formatNumber(row[seg] || 0, 2)}%
                        </TableCell>
                      ))}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* Key Insight */}
          <div className="bg-accentSoft/40 border border-accent/20 rounded-xl p-4 flex items-start gap-3">
            <TrendingUp className="size-4 text-accent shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-textPrimary">Key Insight</p>
              <p className="text-xs text-textSecondary leading-relaxed mt-0.5">
                Institutional interest (FII + DII) remains stable at{' '}
                <strong className="text-textPrimary">
                  {latestQ ? formatNumber((latestQ.fii || 0) + (latestQ.dii || 0), 2) : '—'}%
                </strong>.{' '}
                Promoter stake is locked with no pledges reported in the last 12 months, signaling high management confidence.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── FII Sentiment + Institutional Reports ──────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_260px] gap-4">

        {/* FII Sentiment Analysis */}
        <Card className="border-border/40 shadow-xs bg-surface rounded-2xl">
          <CardHeader className="border-b border-border/40 pb-3.5">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-medium text-textPrimary">FII Sentiment Analysis</CardTitle>
                <p className="text-xs text-textMuted mt-0.5">Foreign institutional flows and sentiment scoring</p>
              </div>
              <span className="inline-flex items-center gap-1 bg-positive-soft text-positive border border-positive/20 rounded-full px-2.5 py-1 text-xs font-medium uppercase tracking-wide">
                <TrendingUp className="size-2.5" /> Bullish
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-textMuted mb-1">New Entrants</p>
                <p className="text-2xl font-medium font-mono text-textPrimary">12</p>
              </div>
              <div className="border-x border-border">
                <p className="text-xs font-medium uppercase tracking-widest text-textMuted mb-1">Exit Volume</p>
                <p className="text-2xl font-medium font-mono text-negative">0.2%</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-textMuted mb-1">Avg. Tenure</p>
                <p className="text-2xl font-medium font-mono text-textPrimary">4.8Y</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Institutional Reports */}
        <Card className="border-transparent shadow-xs bg-accent text-white rounded-2xl">
          <CardContent className="p-5 flex flex-col items-start gap-3 h-full">
            <div className="size-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Download className="size-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium">Institutional Reports</p>
              <p className="text-xs text-blue-100 leading-relaxed mt-1">
                Deep dive into the Q1 FY25 outlook for major shareholders.
              </p>
            </div>
            <Button size="sm" className="bg-white text-accent hover:bg-blue-50 font-medium text-xs w-full mt-auto">
              View Full Report
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export function ShareholdingTable() {
  const storeShareholding = useAppSelector((state) => state.company?.shareholdingData)
  const activeShareholding = storeShareholding || shareholding

  return (
    <Card className="border-border/40 shadow-xs bg-surface rounded-2xl">
      <CardHeader className="border-b border-border/40 pb-3.5">
        <CardTitle className="text-sm font-medium tracking-tight">Quarterly Detail</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-surfaceMuted/50">
              <TableRow>
                <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Quarter</TableHead>
                <TableHead className="text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Promoter</TableHead>
                <TableHead className="text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">FII</TableHead>
                <TableHead className="text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">DII</TableHead>
                <TableHead className="text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Public</TableHead>
                <TableHead className="text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Others</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeShareholding.map((r: any) => (
                <TableRow key={r.quarter} className="hover:bg-secondary/40">
                  <TableCell className="font-mono text-xs">{r.quarter}</TableCell>
                  <TableCell className="text-right font-mono tabular text-xs">{formatNumber(r.promoter, 2)}%</TableCell>
                  <TableCell className="text-right font-mono tabular text-xs">{formatNumber(r.fii, 2)}%</TableCell>
                  <TableCell className="text-right font-mono tabular text-xs">{formatNumber(r.dii, 2)}%</TableCell>
                  <TableCell className="text-right font-mono tabular text-xs">{formatNumber(r.public, 2)}%</TableCell>
                  <TableCell className="text-right font-mono tabular text-xs">{formatNumber(r.others, 2)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
