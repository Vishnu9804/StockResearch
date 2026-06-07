'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Plus, X, Play, Save, Sparkles, Code2, LayoutList, HelpCircle, BookOpen, Keyboard, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Variable } from './variables-sidebar'

type Operator = '>' | '>=' | '<' | '<=' | '=' | '!=' | 'between'

interface FilterRow {
  id: string
  connector: 'WHERE' | 'AND'
  variable: string
  variableLabel: string
  operator: Operator
  value: string
  valueTo: string
}

interface QueryBuilderProps {
  insertedVariable?: Variable | null
  onInsertConsumed?: () => void
  onOpenVariables?: () => void
}

const OPERATORS: { value: Operator; label: string }[] = [
  { value: '>', label: '>' },
  { value: '>=', label: '>=' },
  { value: '<', label: '<' },
  { value: '<=', label: '<=' },
  { value: '=', label: '=' },
  { value: '!=', label: '≠' },
  { value: 'between', label: 'btw' },
]

const VARIABLE_OPTIONS = [
  { id: 'market_cap', label: 'Market Cap', category: 'Valuation' },
  { id: 'pe', label: 'P/E Ratio', category: 'Valuation' },
  { id: 'pb', label: 'P/B Ratio', category: 'Valuation' },
  { id: 'ev_ebitda', label: 'EV/EBITDA', category: 'Valuation' },
  { id: 'div_yield', label: 'Dividend Yield', category: 'Valuation' },
  { id: 'roe', label: 'ROE', category: 'Profitability' },
  { id: 'roce', label: 'ROCE', category: 'Profitability' },
  { id: 'net_margin', label: 'Net Profit Margin', category: 'Profitability' },
  { id: 'ebitda_margin', label: 'EBITDA Margin', category: 'Profitability' },
  { id: 'roa', label: 'ROA', category: 'Profitability' },
  { id: 'de_ratio', label: 'D/E Ratio', category: 'Debt & Liquidity' },
  { id: 'current_ratio', label: 'Current Ratio', category: 'Debt & Liquidity' },
  { id: 'interest_coverage', label: 'Interest Coverage', category: 'Debt & Liquidity' },
  { id: 'sales_growth_1y', label: 'Sales Growth 1Y', category: 'Growth' },
  { id: 'sales_growth_3y', label: 'Sales Growth 3Y', category: 'Growth' },
  { id: 'profit_growth_3y', label: 'Profit Growth 3Y', category: 'Growth' },
  { id: 'eps_growth', label: 'EPS Growth 3Y', category: 'Growth' },
  { id: 'promoter_pct', label: 'Promoter Holding %', category: 'Shareholding' },
  { id: 'fii_pct', label: 'FII Holding %', category: 'Shareholding' },
  { id: 'pledge_pct', label: 'Promoter Pledge %', category: 'Shareholding' },
  { id: 'rsi', label: 'RSI (14)', category: 'Technical' },
  { id: 'beta', label: 'Beta', category: 'Technical' },
  { id: 'debtor_days', label: 'Debtor Days', category: 'Efficiency' },
  { id: 'asset_turnover', label: 'Asset Turnover', category: 'Efficiency' },
]

const VARIABLE_CATEGORIES = ['Valuation', 'Profitability', 'Debt & Liquidity', 'Growth', 'Shareholding', 'Technical', 'Efficiency']

const DEFAULT_FILTERS: FilterRow[] = [
  { id: '1', connector: 'WHERE', variable: 'market_cap', variableLabel: 'Market Cap', operator: '>=', value: '500', valueTo: '' },
  { id: '2', connector: 'AND', variable: 'roe', variableLabel: 'ROE', operator: '>', value: '15', valueTo: '' },
  { id: '3', connector: 'AND', variable: 'de_ratio', variableLabel: 'D/E Ratio', operator: '<', value: '1', valueTo: '' },
  { id: '4', connector: 'AND', variable: 'profit_growth_3y', variableLabel: 'Profit Growth 3Y', operator: '>', value: '10', valueTo: '' },
]

const DEFAULT_SQL = `SELECT 
  company_name,
  ticker,
  market_cap,
  pe_ratio,
  roe,
  roce,
  de_ratio,
  profit_growth_3y
FROM stocks
WHERE market_cap >= 500          -- Market Cap >= 500 Cr
  AND roe > 15                   -- ROE > 15%
  AND de_ratio < 1               -- D/E Ratio < 1
  AND profit_growth_3y > 10      -- Profit Growth 3Y > 10%
ORDER BY market_cap DESC
LIMIT 50`

