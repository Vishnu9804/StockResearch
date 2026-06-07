
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, Clock, TrendingUp, TrendingDown, ArrowRight, Hash } from 'lucide-react'
import { companies } from '@/lib/data/companies'
import { cn } from '@/lib/utils'

const INDEX_RESULTS = [
  { type: 'index' as const, name: 'NIFTY 50', slug: 'NIFTY50', exchange: 'NSE', value: 22845.75, changePct: 0.56 },
  { type: 'index' as const, name: 'SENSEX', slug: 'SENSEX', exchange: 'BSE', value: 75241.90, changePct: 0.55 },
  { type: 'index' as const, name: 'BANK NIFTY', slug: 'BANKNIFTY', exchange: 'NSE', value: 48532.60, changePct: -0.18 },
  { type: 'index' as const, name: 'NIFTY IT', slug: 'NIFTYIT', exchange: 'NSE', value: 35842.30, changePct: 0.66 },
]

const RECENT_KEY = 'finscreen-recent-searches'

function getRecents(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') } catch { return [] }
}

function addRecent(symbol: string) {
  const prev = getRecents().filter(s => s !== symbol)
  localStorage.setItem(RECENT_KEY, JSON.stringify([symbol, ...prev].slice(0, 5)))
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const [recents, setRecents] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIdx(0)
      setRecents(getRecents())
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const matchingCompanies = query.trim()
    ? companies
        .filter(c =>
          c.symbol.toLowerCase().includes(query.toLowerCase()) ||
          c.name.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 7)
    : []

  const matchingIndices = query.trim()
    ? INDEX_RESULTS.filter(i =>
        i.name.toLowerCase().includes(query.toLowerCase()) ||
        i.slug.toLowerCase().includes(query.toLowerCase())
      )
    : []

  const totalResults = matchingIndices.length + matchingCompanies.length

  const navigateTo = useCallback((href: string, symbol: string) => {
    addRecent(symbol)
    setRecents(getRecents())
    onClose()
    navigate(href)
  }, [navigate, onClose])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, totalResults - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter') {
      e.preventDefault()
      const allResults = [
        ...matchingIndices.map(idx => ({ href: `/index/${idx.slug}`, label: idx.name })),
        ...matchingCompanies.map(c => ({ href: `/company/${c.symbol}`, label: c.symbol })),
      ]
      const selected = allResults[activeIdx]
      if (selected) navigateTo(selected.href, selected.label)
    }
  }

  const recentCompanies = recents
    .map(s => companies.find(c => c.symbol === s))
    .filter(Boolean) as typeof companies

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[999] flex items-start justify-center pt-[12vh] px-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" />

      {/* Palette panel */}
      <div
        className="relative w-full max-w-2xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-border">
          <Search className="size-5 text-textMuted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveIdx(0) }}
            onKeyDown={handleKeyDown}
            placeholder="Search stocks, indices, sectors..."
            className="flex-1 bg-transparent text-sm text-textPrimary placeholder:text-textMuted focus:outline-none font-medium"
          />
          <div className="flex items-center gap-2">
            {query && (
              <button onClick={() => setQuery('')} className="text-textMuted hover:text-textSecondary transition-colors">
                <X className="size-4" />
              </button>
            )}
            <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-border bg-surfaceMuted font-mono text-[10px] text-textMuted">
              ESC
            </kbd>
          </div>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {/* No query — show recents */}
          {!query.trim() && recentCompanies.length > 0 && (
            <div>
              <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-textMuted bg-surfaceMuted/50 flex items-center gap-1.5">
                <Clock className="size-3" /> Recent Searches
              </div>
              {recentCompanies.map((company, i) => {
                const pos = company.change >= 0
                return (
                  <button
                    key={company.symbol}
                    onClick={() => navigateTo(`/company/${company.symbol}`, company.symbol)}
                    className={cn(
                      'w-full flex items-center justify-between px-4 py-3 text-left transition-colors',
                      i === activeIdx ? 'bg-accentSoft' : 'hover:bg-surfaceMuted'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-lg bg-surfaceMuted border border-border flex items-center justify-center">
                        <Hash className="size-3.5 text-textMuted" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-textPrimary font-mono">{company.symbol}</p>
                        <p className="text-[10px] text-textMuted truncate max-w-[300px]">{company.name}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-mono font-semibold text-textPrimary">₹{company.price.toFixed(2)}</p>
                      <p className={cn('text-[10px] font-mono font-medium', pos ? 'text-positive' : 'text-negative')}>
                        {pos ? '+' : ''}{company.changePct.toFixed(2)}%
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* No query, no recents */}
          {!query.trim() && recentCompanies.length === 0 && (
            <div className="py-12 text-center">
              <Search className="size-8 text-textMuted mx-auto mb-3 opacity-40" />
              <p className="text-sm font-semibold text-textMuted">Type to search stocks or indices</p>
              <p className="text-xs text-textMuted/60 mt-1">e.g. RELIANCE, TCS, NIFTY</p>
            </div>
          )}

          {/* Index results */}
          {matchingIndices.length > 0 && (
            <>
              <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-textMuted bg-surfaceMuted/50">
                Indices
              </div>
              {matchingIndices.map((idx, i) => {
                const pos = idx.changePct >= 0
                const absIdx = i
                return (
                  <button
                    key={idx.slug}
                    onClick={() => navigateTo(`/index/${idx.slug}`, idx.name)}
                    className={cn(
                      'w-full flex items-center justify-between px-4 py-3 text-left transition-colors',
                      absIdx === activeIdx ? 'bg-accentSoft' : 'hover:bg-surfaceMuted'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-lg bg-accentSoft border border-accent/20 flex items-center justify-center">
                        <TrendingUp className="size-3.5 text-accent" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-textPrimary">{idx.name}</p>
                        <p className="text-[10px] text-textMuted">{idx.exchange} Index</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 flex items-center gap-2">
                      <div>
                        <p className="text-xs font-mono font-semibold text-textPrimary">{idx.value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                        <p className={cn('text-[10px] font-mono font-medium', pos ? 'text-positive' : 'text-negative')}>
                          {pos ? '+' : ''}{idx.changePct.toFixed(2)}%
                        </p>
                      </div>
                      <ArrowRight className="size-3.5 text-textMuted" />
                    </div>
                  </button>
                )
              })}
            </>
          )}

          {/* Company results */}
          {matchingCompanies.length > 0 && (
            <>
              <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-textMuted bg-surfaceMuted/50">
                Stocks
              </div>
              {matchingCompanies.map((company, i) => {
                const pos = company.change >= 0
                const absIdx = matchingIndices.length + i
                return (
                  <button
                    key={company.symbol}
                    onClick={() => navigateTo(`/company/${company.symbol}`, company.symbol)}
                    className={cn(
                      'w-full flex items-center justify-between px-4 py-3 text-left transition-colors',
                      absIdx === activeIdx ? 'bg-accentSoft' : 'hover:bg-surfaceMuted'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-lg bg-surfaceMuted border border-border flex items-center justify-center">
                        <span className="text-[9px] font-bold text-textSecondary font-mono">{company.symbol.slice(0, 3)}</span>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-textPrimary font-mono">{company.symbol}</p>
                        <p className="text-[10px] text-textMuted truncate max-w-[300px]">{company.name} · {company.sector}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 flex items-center gap-2">
                      <div>
                        <p className="text-xs font-mono font-semibold text-textPrimary">₹{company.price.toFixed(2)}</p>
                        <p className={cn('text-[10px] font-mono font-medium flex items-center justify-end gap-0.5', pos ? 'text-positive' : 'text-negative')}>
                          {pos ? <TrendingUp className="size-2.5" /> : <TrendingDown className="size-2.5" />}
                          {pos ? '+' : ''}{company.changePct.toFixed(2)}%
                        </p>
                      </div>
                      <ArrowRight className="size-3.5 text-textMuted" />
                    </div>
                  </button>
                )
              })}
            </>
          )}

          {/* No results */}
          {query.trim() && matchingCompanies.length === 0 && matchingIndices.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-sm font-semibold text-textMuted">No results for <span className="text-textPrimary font-bold">&quot;{query}&quot;</span></p>
              <p className="text-xs text-textMuted/60 mt-1">Try a different symbol or company name</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-4 py-2 flex items-center gap-4 text-[10px] text-textMuted bg-surfaceMuted/30">
          <span className="flex items-center gap-1"><kbd className="px-1 border border-border rounded text-[9px] bg-surface">↑↓</kbd> Navigate</span>
          <span className="flex items-center gap-1"><kbd className="px-1 border border-border rounded text-[9px] bg-surface">↵</kbd> Open</span>
          <span className="flex items-center gap-1"><kbd className="px-1 border border-border rounded text-[9px] bg-surface">ESC</kbd> Close</span>
          <span className="ml-auto font-medium">{totalResults > 0 ? `${totalResults} results` : ''}</span>
        </div>
      </div>
    </div>
  )
}
