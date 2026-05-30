'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Plus, X, Play, Save, Sparkles, Code2, LayoutList, ChevronDown, HelpCircle, BookOpen, Keyboard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
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
}

const OPERATORS: { value: Operator; label: string }[] = [
  { value: '>', label: '>' },
  { value: '>=', label: '>=' },
  { value: '<', label: '<' },
  { value: '<=', label: '<=' },
  { value: '=', label: '=' },
  { value: '!=', label: '≠' },
  { value: 'between', label: 'between' },
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
  if (!trimmed.includes('WHERE')) return { valid: false, message: 'Missing WHERE clause — add at least one filter' }
  const unbalanced = (sql.match(/\(/g) ?? []).length !== (sql.match(/\)/g) ?? []).length
  if (unbalanced) return { valid: false, message: 'Unbalanced parentheses in query' }
  return { valid: true, message: '✓ Valid query' }
}

const SQL_KEYWORDS = ['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'ORDER', 'BY', 'LIMIT', 'ASC', 'DESC', 'NOT', 'IN', 'BETWEEN', 'LIKE', 'IS', 'NULL']
const SQL_METRICS = ['market_cap', 'pe_ratio', 'roe', 'roce', 'de_ratio', 'profit_growth_3y', 'company_name', 'ticker', 'div_yield', 'net_margin', 'sales_growth_3y']

function highlightSQL(sql: string): string {
  let highlighted = sql.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  // Numbers
  highlighted = highlighted.replace(/\b(\d+(\.\d+)?)\b/g, '<span class="text-positive font-mono">$1</span>')
  // Metrics (before keywords so multi-word doesn't break)
  SQL_METRICS.forEach((metric) => {
    const re = new RegExp(`\\b(${metric})\\b`, 'gi')
    highlighted = highlighted.replace(re, '<span class="text-purple-600 font-mono">$1</span>')
  })
  // Keywords
  SQL_KEYWORDS.forEach((kw) => {
    const re = new RegExp(`\\b(${kw})\\b`, 'gi')
    highlighted = highlighted.replace(re, '<span class="text-accent font-semibold">$1</span>')
  })
  // Comments
  highlighted = highlighted.replace(/(--[^\n]*)/g, '<span class="text-textMuted italic">$1</span>')
  return highlighted
}

export function QueryBuilder({ insertedVariable, onInsertConsumed }: QueryBuilderProps) {
  const [mode, setMode] = useState<'visual' | 'sql'>('visual')
  const [filters, setFilters] = useState<FilterRow[]>(DEFAULT_FILTERS)
  const [sqlValue, setSqlValue] = useState(DEFAULT_SQL)
  const [sqlValidation, setSqlValidation] = useState<{ valid: boolean; message: string }>(() => validateSQL(DEFAULT_SQL))
  const [isRunning, setIsRunning] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lineNumbersRef = useRef<HTMLDivElement>(null)

  // Handle variable insertion from sidebar
  useEffect(() => {
    if (!insertedVariable) return
    if (mode === 'visual') {
      const existing = filters.find((f) => f.variable === insertedVariable.id)
      if (!existing) {
        addFilterWithVariable(insertedVariable)
      }
    } else {
      if (textareaRef.current) {
        const pos = textareaRef.current.selectionStart
        const before = sqlValue.slice(0, pos)
        const after = sqlValue.slice(pos)
        const insertion = insertedVariable.id
        setSqlValue(before + insertion + after)
      }
    }
    onInsertConsumed?.()
  }, [insertedVariable]) // eslint-disable-line react-hooks/exhaustive-deps

  const addFilterWithVariable = (variable: Variable) => {
    const newFilter: FilterRow = {
      id: generateId(),
      connector: filters.length === 0 ? 'WHERE' : 'AND',
      variable: variable.id,
      variableLabel: variable.label,
      operator: '>',
      value: '',
      valueTo: '',
    }
    setFilters((prev) => [...prev, newFilter])
  }

  const addFilter = () => {
    const newFilter: FilterRow = {
      id: generateId(),
      connector: filters.length === 0 ? 'WHERE' : 'AND',
      variable: '',
      variableLabel: '',
      operator: '>',
      value: '',
      valueTo: '',
    }
    setFilters((prev) => [...prev, newFilter])
  }

  const removeFilter = (id: string) => {
    setFilters((prev) => {
      const next = prev.filter((f) => f.id !== id)
      if (next.length > 0) next[0].connector = 'WHERE'
      return next
    })
  }

  const updateFilter = (id: string, patch: Partial<FilterRow>) => {
    setFilters((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  }

  const handleSQLChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setSqlValue(val)
    setSqlValidation(validateSQL(val))
    // Sync scroll of line numbers
    if (lineNumbersRef.current && textareaRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleRun()
    }
  }

  const handleRun = () => {
    setIsRunning(true)
    setTimeout(() => setIsRunning(false), 1200)
  }

  const sqlLines = sqlValue.split('\n')

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Mode switcher */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div>
          <h2 className="text-sm font-semibold text-textPrimary">Query Builder</h2>
          <p className="text-xs text-textSecondary mt-0.5">Build filters to screen stocks</p>
        </div>
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
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {mode === 'visual' ? (
          <VisualMode
            filters={filters}
            onAdd={addFilter}
            onRemove={removeFilter}
            onUpdate={updateFilter}
            onRun={handleRun}
            isRunning={isRunning}
          />
        ) : (
          <SQLMode
            sqlValue={sqlValue}
            validation={sqlValidation}
            textareaRef={textareaRef}
            lineNumbersRef={lineNumbersRef}
            sqlLines={sqlLines}
            onSQLChange={handleSQLChange}
            onKeyDown={handleKeyDown}
            onRun={handleRun}
            isRunning={isRunning}
          />
        )}
      </div>
    </div>
  )
}

// ─── Visual Mode ───────────────────────────────────────────────────────────────

interface VisualModeProps {
  filters: FilterRow[]
  onAdd: () => void
  onRemove: (id: string) => void
  onUpdate: (id: string, patch: Partial<FilterRow>) => void
  onRun: () => void
  isRunning: boolean
}

function VisualMode({ filters, onAdd, onRemove, onUpdate, onRun, isRunning }: VisualModeProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 p-4 space-y-2 overflow-auto">
        {filters.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-surfaceMuted flex items-center justify-center mb-3">
              <LayoutList className="w-6 h-6 text-textMuted" />
            </div>
            <p className="text-sm text-textSecondary font-medium">No filters added</p>
            <p className="text-xs text-textMuted mt-1">Click "+ Add Filter" or insert a variable from the sidebar</p>
          </div>
        )}
        {filters.map((filter, index) => (
          <FilterRowUI
            key={filter.id}
            filter={filter}
            isFirst={index === 0}
            onRemove={() => onRemove(filter.id)}
            onUpdate={(patch) => onUpdate(filter.id, patch)}
          />
        ))}

        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 text-xs text-accent hover:text-blue-800 font-medium mt-2 px-1 py-1 rounded hover:bg-accentSoft transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Filter
        </button>
      </div>

      {/* Footer actions */}
      <div className="border-t border-border p-4 flex items-center gap-2 flex-wrap">
        <Button
          onClick={onRun}
          disabled={isRunning}
          className="bg-accent hover:bg-accent/90 text-white h-9 px-5 text-sm gap-2"
        >
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
    </div>
  )
}

