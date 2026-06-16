import { useState } from "react"
import { Link } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { variables } from "@/lib/data/screener"
import {
  Calculator, CheckCircle2, ChevronRight, Clock, Lightbulb,
  Plus, Save, Sparkles, Tag, Trash2, TrendingUp, Edit3,
} from "lucide-react"
import { Text } from "@/components/ui/Text"
import { Heading } from "@/components/ui/Heading"
import { cn } from "@/lib/utils"

const savedRatios = [
  {
    name: "Graham Number",
    formula: "(EPS * 22.5 * Book Value) ^ 0.5",
    description: "Benjamin Graham's intrinsic value formula",
    sample: 1842.5,
    updated: "Just now",
  },
  {
    name: "Price to Sales",
    formula: "Market Cap / Revenue",
    description: "Market cap relative to annual revenue",
    sample: 8.4,
    updated: "2 days ago",
  },
  {
    name: "Quick Ratio",
    formula: "(Current Assets - Inventory) / Current Liabilities",
    description: "Liquid asset coverage of short-term debt",
    sample: 1.12,
    updated: "Oct 12, 2024",
  },
]

const recentVariables = [
  { label: "Operating Income", category: "Financial" },
  { label: "Dividend Yield", category: "Market" },
  { label: "Long Term Debt", category: "Liability" },
]

const VARIABLE_GROUPS = [
  "Valuation", "Profitability", "Leverage", "Growth", "Efficiency",
]

const categoryColor = (cat: string) => {
  if (cat === "Financial") return "bg-accentSoft text-accent border-accent/20"
  if (cat === "Market") return "bg-positive-soft/60 text-positive border-positive/20"
  return "bg-warning-soft/60 text-warning border-warning/20"
}

