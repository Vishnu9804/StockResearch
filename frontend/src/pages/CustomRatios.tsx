import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "react-hot-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { variables, type Variable } from "@/lib/data/screener"
import {
  AlertTriangle, Calculator, CheckCircle2, Clock, FilePlus2, Lightbulb,
  Loader2, LogIn, Plus, Save, Sparkles, Tag, Trash2, Edit3, XCircle,
} from "lucide-react"
import { Text } from "@/components/ui/Text"
import { Heading } from "@/components/ui/Heading"
import { cn } from "@/lib/utils"
import { useAppSelector } from "@/store/hooks"
import { customRatiosApi, type CustomRatioDto, type EvaluateFormulaResult } from "@/services/finscreenApi"

const VARIABLE_GROUPS = [
  "Valuation", "Profitability", "Debt & Liquidity", "Growth",
  "Management Quality", "Dividends", "Technical", "Size", "Efficiency", "Shareholding",
]

const STARTER_TEMPLATES = [
  { name: "Graham Number", formula: "(EPS (TTM) * 22.5 * Book Value Per Share) ^ 0.5" },
  { name: "Price to Sales", formula: "Market Cap / Revenue (TTM)" },
  { name: "Earnings Yield", formula: "100 / P/E Ratio" },
]

const categoryColor = (cat: string) => {
  if (cat === "Valuation" || cat === "Size") return "bg-accentSoft text-accent border-accent/20"
  if (cat === "Profitability" || cat === "Growth" || cat === "Dividends") return "bg-positive-soft/60 text-positive border-positive/20"
  return "bg-warning-soft/60 text-warning border-warning/20"
}

// Longest label first so a longer variable name is matched whole before a
// shorter overlapping one — mirrors backend/services/custom_ratio_engine.py.
const VARIABLES_BY_LABEL_LEN_DESC = [...variables].sort((a, b) => b.label.length - a.label.length)

function detectVariablesInFormula(formula: string): Variable[] {
  const found: Variable[] = []
  const seen = new Set<string>()
  let working = formula
  for (const v of VARIABLES_BY_LABEL_LEN_DESC) {
    if (working.toLowerCase().includes(v.label.toLowerCase())) {
      if (!seen.has(v.id)) {
        seen.add(v.id)
        found.push(v)
      }
      working = working.replace(new RegExp(v.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), "")
    }
  }
  return found
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 })
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

