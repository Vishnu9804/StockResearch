
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  profitLoss,
  balanceSheet,
  cashFlow,
  ratios,
  quarterlyResults,
  fiscalYears,
  quarters,
  type FinancialRow,
} from "@/lib/data/financials"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatNumber } from "@/lib/formatters"
import { cn } from "@/lib/utils"

function FinancialTable({
  rows,
  columns,
}: {
  rows: FinancialRow[]
  columns: string[]
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader className="bg-secondary/60">
          <TableRow>
            <TableHead className="sticky left-0 z-10 bg-secondary/60 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              In ₹ Cr
            </TableHead>
            {columns.map((c) => (
              <TableHead
                key={c}
                className="text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground font-mono"
              >
                {c}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow
              key={i}
              className={cn(
                "hover:bg-secondary/40",
                row.highlight ? "bg-secondary/30 font-semibold" : "",
              )}
            >
              <TableCell
                className={cn(
                  "sticky left-0 z-10 bg-card text-sm",
                  row.highlight ? "font-semibold bg-secondary/30" : "",
                )}
              >
                {row.label}
              </TableCell>
              {row.values.map((v, j) => (
                <TableCell
                  key={j}
                  className="text-right font-mono tabular text-xs"
                >
                  {v === null ? "—" : formatNumber(v, row.label.includes("%") ? 1 : 0)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function FinancialsTabs() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold tracking-tight">
          Financials
        </CardTitle>
        <p className="text-[11px] text-muted-foreground">
          10-year history · Standalone view · INR Crores
        </p>
      </CardHeader>
      <CardContent className="px-0">
        <Tabs defaultValue="pl">
          <div className="border-y bg-secondary/30 px-4">
            <TabsList className="h-9 bg-transparent">
              <TabsTrigger value="quarterly" className="text-xs">
                Quarterly
              </TabsTrigger>
              <TabsTrigger value="pl" className="text-xs">
                Profit & Loss
              </TabsTrigger>
              <TabsTrigger value="bs" className="text-xs">
                Balance Sheet
              </TabsTrigger>
              <TabsTrigger value="cf" className="text-xs">
                Cash Flow
              </TabsTrigger>
              <TabsTrigger value="ratios" className="text-xs">
                Ratios
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="quarterly" className="m-0">
            <FinancialTable rows={quarterlyResults} columns={quarters} />
          </TabsContent>
          <TabsContent value="pl" className="m-0">
            <FinancialTable rows={profitLoss} columns={fiscalYears} />
          </TabsContent>
          <TabsContent value="bs" className="m-0">
            <FinancialTable rows={balanceSheet} columns={fiscalYears} />
          </TabsContent>
          <TabsContent value="cf" className="m-0">
            <FinancialTable rows={cashFlow} columns={fiscalYears} />
          </TabsContent>
          <TabsContent value="ratios" className="m-0">
            <FinancialTable rows={ratios} columns={fiscalYears} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

export { FinancialTable }