function generateId(): string {
  return `filter_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

function validateSQL(sql: string): { valid: boolean; message: string } {
  const trimmed = sql.trim().toUpperCase()
  if (!trimmed) return { valid: false, message: 'Query cannot be empty' }
  if (!trimmed.startsWith('SELECT')) return { valid: false, message: 'Query must start with SELECT' }
  if (!trimmed.includes('FROM')) return { valid: false, message: 'Missing FROM clause' }
  if (!trimmed.includes('WHERE')) return { valid: false, message: 'Missing WHERE clause' }
  const unbalanced = (sql.match(/\(/g) ?? []).length !== (sql.match(/\)/g) ?? []).length
  if (unbalanced) return { valid: false, message: 'Unbalanced parentheses' }
  return { valid: true, message: '✓ Valid query' }
}

const SQL_KEYWORDS = ['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'ORDER', 'BY', 'LIMIT', 'ASC', 'DESC', 'NOT', 'IN', 'BETWEEN', 'LIKE', 'IS', 'NULL']
const SQL_METRICS = ['market_cap', 'pe_ratio', 'roe', 'roce', 'de_ratio', 'profit_growth_3y', 'company_name', 'ticker', 'div_yield', 'net_margin', 'sales_growth_3y']

function highlightSQL(sql: string): string {
  let h = sql.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  h = h.replace(/\b(\d+(\.\d+)?)\b/g, '<span class="text-positive font-mono">$1</span>')
  SQL_METRICS.forEach((m) => { h = h.replace(new RegExp(`\\b(${m})\\b`, 'gi'), '<span class="text-purple-600 font-mono">$1</span>') })
  SQL_KEYWORDS.forEach((kw) => { h = h.replace(new RegExp(`\\b(${kw})\\b`, 'gi'), '<span class="text-accent font-semibold">$1</span>') })
  h = h.replace(/(--[^\n]*)/g, '<span class="text-textMuted italic">$1</span>')
  return h
}

// ─── Variable Select ──────────────────────────────────────────────────────────
// Extracted as a native <select> wrapper so it stretches to 100% of its container
// regardless of content length — fixing the "blank / collapsed" bug on mobile.
function VariableSelect({
  value,
  onChange,
  className = '',
}: {
  value: string
  onChange: (v: string) => void
  className?: string
}) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="
          w-full h-8 pl-3 pr-8 rounded-md border border-input bg-transparent
          text-xs text-textPrimary appearance-none outline-none cursor-pointer
          focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:border-ring
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-[color,box-shadow]
        "
      >
        <option value="" disabled>Select variable...</option>
        {VARIABLE_CATEGORIES.map((cat) => {
          const opts = VARIABLE_OPTIONS.filter((o) => o.category === cat)
          if (opts.length === 0) return null
          return (
            <optgroup key={cat} label={cat}>
              {opts.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </optgroup>
          )
        })}
      </select>
      {/* Custom chevron */}
      <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  )
}

// ─── Operator Select ──────────────────────────────────────────────────────────
function OperatorSelect({
  value,
  onChange,
}: {
  value: Operator
  onChange: (v: Operator) => void
}) {
  return (
    <div className="relative w-[72px] flex-shrink-0">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Operator)}
        className="
          w-full h-8 pl-2.5 pr-7 rounded-md border border-input bg-transparent
          text-xs font-mono text-textPrimary appearance-none outline-none cursor-pointer
          focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:border-ring
          transition-[color,box-shadow]
        "
      >
        {OPERATORS.map((op) => (
          <option key={op.value} value={op.value}>{op.label}</option>
        ))}
      </select>
      <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
          <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  )
}

// ─── Connector Select ─────────────────────────────────────────────────────────
function ConnectorSelect({
  value,
  onChange,
}: {
  value: 'WHERE' | 'AND'
  onChange: (v: 'WHERE' | 'AND') => void
}) {
  return (
    <div className="relative w-[68px] flex-shrink-0">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as 'WHERE' | 'AND')}
        className="
          w-full h-8 pl-2 pr-6 rounded-md border border-input bg-surfaceMuted
          text-xs text-textPrimary appearance-none outline-none cursor-pointer
          focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:border-ring
          transition-[color,box-shadow]
        "
      >
        <option value="AND">AND</option>
        <option value="WHERE">WHERE</option>
      </select>
      <div className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground">
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
          <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  )
}

// ─── QueryBuilder ─────────────────────────────────────────────────────────────
export function QueryBuilder({ insertedVariable, onInsertConsumed, onOpenVariables }: QueryBuilderProps) {
  const [mode, setMode] = useState<'visual' | 'sql'>('visual')
  const [filters, setFilters] = useState<FilterRow[]>(DEFAULT_FILTERS)
  const [sqlValue, setSqlValue] = useState(DEFAULT_SQL)
  const [sqlValidation, setSqlValidation] = useState(() => validateSQL(DEFAULT_SQL))
  const [isRunning, setIsRunning] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lineNumbersRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!insertedVariable) return
    if (mode === 'visual') {
      if (!filters.find((f) => f.variable === insertedVariable.id)) {
        setFilters((prev) => [...prev, {
          id: generateId(),
          connector: prev.length === 0 ? 'WHERE' : 'AND',
          variable: insertedVariable.id,
          variableLabel: insertedVariable.label,
          operator: '>',
          value: '',
          valueTo: '',
        }])
      }
    } else {
      if (textareaRef.current) {
        const pos = textareaRef.current.selectionStart
        setSqlValue(sqlValue.slice(0, pos) + insertedVariable.id + sqlValue.slice(pos))
      }
    }
    onInsertConsumed?.()
  }, [insertedVariable]) // eslint-disable-line react-hooks/exhaustive-deps

  const addFilter = () => {
    setFilters((prev) => [...prev, {
      id: generateId(),
      connector: prev.length === 0 ? 'WHERE' : 'AND',
      variable: '', variableLabel: '', operator: '>', value: '', valueTo: '',
    }])
  }

  const removeFilter = (id: string) => {
    setFilters((prev) => {
      const next = prev.filter((f) => f.id !== id)
      if (next.length > 0) next[0].connector = 'WHERE'
      return next
    })
  }

  const updateFilter = (id: string, patch: Partial<FilterRow>) =>
    setFilters((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)))

  const handleRun = () => { setIsRunning(true); setTimeout(() => setIsRunning(false), 1200) }

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-textPrimary">Query Builder</h2>
          <p className="text-xs text-textSecondary mt-0.5 hidden sm:block">Build filters to screen stocks</p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'visual' | 'sql')}>
            <TabsList className="h-8">
              <TabsTrigger value="visual" className="text-xs h-7 gap-1.5">
                <LayoutList className="w-3.5 h-3.5" />
                Visual
              </TabsTrigger>
              <TabsTrigger value="sql" className="text-xs h-7 gap-1.5">
                <Code2 className="w-3.5 h-3.5" />
                SQL
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {onOpenVariables && (
            <Button variant="outline" size="sm" onClick={onOpenVariables}
              className="lg:hidden h-8 px-2.5 text-xs gap-1.5 border-border">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Variables
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto min-h-0">
        {mode === 'visual' ? (
          <VisualMode filters={filters} onAdd={addFilter} onRemove={removeFilter}
            onUpdate={updateFilter} onRun={handleRun} isRunning={isRunning} />
        ) : (
          <SQLMode sqlValue={sqlValue} validation={sqlValidation}
            textareaRef={textareaRef} lineNumbersRef={lineNumbersRef}
            sqlLines={sqlValue.split('\n')}
            onSQLChange={(e) => { setSqlValue(e.target.value); setSqlValidation(validateSQL(e.target.value)) }}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); handleRun() } }}
            onRun={handleRun} isRunning={isRunning} />
        )}
      </div>
    </div>
  )
}

// ─── Visual Mode ───────────────────────────────────────────────────────────────
function VisualMode({ filters, onAdd, onRemove, onUpdate, onRun, isRunning }: {
  filters: FilterRow[]
  onAdd: () => void
  onRemove: (id: string) => void
  onUpdate: (id: string, patch: Partial<FilterRow>) => void
  onRun: () => void
  isRunning: boolean
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 p-4 space-y-2.5 overflow-auto">
        {filters.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-surfaceMuted flex items-center justify-center mb-3">
              <LayoutList className="w-6 h-6 text-textMuted" />
            </div>
            <p className="text-sm text-textSecondary font-medium">No filters added</p>
            <p className="text-xs text-textMuted mt-1">Click "+ Add Filter" or open Variables</p>
          </div>
        )}

        {filters.map((filter, index) => (
          <FilterRowUI key={filter.id} filter={filter} isFirst={index === 0}
            onRemove={() => onRemove(filter.id)}
            onUpdate={(patch) => onUpdate(filter.id, patch)} />
        ))}

        <button onClick={onAdd}
          className="flex items-center gap-1.5 text-xs text-accent hover:text-blue-800 font-medium mt-1 px-1 py-1 rounded hover:bg-accentSoft transition-colors">
          <Plus className="w-3.5 h-3.5" />
          Add Filter
        </button>
      </div>

      {/* Footer — desktop only (mobile uses page header buttons) */}
      <div className="border-t border-border p-4 hidden sm:flex items-center gap-2 flex-wrap flex-shrink-0">
        <Button onClick={onRun} disabled={isRunning}
          className="bg-accent hover:bg-accent/90 text-white h-9 px-5 text-sm gap-2">
          <Play className="w-3.5 h-3.5" />
          {isRunning ? 'Running...' : 'Run Query'}
        </Button>
        <Button variant="outline" className="h-9 px-4 text-sm gap-2">
          <Save className="w-3.5 h-3.5" />
          Save Screen
        </Button>
        <Button variant="ghost" className="h-9 px-4 text-sm gap-2 text-purple-600 hover:text-purple-700 hover:bg-purple-50">
          <Sparkles className="w-3.5 h-3.5" />
          AI Suggest
        </Button>
        {filters.length > 0 && (
          <span className="text-xs text-textMuted ml-auto">
            {filters.length} filter{filters.length !== 1 ? 's' : ''} active
          </span>
        )}
      </div>

      {/* Mobile footer: slim, no duplicate run button */}
      <div className="sm:hidden border-t border-border px-4 py-2.5 flex items-center gap-2 flex-shrink-0">
        <Button variant="ghost" size="sm" className="h-8 px-3 text-xs gap-1.5 text-purple-600 hover:text-purple-700 hover:bg-purple-50">
          <Sparkles className="w-3.5 h-3.5" />
          AI Suggest
        </Button>
        {filters.length > 0 && (
          <span className="text-xs text-textMuted ml-auto">
            {filters.length} filter{filters.length !== 1 ? 's' : ''} active
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Filter Row ───────────────────────────────────────────────────────────────
function FilterRowUI({ filter, isFirst, onRemove, onUpdate }: {
  filter: FilterRow
  isFirst: boolean
  onRemove: () => void
  onUpdate: (patch: Partial<FilterRow>) => void
}) {
  const handleVariableChange = (v: string) => {
    const found = VARIABLE_OPTIONS.find((o) => o.id === v)
    onUpdate({ variable: v, variableLabel: found?.label ?? v })
  }

  return (
    <>
      {/* ── Desktop row (sm+) ── */}
      <div className="hidden sm:flex items-center gap-2 group">
        {/* Connector — fixed width */}
        <div className="w-[72px] flex-shrink-0">
          {isFirst ? (
            <span className="flex items-center justify-center h-8 w-full text-xs font-semibold text-accent bg-accentSoft rounded-md">
              WHERE
            </span>
          ) : (
            <ConnectorSelect value={filter.connector} onChange={(v) => onUpdate({ connector: v })} />
          )}
        </div>

        {/* Variable — fills remaining space, MUST be a block container for select to stretch */}
        <div className="flex-1 min-w-0">
          <VariableSelect value={filter.variable} onChange={handleVariableChange} className="w-full" />
        </div>

        {/* Operator — fixed width */}
        <OperatorSelect value={filter.operator} onChange={(v) => onUpdate({ operator: v })} />

        {/* Value */}
        {filter.operator === 'between' ? (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Input className="h-8 w-20 text-xs font-mono" placeholder="From"
              value={filter.value} onChange={(e) => onUpdate({ value: e.target.value })} />
            <span className="text-xs text-textSecondary">–</span>
            <Input className="h-8 w-20 text-xs font-mono" placeholder="To"
              value={filter.valueTo} onChange={(e) => onUpdate({ valueTo: e.target.value })} />
          </div>
        ) : (
          <Input className="h-8 w-24 flex-shrink-0 text-xs font-mono" placeholder="Value"
            value={filter.value} onChange={(e) => onUpdate({ value: e.target.value })} />
        )}

        {/* Remove */}
        <button onClick={onRemove}
          className="p-1.5 rounded hover:bg-red-50 text-textMuted hover:text-red-500 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
          aria-label="Remove filter">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Mobile card ── */}
      <div className="sm:hidden bg-surface border border-border rounded-lg p-3 space-y-2">
        {/* Row 1: connector + remove */}
        <div className="flex items-center justify-between">
          {isFirst ? (
            <span className="text-xs font-semibold text-accent bg-accentSoft px-2.5 py-1 rounded">WHERE</span>
          ) : (
            <ConnectorSelect value={filter.connector} onChange={(v) => onUpdate({ connector: v })} />
          )}
          <button onClick={onRemove}
            className="p-1.5 rounded hover:bg-red-50 text-textMuted hover:text-red-500 transition-colors"
            aria-label="Remove filter">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Row 2: variable full-width */}
        <VariableSelect value={filter.variable} onChange={handleVariableChange} className="w-full" />

        {/* Row 3: operator + value */}
        <div className="flex items-center gap-2">
          <OperatorSelect value={filter.operator} onChange={(v) => onUpdate({ operator: v })} />
          {filter.operator === 'between' ? (
            <>
              <Input className="h-8 flex-1 text-xs font-mono" placeholder="From"
                value={filter.value} onChange={(e) => onUpdate({ value: e.target.value })} />
              <span className="text-xs text-textSecondary flex-shrink-0">–</span>
              <Input className="h-8 flex-1 text-xs font-mono" placeholder="To"
                value={filter.valueTo} onChange={(e) => onUpdate({ valueTo: e.target.value })} />
            </>
          ) : (
            <Input className="h-8 flex-1 text-xs font-mono" placeholder="Value"
              value={filter.value} onChange={(e) => onUpdate({ value: e.target.value })} />
          )}
        </div>
      </div>
    </>
  )
}

// ─── SQL Mode ─────────────────────────────────────────────────────────────────
function SQLMode({ sqlValue, validation, textareaRef, lineNumbersRef, sqlLines, onSQLChange, onKeyDown, onRun, isRunning }: {
  sqlValue: string
  validation: { valid: boolean; message: string }
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  lineNumbersRef: React.RefObject<HTMLDivElement | null>
  sqlLines: string[]
  onSQLChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onRun: () => void
  isRunning: boolean
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surfaceMuted flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xs font-semibold text-gray-700 hidden sm:inline">SQL Editor</span>
          <div className="flex items-center gap-1.5 min-w-0">
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${validation.valid ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className={`text-xs font-mono truncate ${validation.valid ? 'text-positive' : 'text-red-500'}`}>
              {validation.message}
            </span>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
          <button className="flex items-center gap-1 text-xs text-textSecondary hover:text-accent transition-colors">
            <BookOpen className="w-3 h-3" />Docs
          </button>
          <button className="flex items-center gap-1 text-xs text-textSecondary hover:text-accent transition-colors">
            <HelpCircle className="w-3 h-3" />Examples
          </button>
        </div>
      </div>

      <div className="flex-1 relative flex overflow-hidden font-mono text-xs bg-surface min-h-0">
        <div ref={lineNumbersRef}
          className="w-10 flex-shrink-0 bg-surfaceMuted border-r border-border py-3 px-2 overflow-hidden select-none"
          aria-hidden="true">
          {sqlLines.map((_, i) => (
            <div key={i} className="text-right text-textMuted leading-6">{i + 1}</div>
          ))}
        </div>
        <div className="flex-1 relative min-w-0">
          <textarea ref={textareaRef} value={sqlValue} onChange={onSQLChange} onKeyDown={onKeyDown}
            spellCheck={false}
            className="absolute inset-0 w-full h-full resize-none p-3 font-mono text-xs text-textPrimary bg-transparent outline-none leading-6 z-10"
            style={{ caretColor: '#1D4ED8' }} />
          <div className="absolute inset-0 w-full h-full p-3 font-mono text-xs leading-6 pointer-events-none overflow-hidden whitespace-pre-wrap break-all"
            dangerouslySetInnerHTML={{ __html: highlightSQL(sqlValue) + '<br />' }}
            aria-hidden="true" />
        </div>
      </div>

      <div className="border-t border-border bg-surfaceMuted px-4 py-3 flex items-center gap-3 flex-wrap flex-shrink-0">
        <Button onClick={onRun} disabled={isRunning || !validation.valid}
          className="bg-accent hover:bg-accent/90 text-white h-9 px-5 text-sm gap-2">
          <Play className="w-3.5 h-3.5" />
          {isRunning ? 'Running...' : 'Run This Query'}
        </Button>
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-textSecondary">
          <Keyboard className="w-3 h-3" />
          <kbd className="bg-gray-200 rounded px-1.5 py-0.5 text-xs font-mono">⌘</kbd>
          <span>+</span>
          <kbd className="bg-gray-200 rounded px-1.5 py-0.5 text-xs font-mono">Enter</kbd>
        </div>
        <div className="ml-auto">
          <Button variant="outline" className="h-9 px-4 text-sm gap-2">
            <Save className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Save Screen</span>
          </Button>
        </div>
      </div>
    </div>
  )
}