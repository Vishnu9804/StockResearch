
import { useState } from "react"
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatNumber } from "@/lib/formatters"

const PERIOD_DATA: Record<
  string,
  {
    label: string
    domain: [string | number, string | number]
    data: { time: string; nifty: number }[]
  }
> = {
  "1D": {
    label: "Today",
    domain: ["dataMin - 20", "dataMax + 20"],
    data: [
      { time: "9:15", nifty: 24670 },
      { time: "10:00", nifty: 24705 },
      { time: "10:45", nifty: 24690 },
      { time: "11:30", nifty: 24735 },
      { time: "12:15", nifty: 24770 },
      { time: "13:00", nifty: 24755 },
      { time: "13:45", nifty: 24788 },
      { time: "14:30", nifty: 24802 },
      { time: "15:15", nifty: 24812 },
    ],
  },
  "5D": {
    label: "5 Days",
    domain: ["dataMin - 50", "dataMax + 50"],
    data: [
      { time: "25 May", nifty: 24520 },
      { time: "26 May", nifty: 24610 },
      { time: "27 May", nifty: 24580 },
      { time: "28 May", nifty: 24690 },
      { time: "29 May", nifty: 24812 },
    ],
  },
  "1M": {
    label: "1 Month",
    domain: ["dataMin - 200", "dataMax + 200"],
    data: [
      { time: "01 May", nifty: 24110 },
      { time: "08 May", nifty: 24340 },
      { time: "15 May", nifty: 24290 },
      { time: "22 May", nifty: 24550 },
      { time: "29 May", nifty: 24812 },
    ],
  },
  "1Y": {
    label: "1 Year",
    domain: ["dataMin - 1000", "dataMax + 1000"],
    data: [
      { time: "Jun 25", nifty: 21850 },
      { time: "Aug 25", nifty: 22400 },
      { time: "Oct 25", nifty: 23100 },
      { time: "Dec 25", nifty: 23900 },
      { time: "Feb 26", nifty: 24200 },
      { time: "Apr 26", nifty: 24500 },
      { time: "May 26", nifty: 24812 },
    ],
  },
  "5Y": {
    label: "5 Years",
    domain: ["dataMin - 3000", "dataMax + 3000"],
    data: [
      { time: "2021", nifty: 15300 },
      { time: "2022", nifty: 17200 },
      { time: "2023", nifty: 19400 },
      { time: "2024", nifty: 22100 },
      { time: "2025", nifty: 23800 },
      { time: "2026", nifty: 24812 },
    ],
  },
  "Max": {
    label: "Max",
    domain: ["dataMin - 5000", "dataMax + 5000"],
    data: [
      { time: "2016", nifty: 8200 },
      { time: "2018", nifty: 10500 },
      { time: "2020", nifty: 11200 },
      { time: "2022", nifty: 17200 },
      { time: "2024", nifty: 22100 },
      { time: "2026", nifty: 24812 },
    ],
  },
}

export function IntradayChart() {
  const [activePeriod, setActivePeriod] = useState<string>("1D")
  const currentConfig = PERIOD_DATA[activePeriod] || PERIOD_DATA["1D"]
  const chartData = currentConfig.data

  const startVal = chartData[0]?.nifty ?? 24670
  const endVal = chartData[chartData.length - 1]?.nifty ?? 24812
  const priceChange = endVal - startVal
  const percentChange = (priceChange / startVal) * 100
  const positive = priceChange >= 0

  return (
    <Card>
      <CardHeader className="flex flex-row items-baseline justify-between gap-2 pb-2">
        <div>
          <CardTitle className="text-sm font-semibold tracking-tight">
            NIFTY 50 Intraday
          </CardTitle>
          <p className="text-[11px] text-muted-foreground">
            {currentConfig.label} · {formatNumber(endVal, 2)} ·{" "}
            <span className={positive ? "text-positive font-semibold" : "text-negative font-semibold"}>
              {positive ? "+" : ""}
              {percentChange.toFixed(2)}%
            </span>
          </p>
        </div>
        <div className="flex items-center gap-1 text-[11px]">
          {["1D", "5D", "1M", "1Y", "5Y", "Max"].map((p) => (
            <button
              key={p}
              onClick={() => setActivePeriod(p)}
              className={`rounded px-2 py-0.5 font-semibold transition-colors duration-150 ${
                p === activePeriod
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <defs>
                <linearGradient id="niftyGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={currentConfig.domain}
                tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatNumber(v, 0)}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 6,
                  fontSize: 12,
                }}
                formatter={(value: number) => [formatNumber(value, 2), "NIFTY"]}
              />
              <Area
                type="monotone"
                dataKey="nifty"
                stroke="var(--color-chart-1)"
                strokeWidth={2}
                fill="url(#niftyGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

