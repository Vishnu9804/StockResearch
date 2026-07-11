import { useState, useEffect, useCallback } from "react"
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
import { formatNumber } from "@/lib/formatters"
import { finscreenClient } from "@/services/finscreenApi"

const ranges = [
  { label: "5D", value: "5D" },
  { label: "1M", value: "1M" },
  { label: "1Y", value: "1Y" },
  { label: "5Y", value: "5Y" },
]

function formatLocalDate(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function getFromDate(range: string): string {
  const d = new Date()
  if (range === "5D") {
    d.setDate(d.getDate() - 8)
  } else if (range === "1M") {
    d.setMonth(d.getMonth() - 1)
  } else if (range === "1Y") {
    d.setFullYear(d.getFullYear() - 1)
  } else if (range === "5Y") {
    d.setFullYear(d.getFullYear() - 5)
  }
  return formatLocalDate(d)
}

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
  const [rangeIdx, setRangeIdx] = useState(2) // Default to index 2 (1Y)
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(false)
      const fromDate = getFromDate(ranges[rangeIdx].value)
      const todayStr = formatLocalDate(new Date())
      const res = await finscreenClient.get(`/company/${symbol}/price-history`, {
        params: {
          from_date: fromDate,
          to_date: todayStr,
        },
      })
      
      const priceList = res.data.price || []
      const mapped = priceList.map((item: any) => ({
        date: item.quote_date,
        open: item.open_price,
        close: item.close_price,
        high: item.high_price,
        low: item.low_price,
        volume: item.volume,
      }))
      
      // Sort chronologically ascending
      mapped.sort((a: any, b: any) => a.date.localeCompare(b.date))
      setData(mapped)
    } catch (err) {
      console.error("Failed to fetch price history:", err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [symbol, rangeIdx])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const startPrice = data[0]?.close ?? basePrice
  const endPrice = data[data.length - 1]?.close ?? basePrice
  const periodChange = startPrice > 0 ? ((endPrice - startPrice) / startPrice) * 100 : 0
  const positive = periodChange >= 0

  const formatXAxis = (tickVal: string) => {
    try {
      const date = new Date(tickVal + "T00:00:00")
      const range = ranges[rangeIdx].value
      if (range === "5D" || range === "1M") {
        return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
      } else if (range === "1Y") {
        const month = date.toLocaleDateString("en-IN", { month: "short" })
        const year = date.getFullYear().toString().slice(-2)
        return `${month} '${year}`
      } else {
        return date.getFullYear().toString()
      }
    } catch (e) {
      return tickVal
    }
  }

  return (
    <Card className="border-border/40 shadow-xs bg-surface rounded-2xl">
      <CardHeader className="flex flex-row items-baseline justify-between gap-2 pb-3.5 border-b border-border/40">
        <div>
          <h3 className="text-sm font-medium tracking-tight">Price Performance</h3>
          <p className="text-xs text-muted-foreground">
            <span className="font-mono">{ranges[rangeIdx].label}</span> ·{" "}
            {!loading && !error && (
              <span className={positive ? "text-positive" : "text-negative"}>
                {periodChange >= 0 ? "+" : ""}
                {periodChange.toFixed(2)}%
              </span>
            )}
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
      <CardContent className="pt-4">
        {loading ? (
          <div className="h-72 w-full flex items-center justify-center bg-secondary/5 animate-pulse rounded-xl border border-border/40">
            <span className="text-xs text-muted-foreground font-semibold">Loading price data...</span>
          </div>
        ) : error ? (
          <div className="h-72 w-full flex flex-col items-center justify-center bg-destructive/5 rounded-xl border border-destructive/10">
            <span className="text-xs text-destructive font-semibold">Failed to load price history</span>
            <button onClick={fetchData} className="mt-2 text-[11px] bg-secondary px-3 py-1.5 rounded-lg hover:bg-secondary/80 font-medium">
              Retry
            </button>
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
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
                  tickFormatter={formatXAxis}
                />
                <YAxis
                  domain={["auto", "auto"]}
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
                  labelFormatter={(d) => {
                    try {
                      return new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    } catch (e) {
                      return d
                    }
                  }}
                />
                {["1Y", "5Y"].includes(ranges[rangeIdx].value) && (
                  <ReferenceLine
                    y={high52}
                    stroke="var(--color-chart-2)"
                    strokeDasharray="2 4"
                    strokeWidth={1}
                    ifOverflow="discard"
                    label={{
                      value: `52W High ${formatNumber(high52, 0)}`,
                      fill: "var(--color-chart-2)",
                      fontSize: 11,
                      position: "insideTopRight",
                    }}
                  />
                )}
                {["1Y", "5Y"].includes(ranges[rangeIdx].value) && (
                  <ReferenceLine
                    y={low52}
                    stroke="var(--color-chart-3)"
                    strokeDasharray="2 4"
                    strokeWidth={1}
                    ifOverflow="discard"
                    label={{
                      value: `52W Low ${formatNumber(low52, 0)}`,
                      fill: "var(--color-chart-3)",
                      fontSize: 11,
                      position: "insideBottomRight",
                    }}
                  />
                )}
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
        )}
      </CardContent>
    </Card>
  )
}
