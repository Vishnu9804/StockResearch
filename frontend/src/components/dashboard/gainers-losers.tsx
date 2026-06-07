
import { Link } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { gainers, losers, type MarketMover } from "@/lib/data/market"
import { formatNumber, formatVolume } from "@/lib/formatters"
import { ArrowRight, ArrowUpRight, ArrowDownRight } from "lucide-react"
import { cn } from "@/lib/utils"

function MoverList({ data }: { data: MarketMover[] }) {
  return (
    <ul className="divide-y divide-border/50 max-h-[360px] overflow-y-auto">
      {data.map((s) => {
        const positive = s.change >= 0
        return (
          <li key={s.symbol}>
            <Link
              to={`/company/${s.symbol}`}
              className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-surfaceMuted transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-accent">{s.symbol}</span>
                  <span className="truncate text-xs font-semibold text-slate-700">{s.name}</span>
                </div>
                <div className="mt-0.5 text-[10px] text-textMuted font-mono font-medium">
                  Vol {formatVolume(s.volume)}
                </div>
              </div>
              <div className="flex flex-col items-end shrink-0">
                <span className="font-mono tabular text-xs font-bold text-textPrimary">
                  ₹{formatNumber(s.price, 2)}
                </span>
                <span
                  className={cn(
                    "text-[10px] font-mono font-bold flex items-center gap-0.5 mt-0.5",
                    positive ? "text-positive" : "text-negative"
                  )}
                >
                  {positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                  {positive ? '+' : ''}{s.changePct.toFixed(2)}%
                </span>
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

export function GainersLosers() {
  return (
    <Card className="border-border shadow-none overflow-hidden select-none">
      <CardHeader className="flex flex-row items-center justify-between gap-2 border-b border-border/50 bg-surfaceMuted/50 px-4 py-3 shrink-0">
        <CardTitle className="text-xs font-bold text-textPrimary uppercase tracking-wide">
          Top Movers
        </CardTitle>
        <div className="flex items-center gap-3">
          <Link
            to="/screener/results"
            className="inline-flex items-center gap-1 text-[11px] font-bold text-accent hover:underline uppercase tracking-wide"
          >
            All movers <ArrowRight className="size-3" />
          </Link>
          <Link
            to="/screener"
            className="inline-flex items-center gap-1 text-[11px] font-bold text-textSecondary hover:text-accent transition-colors uppercase tracking-wide"
          >
            Screener <ArrowRight className="size-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs defaultValue="gainers">
          <div className="border-b border-border/50 px-4 bg-surfaceMuted/20">
            <TabsList className="h-9 bg-transparent p-0 gap-4">
              <TabsTrigger
                value="gainers"
                className="text-[10px] font-bold uppercase tracking-wider h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-700 data-[state=active]:text-accent bg-transparent p-0 shadow-none"
              >
                Gainers
              </TabsTrigger>
              <TabsTrigger
                value="losers"
                className="text-[10px] font-bold uppercase tracking-wider h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-700 data-[state=active]:text-accent bg-transparent p-0 shadow-none"
              >
                Losers
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="gainers" className="m-0">
            <MoverList data={gainers} />
          </TabsContent>
          <TabsContent value="losers" className="m-0">
            <MoverList data={losers} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
export default GainersLosers
