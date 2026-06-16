
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { sectorPerformance } from "@/lib/data/market"
import { formatNumber } from "@/lib/formatters"
import { cn } from "@/lib/utils"
import { Link } from "react-router-dom"

export function SectorPerformance() {
  const max = Math.max(...sectorPerformance.map((s) => Math.abs(s.change)))

  return (
    <Card className="border-border shadow-none select-none">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-textPrimary uppercase tracking-wide">
          Sector Performance
        </CardTitle>
        <p className="text-xs text-textMuted mt-0.5">Today&apos;s change across NSE industry segments</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {sectorPerformance.map((s) => {
          const positive = s.change >= 0
          const width = max > 0 ? (Math.abs(s.change) / max) * 45 : 0
          return (
            <Link
              key={s.sector}
              to={`/screener/results?sector=${encodeURIComponent(s.sector)}`}
              className="flex items-center gap-3 group hover:bg-surfaceMuted/60 rounded-lg -mx-2 px-2 py-1 transition-colors"
            >
              <div className="w-40 shrink-0 truncate text-xs font-medium text-slate-700 group-hover:text-accent transition-colors">{s.sector}</div>
              <div className="relative flex-1 h-4 bg-surfaceMuted border border-border/50 rounded-sm overflow-hidden">
                <div className="absolute inset-y-0 left-1/2 w-px bg-slate-200" />
                <div
                  className={cn(
                    "absolute top-0 bottom-0 rounded-sm",
                    positive ? "bg-green-500/80 left-1/2" : "bg-red-500/80 right-1/2"
                  )}
                  style={{ width: `${width}%` }}
                />
              </div>
              <div
                className={cn(
                  "w-16 text-right font-mono font-medium tabular text-xs",
                  positive ? "text-positive" : "text-negative"
                )}
              >
                {positive ? '+' : ''}{s.change.toFixed(2)}%
              </div>
              <div className="hidden md:block w-24 text-right font-mono tabular text-xs text-textMuted font-medium">
                M.Cap {formatNumber(s.marketCap / 100000, 2)}L Cr
              </div>
            </Link>
          )
        })}
      </CardContent>
    </Card>
  )
}
export default SectorPerformance
