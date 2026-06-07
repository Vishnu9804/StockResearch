import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { variables } from "@/lib/data/screener"
import { Calculator, CheckCircle2, ChevronRight, Plus, Save, Sparkles } from "lucide-react"
import { Text } from "@/components/ui/Text"
import { Heading } from "@/components/ui/Heading"

const savedRatios = [
  {
    name: "Graham Number",
    formula: "SQRT(22.5 * EPS * Book Value)",
    description: "Benjamin Graham's intrinsic value formula",
    sample: 1842.5,
    updated: "2025-09-12",
  },
  {
    name: "Owner's Earnings Yield",
    formula: "(FCF + Maint Capex) / Market Cap * 100",
    description: "Buffett-style cash-on-investment yield",
    sample: 5.4,
    updated: "2025-09-08",
  },
  {
    name: "Magic Formula Score",
    formula: "RANK(ROCE) + RANK(EarningsYield)",
    description: "Joel Greenblatt's combined ranking",
    sample: 412,
    updated: "2025-08-30",
  },
]

export function CustomRatios() {
  const [name, setName] = useState("Graham Number")
  const [formula, setFormula] = useState("SQRT(22.5 * EPS * Book Value)")
  const [ticker, setTicker] = useState("TCS")

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-surface border-b border-border px-6 py-4">
        <nav className="flex items-center gap-1.5 text-xs text-textMuted mb-1">
          <Text as="span" variant="bodyMuted" className="text-xs">Home</Text>
          <ChevronRight className="w-3 h-3" />
          <Text as="span" variant="bodyMuted" className="text-xs">Custom Ratios</Text>
        </nav>
        <div className="flex items-center justify-between">
          <div>
            <Heading level={1} variant="pageTitle">Custom Ratios</Heading>
            <Text variant="bodyMuted" className="mt-0.5 text-xs">
              Build proprietary metrics from 200+ financial variables and run them across the entire universe
            </Text>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 lg:px-6 lg:py-6 space-y-5">

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
        <Card className="border-border bg-surface shadow-none">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="flex items-center gap-2 text-sm font-bold tracking-tight text-textPrimary">
              <Calculator className="size-4 text-accent" />
              Formula Builder
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Text variant="label" as={Label} htmlFor="ratio-name" className="text-[10px] tracking-wide">
                  Ratio Name
                </Text>
                <Input
                  id="ratio-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-9 border-border bg-surface text-xs text-textPrimary"
                />
              </div>
              <div className="space-y-1.5">
                <Text variant="label" as={Label} htmlFor="ratio-ticker" className="text-[10px] tracking-wide">
                  Live Preview Ticker
                </Text>
                <Input
                  id="ratio-ticker"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  className="h-9 font-mono border-border bg-surface text-xs text-textPrimary"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Text variant="label" as={Label} htmlFor="ratio-formula" className="text-[10px] tracking-wide">
                Formula
              </Text>
              <Textarea
                id="ratio-formula"
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
                className="min-h-[120px] font-mono text-xs border-border bg-surface text-textPrimary"
                placeholder="e.g. SQRT(22.5 * EPS * BookValue)"
              />
            </div>

            <div className="flex items-center justify-between rounded-md border bg-positive-soft/40 border-positive/20 px-3 py-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-positive">
                <CheckCircle2 className="size-3.5" />
                Formula valid · Live preview ready
              </div>
              <div className="flex items-center gap-2">
                <Text variant="caption" className="text-[10px] text-textMuted font-mono">
                  {ticker} →
                </Text>
                <Text variant="numeric" className="font-semibold text-textPrimary text-sm">
                  ₹1,842.50
                </Text>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" className="gap-1.5 bg-accent hover:bg-accent/90 text-white font-semibold shadow-none">
                <Save className="size-3.5" />
                Save Ratio
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 font-semibold border-border text-textSecondary hover:bg-surfaceMuted shadow-none">
                <Plus className="size-3.5" />
                Add to Screener
              </Button>
              <Button variant="ghost" size="sm" className="gap-1.5 text-accent font-semibold hover:bg-accentSoft">
                <Sparkles className="size-3.5" />
                Suggest with AI
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface shadow-none">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-sm font-bold tracking-tight text-textPrimary">
              Variable Library
            </CardTitle>
            <Text variant="caption" className="text-[11px] text-textSecondary">
              Click to insert into formula
            </Text>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-1.5 max-h-[300px] overflow-y-auto">
              {variables.map((v) => (
                <button
                  key={v.id}
                  onClick={() =>
                    setFormula((f) => `${f.replace(/\s+$/, "")} ${v.label} `)
                  }
                  className="rounded-md border border-border bg-surfaceMuted px-2 py-1 text-[11px] font-mono text-textSecondary hover:bg-accentSoft/40 hover:text-accent cursor-pointer transition-colors"
                >
                  {v.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-surface shadow-none">
        <CardHeader className="pb-3 border-b border-border/50">
          <CardTitle className="text-sm font-bold tracking-tight text-textPrimary">
            Saved Custom Ratios
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pt-0">
          <Table>
            <TableHeader className="bg-surfaceMuted">
              <TableRow className="border-b border-border">
                <TableHead className="text-[10px] font-bold uppercase tracking-wider text-textSecondary">
                  Name
                </TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-wider text-textSecondary">
                  Formula
                </TableHead>
                <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider text-textSecondary">
                  Sample (TCS)
                </TableHead>
                <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider text-textSecondary">
                  Updated
                </TableHead>
                <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider text-textSecondary">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border/50">
              {savedRatios.map((r) => (
                <TableRow key={r.name} className="hover:bg-tableRowHover border-b border-border/50">
                  <TableCell>
                    <Text variant="body" className="font-semibold text-textPrimary">{r.name}</Text>
                    <Text variant="caption" className="text-[11px] text-textSecondary mt-0.5">
                      {r.description}
                    </Text>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-[11px] border-border text-textSecondary shadow-none bg-surfaceMuted">
                      {r.formula}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Text variant="numeric" className="font-semibold text-textPrimary">{r.sample.toLocaleString("en-IN")}</Text>
                  </TableCell>
                  <TableCell className="text-right">
                    <Text variant="caption" className="font-mono text-textSecondary text-[11px]">{r.updated}</Text>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="font-semibold text-accent hover:bg-accentSoft">
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}

export default CustomRatios

