"use client"

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { shareholding } from "@/lib/data/financials"
import { formatNumber } from "@/lib/formatters"

export function ShareholdingChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold tracking-tight">
          Shareholding Pattern
        </CardTitle>
        <p className="text-[11px] text-muted-foreground">
          Quarterly breakdown · % of total equity
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={shareholding} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="quarter"
                tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 6,
                  fontSize: 12,
                }}
                formatter={(value: number) => [`${formatNumber(value, 2)}%`, ""]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="promoter" name="Promoter" stackId="a" fill="var(--color-chart-1)" />
              <Bar dataKey="fii" name="FII" stackId="a" fill="var(--color-chart-2)" />
              <Bar dataKey="dii" name="DII" stackId="a" fill="var(--color-chart-4)" />
              <Bar dataKey="public" name="Public" stackId="a" fill="var(--color-chart-5)" />
              <Bar dataKey="others" name="Others" stackId="a" fill="var(--color-chart-3)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

export function ShareholdingTable() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold tracking-tight">
          Quarterly Detail
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-secondary/60">
              <TableRow>
                <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Quarter
                </TableHead>
                <TableHead className="text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Promoter
                </TableHead>
                <TableHead className="text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  FII
                </TableHead>
                <TableHead className="text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  DII
                </TableHead>
                <TableHead className="text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Public
                </TableHead>
                <TableHead className="text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Others
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shareholding.map((r) => (
                <TableRow key={r.quarter} className="hover:bg-secondary/40">
                  <TableCell className="font-mono text-xs">{r.quarter}</TableCell>
                  <TableCell className="text-right font-mono tabular text-xs">
                    {formatNumber(r.promoter, 2)}%
                  </TableCell>
                  <TableCell className="text-right font-mono tabular text-xs">
                    {formatNumber(r.fii, 2)}%
                  </TableCell>
                  <TableCell className="text-right font-mono tabular text-xs">
                    {formatNumber(r.dii, 2)}%
                  </TableCell>
                  <TableCell className="text-right font-mono tabular text-xs">
                    {formatNumber(r.public, 2)}%
                  </TableCell>
                  <TableCell className="text-right font-mono tabular text-xs">
                    {formatNumber(r.others, 2)}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