export function CustomRatios() {
  const [name, setName] = useState("Graham Number")
  const [formula, setFormula] = useState("(EPS * 22.5 * Book Value) ^ 0.5")
  const [ticker, setTicker] = useState("AAPL")
  const [activeGroup, setActiveGroup] = useState("Valuation")

  const insertVariable = (label: string) => {
    setFormula((f) => `${f.trimEnd()} ${label} `)
  }

  const filteredVars = variables.filter((v) =>
    activeGroup === "All" || v.category === activeGroup
  )

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-surface/95 backdrop-blur-sm border-b border-border px-6 py-4 shadow-[var(--shadow-xs)]">
        <div className="text-xs text-textSecondary/70 mb-1.5">
          <Link to="/" className="hover:text-accent transition-colors">Home</Link>
          <span className="mx-1.5">›</span>
          <span className="text-accent font-medium">Custom Ratios</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <Heading level={1} variant="pageTitle" className="text-textPrimary">
              Custom Columns &amp; Ratios
            </Heading>
            <p className="text-body text-textSecondary mt-1">
              Create and manage custom financial metrics using existing data points ·{' '}
              <span className="font-medium text-accent">
                {savedRatios.length} Active Ratios
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="text-xs border-border text-textSecondary shadow-none font-medium">
              Import Metrics
            </Button>
            <Button variant="outline" size="sm" className="text-xs border-border text-textSecondary shadow-none font-medium">
              Documentation
            </Button>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 lg:px-6 lg:py-6">
        {/* ── Main 2-column layout ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_300px]">

          {/* ══ LEFT: Formula Builder ═════════════════════════════════ */}
          <div className="space-y-5">
            <Card className="border-border/40 shadow-xs bg-surface rounded-2xl">
              <CardHeader className="pb-3 border-b border-border/40">
                <CardTitle className="flex items-center gap-2 text-sm font-medium tracking-tight text-textPrimary">
                  <Calculator className="size-4 text-accent" />
                  Formula Builder
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-5 space-y-4">
                {/* Ratio Name input */}
                <div className="space-y-1.5">
                  <Text variant="label" as={Label} htmlFor="ratio-name" className="text-xs tracking-widest uppercase text-textMuted font-medium">
                    Ratio Name
                  </Text>
                  <Input
                    id="ratio-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Graham Number"
                    className="h-9 border-border bg-surface text-xs text-textPrimary"
                  />
                </div>

                {/* Dual-pane: Formula Editor + Variable Library */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_260px]">
                  {/* Formula Editor */}
                  <div className="space-y-1.5">
                    <Text variant="label" as={Label} htmlFor="ratio-formula" className="text-xs tracking-widest uppercase text-textMuted font-medium">
                      Formula Editor
                    </Text>
                    <div className="relative">
                      <Textarea
                        id="ratio-formula"
                        value={formula}
                        onChange={(e) => setFormula(e.target.value)}
                        className="min-h-[160px] font-mono text-xs border-border bg-[#0f1629] text-[#93c5fd] placeholder:text-slate-600 resize-none rounded-lg"
                        placeholder="e.g. (EPS * 22.5 * Book Value) ^ 0.5"
                      />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-textMuted">
                      <span className="font-mono bg-surfaceMuted px-1.5 py-0.5 rounded text-textSecondary">⌘+Enter</span>
                      <span>to validate formula</span>
                    </div>
                  </div>

                  {/* Variable Library */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Text variant="label" as="span" className="text-xs tracking-widest uppercase text-textMuted font-medium">
                        Variable Library
                      </Text>
                      <button className="text-xs text-accent hover:underline font-medium">View All</button>
                    </div>
                    {/* Group filter tabs */}
                    <div className="flex flex-wrap gap-1">
                      {VARIABLE_GROUPS.map((g) => (
                        <button
                          key={g}
                          onClick={() => setActiveGroup(g)}
                          className={cn(
                            "text-xs font-medium uppercase tracking-wide px-2 py-1 rounded-md border transition-all",
                            activeGroup === g
                              ? "bg-accent text-white border-transparent"
                              : "border-border text-textSecondary hover:bg-surfaceMuted"
                          )}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                    <div className="space-y-1 max-h-[120px] overflow-y-auto pr-1">
                      {filteredVars.slice(0, 12).map((v) => (
                        <button
                          key={v.id}
                          onClick={() => insertVariable(v.label)}
                          className="w-full text-left px-2.5 py-1.5 rounded-md border border-border bg-surfaceMuted text-xs font-mono text-textSecondary hover:bg-accentSoft/40 hover:text-accent hover:border-accent/30 cursor-pointer transition-all block"
                        >
                          {v.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Validation indicator */}
                <div className="flex items-center justify-between rounded-lg border bg-positive-soft/40 border-positive/10 px-4 py-2.5">
                  <div className="flex items-center gap-2 text-xs font-medium text-positive">
                    <CheckCircle2 className="size-3.5" />
                    Formula is valid
                  </div>
                  <div className="flex items-center gap-2">
                    <Text variant="caption" className="text-xs text-textMuted font-mono">
                      {ticker} →
                    </Text>
                    <Text variant="numeric" className="font-medium text-textPrimary text-sm">
                      ₹1,842.50
                    </Text>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Button size="sm" className="gap-1.5 bg-accent hover:bg-accent/90 text-white font-medium shadow-none">
                    <Save className="size-3.5" />
                    Save New Ratio
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5 font-medium border-border text-textSecondary hover:bg-surfaceMuted shadow-none">
                    <Plus className="size-3.5" />
                    Add to Screener
                  </Button>
                  <Button variant="ghost" size="sm" className="gap-1.5 text-accent font-medium hover:bg-accentSoft">
                    <Sparkles className="size-3.5" />
                    Suggest with AI
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Saved Ratios Table */}
            <Card className="border-border/40 shadow-xs bg-surface rounded-2xl">
              <CardHeader className="pb-3 border-b border-border/40">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium tracking-tight text-textPrimary">
                    Saved Custom Ratios
                  </CardTitle>
                  <Badge variant="secondary" className="text-xs font-medium">
                    {savedRatios.length} Active
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="px-0 pt-0">
                <Table>
                  <TableHeader className="bg-surfaceMuted/50">
                    <TableRow className="border-b border-border/40">
                      <TableHead className="text-xs font-medium uppercase tracking-wider text-textSecondary">Name</TableHead>
                      <TableHead className="text-xs font-medium uppercase tracking-wider text-textSecondary">Formula</TableHead>
                      <TableHead className="text-right text-xs font-medium uppercase tracking-wider text-textSecondary">Last Modified</TableHead>
                      <TableHead className="text-right text-xs font-medium uppercase tracking-wider text-textSecondary">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-border/50">
                    {savedRatios.map((r) => (
                      <TableRow key={r.name} className="hover:bg-tableRowHover border-b border-border/50">
                        <TableCell>
                          <Text variant="body" className="font-medium text-textPrimary text-xs">{r.name}</Text>
                          <Text variant="caption" className="text-xs text-textSecondary mt-0.5">{r.description}</Text>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs font-mono text-accent bg-accentSoft/60 border border-accent/20 px-1.5 py-0.5 rounded">
                            {r.formula}
                          </code>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1 text-xs text-textMuted font-mono">
                            <Clock className="size-2.5" />
                            {r.updated}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button className="size-7 rounded-md flex items-center justify-center hover:bg-accentSoft hover:text-accent transition-colors text-textMuted">
                              <Edit3 className="size-3.5" />
                            </button>
                            <button className="size-7 rounded-md flex items-center justify-center hover:bg-negative-soft/50 hover:text-negative transition-colors text-textMuted">
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* ══ RIGHT: Sidebar ════════════════════════════════════════ */}
          <div className="space-y-4">
            {/* Institutional Pro-Tip */}
            <Card className="border-transparent bg-accent shadow-xs text-white rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-white">
                  <Lightbulb className="size-4 text-yellow-300" />
                  Institutional Pro-Tip
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <p className="text-xs text-blue-100 leading-relaxed">
                  Custom ratios can be used across all Screeners and Portfolio Analysis modules. Use parentheses to ensure proper order of operations.
                </p>
                <button className="text-xs font-medium text-white underline underline-offset-2 hover:text-blue-200 transition-colors">
                  Learn syntax rules →
                </button>
              </CardContent>
            </Card>

            {/* Recent Variables Used */}
            <Card className="border-border/40 shadow-xs bg-surface rounded-2xl">
              <CardHeader className="pb-3 border-b border-border/40">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-textPrimary">
                  <Tag className="size-3.5 text-accent" />
                  Recent Variables Used
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3 space-y-2">
                {recentVariables.map((rv) => (
                  <div key={rv.label} className="flex items-center justify-between">
                    <span className="text-xs font-medium text-textPrimary">{rv.label}</span>
                    <span className={cn("text-xs font-medium uppercase tracking-wider border-none px-2 py-0.5 rounded-full", categoryColor(rv.category))}>
                      {rv.category}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Calculated Preview */}
            <Card className="border-border/40 shadow-xs bg-surface rounded-2xl">
              <CardHeader className="pb-3 border-b border-border/40">
                <CardTitle className="text-sm font-medium text-textPrimary">Calculated Preview</CardTitle>
              </CardHeader>
              <CardContent className="pt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-textSecondary font-medium">Selected Ticker:</span>
                  <div className="flex items-center gap-1.5">
                    <Input
                      value={ticker}
                      onChange={(e) => setTicker(e.target.value.toUpperCase())}
                      className="h-7 w-20 font-mono text-xs text-right border-border bg-surface font-medium text-accent"
                    />
                  </div>
                </div>
                <div className="bg-surfaceMuted/50 rounded-xl p-4.5 text-center border border-border/40">
                  <p className="text-xs text-textMuted uppercase tracking-wider mb-1">Live Result (Est.)</p>
                  <div className="text-2xl font-medium font-mono text-accent tabular-nums">142.85</div>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <TrendingUp className="size-3 text-positive" />
                    <span className="text-xs text-positive font-medium">+2.4% vs Industry Avg</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CustomRatios
