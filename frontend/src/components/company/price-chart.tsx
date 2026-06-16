
import { useState } from "react"
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { priceSeriesFor } from "@/lib/data/financials"
import { formatNumber } from "@/lib/formatters"

const ranges = [
  { label: "1M", days: 22 },
  { label: "3M", days: 65 },
  { label: "6M", days: 130 },
  { label: "1Y", days: 250 },
  { label: "5Y", days: 1250 },
  { label: "Max", days: 1500 },
]

export function PriceChart({
  symbol,
  basePrice,
  high52,
  low52,
}: {
  symbol: string
  basePrice: number
  high52: number
  low52: number
}) {
  const [rangeIdx, setRangeIdx] = useState(3)
  const series = priceSeriesFor(symbol, basePrice)
  const slice = series.slice(series.length - ranges[rangeIdx].days)

  const startPrice = slice[0]?.close ?? basePrice
  const endPrice = slice[slice.length - 1]?.close ?? basePrice
  const periodChange = ((endPrice - startPrice) / startPrice) * 100
  const positive = periodChange >= 0

  return (
    <Card className="border-border/40 shadow-xs bg-surface rounded-2xl">
      <CardHeader className="flex flex-row items-baseline justify-between gap-2 pb-3.5 border-b border-border/40">
        <div>
          <h3 className="text-sm font-medium tracking-tight">Price Performance</h3>
          <p className="text-xs text-muted-foreground">
            <span className="font-mono">{ranges[rangeIdx].label}</span> ·{" "}
            <span className={positive ? "text-positive" : "text-negative"}>
              {periodChange >= 0 ? "+" : ""}
              {periodChange.toFixed(2)}%
            </span>
          </p>
        </div>
        <div className="flex items-center gap-1 text-xs">
          {ranges.map((r, i) => (
            <button
              key={r.label}
              onClick={() => setRangeIdx(i)}
              className={`rounded px-2 py-0.5 ${
                i === rangeIdx
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={slice} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
              <defs>
                <linearGradient id={`chart-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={positive ? "var(--color-chart-2)" : "var(--color-chart-3)"}
                    stopOpacity={0.25}
                  />
                  <stop
                    offset="100%"
                    stopColor={positive ? "var(--color-chart-2)" : "var(--color-chart-3)"}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                minTickGap={40}
                tickFormatter={(d) =>
                  new Date(d).toLocaleDateString("en-IN", { month: "short", day: "numeric" })
                }
              />
              <YAxis
                domain={["dataMin - 50", "dataMax + 50"]}
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `₹${formatNumber(v, 0)}`}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 6,
                  fontSize: 12,
                }}
                formatter={(value: number) => [`₹${formatNumber(value, 2)}`, symbol]}
                labelFormatter={(d) =>
                  new Date(d).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                }
              />
              <ReferenceLine
                y={high52}
                stroke="var(--color-chart-2)"
                strokeDasharray="2 4"
                strokeWidth={1}
                label={{
                  value: `52W High ${formatNumber(high52, 0)}`,
                  fill: "var(--color-chart-2)",
                  fontSize: 11,
                  position: "insideTopRight",
                }}
              />
              <ReferenceLine
                y={low52}
                stroke="var(--color-chart-3)"
                strokeDasharray="2 4"
                strokeWidth={1}
                label={{
                  value: `52W Low ${formatNumber(low52, 0)}`,
                  fill: "var(--color-chart-3)",
                  fontSize: 11,
                  position: "insideBottomRight",
                }}
              />
              <Area
                type="monotone"
                dataKey="close"
                stroke={positive ? "var(--color-chart-2)" : "var(--color-chart-3)"}
                strokeWidth={2}
                fill={`url(#chart-${symbol})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
