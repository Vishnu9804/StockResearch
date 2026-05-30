'use client'

import { Link } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SCREENER_TEMPLATES } from "@/lib/data/screener"
import { ArrowRight, Filter } from "lucide-react"

export function SavedScans() {
  // Take first 4 templates for display
  const featuredScans = SCREENER_TEMPLATES.slice(0, 4)

  const getMockSymbols = (id: string) => {
    switch (id) {
      case 'debt-free':
        return ['TCS', 'INFY', 'HINDUNILVR']
      case 'high-dividend':
        return ['POWERGRID', 'TCS', 'INFY']
      case 'golden-crossover':
        return ['RELIANCE', 'SBIN', 'ICICIBANK']
      default:
        return ['HDFCBANK', 'AXISBANK', 'KOTAKBANK']
    }
  }

  return (
    <Card className="border-border shadow-none select-none">
      <CardHeader className="flex flex-row items-center justify-between gap-2 border-b border-border/50 bg-surfaceMuted/50 px-5 py-4">
        <div>
          <h3 className="text-sm font-bold text-textPrimary uppercase tracking-wide">
            Recent Custom Scans
          </h3>
          <p className="text-[11px] text-textMuted mt-0.5">Quickly run predefined scans or templates</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="h-8 text-xs font-bold uppercase border-border text-textSecondary">
            <Link to="/screens" className="flex items-center gap-1">
              View All
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="h-8 text-xs font-bold uppercase border-border text-textSecondary">
            <Link to="/screener" className="flex items-center gap-1">
              <Filter className="size-3.5" />
              New Scan
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {featuredScans.map((scan) => (
            <Link
              key={scan.id}
              to="/screener/results"
              className="group flex flex-col justify-between rounded-lg border border-border bg-card p-4 transition-all hover:border-blue-400 hover:shadow-sm h-36"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-xs font-bold text-textPrimary truncate">
                    {scan.name}
                  </h3>
                  <ArrowRight className="size-3.5 text-accent opacity-0 -translate-x-1 group-hover:translate-x-0 group-hover:opacity-100 transition-all shrink-0 self-center" />
                </div>
                <p className="text-[10px] leading-relaxed text-textMuted mt-1 line-clamp-2">
                  {scan.description}
                </p>
              </div>

              <div className="mt-2 space-y-2 shrink-0">
                <div className="flex items-center justify-between">
                  <span className="font-mono tabular text-[10px] font-bold text-accent">
                    {scan.matchCount} stocks found
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {getMockSymbols(scan.id).map((s) => (
                    <Link
                      key={s}
                      to={`/company/${s}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Badge
                        variant="secondary"
                        className="font-mono text-[9px] font-bold bg-surfaceMuted border border-border text-textSecondary rounded-sm hover:bg-accentSoft hover:text-accent hover:border-accent/20 transition-colors"
                      >
                        {s}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
export default SavedScans