interface FilterRowUIProps {
  filter: FilterRow
  isFirst: boolean
  onRemove: () => void
  onUpdate: (patch: Partial<FilterRow>) => void
}

function FilterRowUI({ filter, isFirst, onRemove, onUpdate }: FilterRowUIProps) {
  return (
    <div className="flex items-start gap-2 group">
      {/* Connector */}
      <div className="w-14 flex-shrink-0 pt-1">
        {isFirst ? (
          <span className="text-xs font-semibold text-accent bg-accentSoft px-2 py-1 rounded inline-block">WHERE</span>
        ) : (
          <Select
            value={filter.connector}
            onValueChange={(v) => onUpdate({ connector: v as 'AND' | 'WHERE' })}
          >
            <SelectTrigger className="h-7 text-xs border-border bg-surfaceMuted px-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AND" className="text-xs">AND</SelectItem>
              <SelectItem value="WHERE" className="text-xs">WHERE</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Variable */}
      <Select
        value={filter.variable}
        onValueChange={(v) => {
          const found = VARIABLE_OPTIONS.find((o) => o.id === v)
          onUpdate({ variable: v, variableLabel: found?.label ?? v })
        }}
      >
        <SelectTrigger className="h-8 text-xs flex-1 min-w-0">
          <SelectValue placeholder="Select variable..." />
        </SelectTrigger>
        <SelectContent className="max-h-64">
          {['Valuation', 'Profitability', 'Debt & Liquidity', 'Growth', 'Shareholding', 'Technical', 'Efficiency'].map((cat) => {
            const opts = VARIABLE_OPTIONS.filter((o) => o.category === cat)
            if (opts.length === 0) return null
            return (
              <div key={cat}>
                <div className="px-2 py-1 text-xs font-semibold text-textMuted">{cat}</div>
                {opts.map((o) => (
                  <SelectItem key={o.id} value={o.id} className="text-xs pl-4">
                    {o.label}
                  </SelectItem>
                ))}
              </div>
            )
          })}
        </SelectContent>
      </Select>

      {/* Operator */}
      <Select
        value={filter.operator}
        onValueChange={(v) => onUpdate({ operator: v as Operator })}
      >
        <SelectTrigger className="h-8 text-xs w-24 flex-shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OPERATORS.map((op) => (
            <SelectItem key={op.value} value={op.value} className="text-xs font-mono">
              {op.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Value(s) */}
      {filter.operator === 'between' ? (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Input
            className="h-8 w-20 text-xs font-mono"
            placeholder="From"
            value={filter.value}
            onChange={(e) => onUpdate({ value: e.target.value })}
          />
          <span className="text-xs text-textSecondary font-medium">AND</span>
          <Input
            className="h-8 w-20 text-xs font-mono"
            placeholder="To"
            value={filter.valueTo}
            onChange={(e) => onUpdate({ valueTo: e.target.value })}
          />
        </div>
      ) : (
        <Input
          className="h-8 w-28 flex-shrink-0 text-xs font-mono"
          placeholder="Value"
          value={filter.value}
          onChange={(e) => onUpdate({ value: e.target.value })}
        />
      )}

      {/* Remove */}
      <button
        onClick={onRemove}
        className="p-1.5 rounded hover:bg-negative-soft/40 text-textMuted hover:text-red-500 transition-colors flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100"
        aria-label="Remove filter"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// ─── SQL Mode ─────────────────────────────────────────────────────────────────

interface SQLModeProps {
  sqlValue: string
  validation: { valid: boolean; message: string }
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  lineNumbersRef: React.RefObject<HTMLDivElement | null>
  sqlLines: string[]
  onSQLChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onRun: () => void
  isRunning: boolean
}

function SQLMode({
  sqlValue,
  validation,
  textareaRef,
  lineNumbersRef,
  sqlLines,
  onSQLChange,
  onKeyDown,
  onRun,
  isRunning,
}: SQLModeProps) {
  return (
    <div className="flex flex-col h-full">
      {/* SQL Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surfaceMuted">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-gray-700">SQL Editor</span>
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${validation.valid ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className={`text-xs font-mono ${validation.valid ? 'text-positive' : 'text-red-500'}`}>
              {validation.message}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1 text-xs text-textSecondary hover:text-accent transition-colors">
            <BookOpen className="w-3 h-3" />
            Docs
          </button>
          <button className="flex items-center gap-1 text-xs text-textSecondary hover:text-accent transition-colors">
            <HelpCircle className="w-3 h-3" />
            Examples
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 relative flex overflow-hidden font-mono text-xs bg-surface">
        {/* Line numbers */}
        <div
          ref={lineNumbersRef}
          className="w-10 flex-shrink-0 bg-surfaceMuted border-r border-border py-3 px-2 overflow-hidden select-none"
          aria-hidden="true"
        >
          {sqlLines.map((_, i) => (
            <div key={i} className="text-right text-textMuted leading-6">
              {i + 1}
            </div>
          ))}
        </div>

        {/* Textarea */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={sqlValue}
            onChange={onSQLChange}
            onKeyDown={onKeyDown}
            spellCheck={false}
            className="absolute inset-0 w-full h-full resize-none p-3 font-mono text-xs text-textPrimary bg-transparent outline-none leading-6 z-10"
            style={{ caretColor: '#1D4ED8' }}
          />
          {/* Syntax highlight overlay (hidden behind textarea for visual only) */}
          <div
            className="absolute inset-0 w-full h-full p-3 font-mono text-xs leading-6 pointer-events-none overflow-hidden whitespace-pre-wrap break-all"
            dangerouslySetInnerHTML={{ __html: highlightSQL(sqlValue) + '<br />' }}
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Sticky footer */}
      <div className="border-t border-border bg-surfaceMuted px-4 py-3 flex items-center gap-3">
        <Button
          onClick={onRun}
          disabled={isRunning || !validation.valid}
          className="bg-accent hover:bg-accent/90 text-white h-9 px-5 text-sm gap-2"
        >
          <Play className="w-3.5 h-3.5" />
          {isRunning ? 'Running...' : 'Run This Query'}
        </Button>
        <div className="flex items-center gap-1.5 text-xs text-textSecondary">
          <Keyboard className="w-3 h-3" />
          <kbd className="bg-gray-200 rounded px-1.5 py-0.5 text-xs font-mono">⌘</kbd>
          <span>+</span>
          <kbd className="bg-gray-200 rounded px-1.5 py-0.5 text-xs font-mono">Enter</kbd>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" className="h-9 px-4 text-sm gap-2">
            <Save className="w-3.5 h-3.5" />
            Save Screen
          </Button>
        </div>
      </div>
    </div>
  )
}