export function CustomRatios() {
  const { isAuthenticated } = useAppSelector((state) => state.auth)

  const [name, setName] = useState("Graham Number")
  const [formula, setFormula] = useState("(EPS (TTM) * 22.5 * Book Value Per Share) ^ 0.5")
  const [description, setDescription] = useState("")
  const [ticker, setTicker] = useState("RELIANCE")
  const [activeGroup, setActiveGroup] = useState("Valuation")

  const [savedRatios, setSavedRatios] = useState<CustomRatioDto[]>([])
  const [loadingSaved, setLoadingSaved] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [preview, setPreview] = useState<EvaluateFormulaResult | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const insertVariable = (label: string) => {
    setFormula((f) => `${f.trimEnd()} ${label} `.trimStart())
  }

  const filteredVars = variables.filter((v) => activeGroup === "All" || v.category === activeGroup)
  const usedVariables = useMemo(() => detectVariablesInFormula(formula), [formula])

  // ── Load the signed-in user's saved custom ratios ──────────────────────────
  const loadSavedRatios = useCallback(() => {
    if (!isAuthenticated) {
      setSavedRatios([])
      setLoadingSaved(false)
      return
    }
    setLoadingSaved(true)
    customRatiosApi.list()
      .then((res) => setSavedRatios(res.ratios ?? []))
      .catch(() => toast.error("Could not load your saved custom ratios."))
      .finally(() => setLoadingSaved(false))
  }, [isAuthenticated])

  useEffect(() => { loadSavedRatios() }, [loadSavedRatios])

  // ── Live preview: debounced evaluate against the selected ticker ──────────
  useEffect(() => {
    if (!formula.trim() || !ticker.trim()) {
      setPreview(null)
      setPreviewError(null)
      return
    }
    setPreviewLoading(true)
    setPreviewError(null)
    const handle = setTimeout(() => {
      customRatiosApi.evaluate(formula, ticker.trim().toUpperCase())
        .then((res) => setPreview(res))
        .catch((err) => {
          setPreview(null)
          setPreviewError(err?.response?.data?.detail || "Could not evaluate this formula.")
        })
        .finally(() => setPreviewLoading(false))
    }, 600)
    return () => clearTimeout(handle)
  }, [formula, ticker])

  const resetForm = () => {
    setEditingId(null)
    setName("")
    setFormula("")
    setDescription("")
  }

  const applyTemplate = (t: { name: string; formula: string }) => {
    setEditingId(null)
    setName(t.name)
    setFormula(t.formula)
    setDescription("")
  }

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Give your ratio a name first.")
      return
    }
    if (!formula.trim()) {
      toast.error("Write a formula first.")
      return
    }
    setSaving(true)
    try {
      if (editingId) {
        const res = await customRatiosApi.update(editingId, { name, formula, description })
        toast.success(`"${res.ratio.name}" updated.`)
      } else {
        const res = await customRatiosApi.create(name, formula, description)
        toast.success(`"${res.ratio.name}" saved.`)
        setEditingId(res.ratio.id)
      }
      loadSavedRatios()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Could not save this ratio — check the formula.")
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (r: CustomRatioDto) => {
    setEditingId(r.id)
    setName(r.name)
    setFormula(r.formula)
    setDescription(r.description ?? "")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleDelete = async (r: CustomRatioDto) => {
    try {
      await customRatiosApi.remove(r.id)
      toast.success(`"${r.name}" deleted.`)
      if (editingId === r.id) resetForm()
      setSavedRatios((prev) => prev.filter((x) => x.id !== r.id))
    } catch {
      toast.error("Could not delete this ratio.")
    }
  }

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
              Create and manage custom financial metrics using existing data points
              {isAuthenticated && savedRatios.length > 0 && (
                <>
                  {' '}·{' '}
                  <span className="font-medium text-accent">
                    {savedRatios.length} Active Ratio{savedRatios.length === 1 ? "" : "s"}
                  </span>
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {editingId && (
              <Button variant="outline" size="sm" onClick={resetForm} className="gap-1.5 text-xs border-border text-textSecondary shadow-none font-medium">
                <FilePlus2 className="size-3.5" />
                New Ratio
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 py-5 lg:px-6 lg:py-6">
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_300px]">

          {/* ══ LEFT: Formula Builder ═════════════════════════════════ */}
          <div className="space-y-5">
            <Card className="border-border/40 shadow-xs bg-surface rounded-2xl">
              <CardHeader className="pb-3 border-b border-border/40">
                <CardTitle className="flex items-center gap-2 text-sm font-medium tracking-tight text-textPrimary">
                  <Calculator className="size-4 text-accent" />
                  {editingId ? "Edit Ratio" : "Formula Builder"}
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
                        placeholder="e.g. (EPS (TTM) * 22.5 * Book Value Per Share) ^ 0.5"
                      />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-textMuted">
                      <span>Use the Variable Library to insert real data points · supports + − × ÷ ^ ( )</span>
                    </div>
                  </div>

                  {/* Variable Library */}
                  <div className="space-y-1.5">
                    <Text variant="label" as="span" className="text-xs tracking-widest uppercase text-textMuted font-medium">
                      Variable Library
                    </Text>
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
                      {filteredVars.map((v) => (
                        <button
                          key={v.id}
                          onClick={() => insertVariable(v.label)}
                          title={v.description}
                          className="w-full text-left px-2.5 py-1.5 rounded-md border border-border bg-surfaceMuted text-xs font-mono text-textSecondary hover:bg-accentSoft/40 hover:text-accent hover:border-accent/30 cursor-pointer transition-all block"
                        >
                          {v.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Validation indicator */}
                <div className={cn(
                  "flex items-center justify-between rounded-lg border px-4 py-2.5",
                  previewLoading ? "bg-surfaceMuted/50 border-border/40"
                    : previewError || (preview && !preview.success) ? "bg-warning-soft/40 border-warning/10"
                    : preview?.success ? "bg-positive-soft/40 border-positive/10"
                    : "bg-surfaceMuted/50 border-border/40"
                )}>
                  <div className={cn(
                    "flex items-center gap-2 text-xs font-medium",
                    previewLoading ? "text-textMuted"
                      : previewError || (preview && !preview.success) ? "text-warning"
                      : preview?.success ? "text-positive"
                      : "text-textMuted"
                  )}>
                    {previewLoading ? (
                      <><Loader2 className="size-3.5 animate-spin" /> Validating formula…</>
                    ) : previewError ? (
                      <><XCircle className="size-3.5" /> {previewError}</>
                    ) : preview && !preview.success ? (
                      <><AlertTriangle className="size-3.5" /> {preview.message ?? "Some variables have no live data for this ticker."}</>
                    ) : preview?.success ? (
                      <><CheckCircle2 className="size-3.5" /> Formula is valid</>
                    ) : (
                      <>Type a formula and pick a ticker to validate</>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Text variant="caption" className="text-xs text-textMuted font-mono">
                      {ticker || "—"} →
                    </Text>
                    <Text variant="numeric" className="font-medium text-textPrimary text-sm">
                      {preview?.success && preview.value !== undefined ? formatNumber(preview.value) : "—"}
                    </Text>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={saving || !isAuthenticated}
                    title={!isAuthenticated ? "Sign in to save custom ratios" : undefined}
                    className="gap-1.5 bg-accent hover:bg-accent/90 text-white font-medium shadow-none"
                  >
                    {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                    {editingId ? "Update Ratio" : "Save New Ratio"}
                  </Button>
                  {!isAuthenticated && (
                    <Link to="/login">
                      <Button variant="outline" size="sm" className="gap-1.5 font-medium border-border text-textSecondary hover:bg-surfaceMuted shadow-none">
                        <LogIn className="size-3.5" />
                        Sign in to save
                      </Button>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Saved Ratios: hidden/unobtrusive when empty, full table when populated */}
            {!isAuthenticated ? (
              <Card className="border-dashed border-border/50 shadow-none bg-surfaceMuted/30 rounded-2xl">
                <CardContent className="py-6 text-center">
                  <Text variant="caption" className="text-xs text-textMuted">
                    Sign in to save custom ratios and see them here across sessions.
                  </Text>
                </CardContent>
              </Card>
            ) : loadingSaved ? (
              <Card className="border-border/40 shadow-xs bg-surface rounded-2xl">
                <CardContent className="py-8 flex items-center justify-center gap-2 text-textMuted text-xs">
                  <Loader2 className="size-4 animate-spin" /> Loading your saved ratios…
                </CardContent>
              </Card>
            ) : savedRatios.length === 0 ? (
              <Card className="border-dashed border-border/50 shadow-none bg-surfaceMuted/20 rounded-2xl">
                <CardContent className="py-8 text-center space-y-1">
                  <Text variant="body" className="text-xs font-medium text-textSecondary">
                    No custom ratios saved yet
                  </Text>
                  <Text variant="caption" className="text-xs text-textMuted">
                    Build a formula above and click "Save New Ratio" to keep it here.
                  </Text>
                </CardContent>
              </Card>
            ) : (
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
                        <TableRow key={r.id} className="hover:bg-tableRowHover border-b border-border/50">
                          <TableCell>
                            <Text variant="body" className="font-medium text-textPrimary text-xs">{r.name}</Text>
                            {r.description && (
                              <Text variant="caption" className="text-xs text-textSecondary mt-0.5">{r.description}</Text>
                            )}
                          </TableCell>
                          <TableCell>
                            <code className="text-xs font-mono text-accent bg-accentSoft/60 border border-accent/20 px-1.5 py-0.5 rounded">
                              {r.formula}
                            </code>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1 text-xs text-textMuted font-mono">
                              <Clock className="size-2.5" />
                              {formatRelativeTime(r.updatedAt)}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleEdit(r)}
                                className="size-7 rounded-md flex items-center justify-center hover:bg-accentSoft hover:text-accent transition-colors text-textMuted"
                              >
                                <Edit3 className="size-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(r)}
                                className="size-7 rounded-md flex items-center justify-center hover:bg-negative-soft/50 hover:text-negative transition-colors text-textMuted"
                              >
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
            )}
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
                  Use parentheses to control order of operations, and <code className="bg-white/10 px-1 rounded">^</code> for powers
                  (e.g. <code className="bg-white/10 px-1 rounded">^ 0.5</code> for a square root).
                </p>
              </CardContent>
            </Card>

            {/* Starter Templates */}
            <Card className="border-border/40 shadow-xs bg-surface rounded-2xl">
              <CardHeader className="pb-3 border-b border-border/40">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-textPrimary">
                  <Sparkles className="size-3.5 text-accent" />
                  Starter Templates
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3 space-y-1.5">
                {STARTER_TEMPLATES.map((t) => (
                  <button
                    key={t.name}
                    onClick={() => applyTemplate(t)}
                    className="w-full text-left px-2.5 py-2 rounded-md border border-border bg-surfaceMuted/50 hover:bg-accentSoft/40 hover:border-accent/30 transition-all"
                  >
                    <div className="text-xs font-medium text-textPrimary">{t.name}</div>
                    <div className="text-xs font-mono text-textMuted mt-0.5 truncate">{t.formula}</div>
                  </button>
                ))}
              </CardContent>
            </Card>

            {/* Variables used in the current formula */}
            <Card className="border-border/40 shadow-xs bg-surface rounded-2xl">
              <CardHeader className="pb-3 border-b border-border/40">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-textPrimary">
                  <Tag className="size-3.5 text-accent" />
                  Variables In This Formula
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3 space-y-2">
                {usedVariables.length === 0 ? (
                  <Text variant="caption" className="text-xs text-textMuted">
                    Insert a variable from the library to see it here.
                  </Text>
                ) : (
                  usedVariables.map((rv) => (
                    <div key={rv.id} className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-textPrimary truncate">{rv.label}</span>
                      <span className={cn("text-xs font-medium uppercase tracking-wider border-none px-2 py-0.5 rounded-full shrink-0", categoryColor(rv.category))}>
                        {preview?.resolvedVariables?.[rv.label] !== undefined
                          ? formatNumber(preview.resolvedVariables[rv.label])
                          : rv.category}
                      </span>
                    </div>
                  ))
                )}
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
                      className="h-7 w-24 font-mono text-xs text-right border-border bg-surface font-medium text-accent"
                    />
                  </div>
                </div>
                <div className="bg-surfaceMuted/50 rounded-xl p-4.5 text-center border border-border/40">
                  <p className="text-xs text-textMuted uppercase tracking-wider mb-1">Live Result</p>
                  {previewLoading ? (
                    <div className="flex items-center justify-center py-1">
                      <Loader2 className="size-5 animate-spin text-accent" />
                    </div>
                  ) : preview?.success && preview.value !== undefined ? (
                    <div className="text-2xl font-medium font-mono text-accent tabular-nums">
                      {formatNumber(preview.value)}
                    </div>
                  ) : (
                    <div className="text-sm font-medium text-textMuted py-1.5">
                      {previewError ?? preview?.message ?? "—"}
                    </div>
                  )}
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
