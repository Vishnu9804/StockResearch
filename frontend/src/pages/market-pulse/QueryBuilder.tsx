/**
 * Query Builder — /market-pulse/queries/new
 * Add new announcement search filter.
 */
import { useState, useEffect } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { ChevronRight, Play, Trash2, Search } from 'lucide-react'
import { AppFooter } from '@/components/shared/AppFooter'
import { Heading } from '@/components/ui/Heading'
import { Button } from '@/components/ui/button'
import { useLocalStorage } from '@/hooks/useLocalStorage'

const EXAMPLE_QUERIES = [
  'Mergers and de-mergers',
  'Capacity expansion',
  'Resignations',
  'Warnings / downgrades',
  'Approvals and awards',
  'Concalls or presentations',
  'Buyback / dividend',
  'Climate / sustainability',
]

export function QueryBuilder() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryParam = searchParams.get('query') ?? ''

  const [query, setQuery] = useState(queryParam)
  const [saveOnSubmit, setSaveOnSubmit] = useState(false)
  const [savedFilters, setSavedFilters] = useLocalStorage<string[]>('saved_announcement_filters', [])

  // Auto focus input on mount
  useEffect(() => {
    const inputEl = document.getElementById('query-input')
    if (inputEl) {
      inputEl.focus()
    }
  }, [])

  // Sync and focus query param if supplied
  useEffect(() => {
    if (queryParam) {
      setQuery(queryParam)
      const inputEl = document.getElementById('query-input')
      if (inputEl) {
        inputEl.focus()
        inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [queryParam])

  const handleSubmit = (q: string) => {
    const trimmed = q.trim()
    if (!trimmed) return

    if (saveOnSubmit && !savedFilters.includes(trimmed)) {
      setSavedFilters([...savedFilters, trimmed])
    }

    navigate(`/market-pulse/queries/results?query=${encodeURIComponent(trimmed)}`)
  }

  return (
    <div className="min-h-screen bg-background font-sans select-none animate-[fadeInUp_0.15s_ease-out]">
      <div className="max-w-[1200px] mx-auto px-6 py-6 select-none">

        {/* Breadcrumb */}
        <div className="text-xs text-textSecondary/70 mb-2 flex items-center gap-1.5">
          <Link to="/" className="hover:text-accent transition-colors">Dashboard</Link>
          <ChevronRight className="size-3" />
          <Link to="/market-pulse" className="hover:text-accent transition-colors">Market Pulse</Link>
          <ChevronRight className="size-3" />
          <Link to="/market-pulse/announcements" className="hover:text-accent transition-colors">Announcements</Link>
          <ChevronRight className="size-3" />
          <span className="text-accent font-medium">Search Filter</span>
        </div>

        <Heading level={1} variant="pageTitle" className="text-textPrimary mb-1">
          Add new search filter
        </Heading>
        <p className="text-sm text-textSecondary mb-6">
          Create a custom filter for tracking latest company announcements.
        </p>

        {/* Responsive Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 items-start">
          
          {/* Left Column: Form & Syntax Guide */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Form Card */}
            <div className="bg-surface border border-border/40 rounded-xl p-6 shadow-xs">
              <label htmlFor="query-input" className="block text-sm font-semibold text-textPrimary mb-2">
                Query
              </label>
              <textarea
                id="query-input"
                rows={3}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmit(query)
                  }
                }}
                placeholder="e.g. capacity expansion OR new order"
                className="w-full box-border px-3.5 py-2.5 text-sm border border-border/60 focus:border-accent rounded-lg bg-background text-textPrimary outline-none transition-colors font-sans resize-none"
              />

              <div className="flex items-center gap-2 mt-3 select-none">
                <input
                  id="save-checkbox"
                  type="checkbox"
                  checked={saveOnSubmit}
                  onChange={(e) => setSaveOnSubmit(e.target.checked)}
                  className="accent-accent cursor-pointer size-4 outline-ring/45 focus-visible:outline"
                />
                <label htmlFor="save-checkbox" className="text-xs text-textSecondary cursor-pointer font-medium">
                  Save this filter to my saved list
                </label>
              </div>

              <div className="mt-5 flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={() => handleSubmit(query)}
                  className="flex-1 flex items-center justify-center gap-2 h-10 text-sm font-bold"
                >
                  <Play className="size-3.5 fill-current" />
                  Show Results
                </Button>
                {query.trim() && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      const trimmed = query.trim()
                      if (trimmed && !savedFilters.includes(trimmed)) {
                        setSavedFilters([...savedFilters, trimmed])
                      }
                    }}
                    className="h-10 cursor-pointer text-xs font-bold border-border/60 hover:bg-surfaceMuted"
                  >
                    Save Filter
                  </Button>
                )}
              </div>
            </div>

            {/* Query Language Guide Card */}
            <div className="bg-surface border border-border/40 rounded-xl p-6 shadow-xs">
              <Heading level={2} className="text-sm font-semibold text-textPrimary mb-4">
                Query language
              </Heading>
              
              <div className="space-y-4 text-xs text-textSecondary leading-relaxed">
                <p>
                  FinScreen supports a rich query syntax to help you filter company announcements precisely:
                </p>
                <ul className="list-disc pl-5 space-y-3">
                  <li>
                    <strong className="text-textPrimary font-semibold">Partial word matching:</strong> Words are matched partially by default. For example, <code className="bg-surfaceMuted px-1 py-0.5 rounded text-accent font-mono text-[11px] border border-border/30">warn</code> matches both <code className="text-textPrimary font-semibold">warning</code> and <code className="text-textPrimary font-semibold">warnings</code>.
                  </li>
                  <li>
                    <strong className="text-textPrimary font-semibold">Quoted phrases:</strong> Use double quotes to search for exact phrases. For example, <code className="bg-surfaceMuted px-1.5 py-0.5 rounded text-accent font-mono text-[11px] border border-border/30">"capacity expansion"</code> matches that exact phrase in sequence.
                  </li>
                  <li>
                    <strong className="text-textPrimary font-semibold">OR operator:</strong> Use capital <code className="bg-surfaceMuted px-1.5 py-0.5 rounded text-accent font-mono text-[11px] border border-border/30 font-bold">OR</code> to search for matches containing either word. For example, <code className="bg-surfaceMuted px-1.5 py-0.5 rounded text-accent font-mono text-[11px] border border-border/30">merger OR acquisition</code>.
                  </li>
                  <li>
                    <strong className="text-textPrimary font-semibold">Exclusions:</strong> Prepend a minus sign <code className="bg-surfaceMuted px-1 py-0.5 rounded text-accent font-mono text-[11px] border border-border/30 font-bold">-</code> to exclude announcements containing that word. For example, <code className="bg-surfaceMuted px-1.5 py-0.5 rounded text-accent font-mono text-[11px] border border-border/30">result -loss</code>.
                  </li>
                </ul>
              </div>
            </div>

          </div>

          {/* Right Column: Examples & Saved Filters */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* Examples Card */}
            <div className="bg-surface border border-border/40 rounded-xl p-5 shadow-xs">
              <Heading level={3} className="text-xs font-bold text-textSecondary uppercase tracking-wider mb-3">
                Examples
              </Heading>
              <div className="flex flex-wrap gap-1.5">
                {EXAMPLE_QUERIES.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => {
                      setQuery(ex)
                      const inputEl = document.getElementById('query-input')
                      if (inputEl) inputEl.focus()
                    }}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-border/60 bg-background text-textSecondary hover:border-accent hover:text-accent hover:bg-accentSoft transition-all cursor-pointer"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            {/* Saved Filters Card */}
            <div className="bg-surface border border-border/40 rounded-xl p-5 shadow-xs">
              <Heading level={3} className="text-xs font-bold text-textSecondary uppercase tracking-wider mb-3">
                Saved Filters
              </Heading>
              
              {savedFilters.length === 0 ? (
                <div className="text-xs text-textMuted italic py-4 text-center">
                  No saved filters yet. Use the checkbox or button to save custom filters.
                </div>
              ) : (
                <div className="divide-y divide-border/30">
                  {savedFilters.map((saved) => (
                    <div key={saved} className="py-3.5 flex items-center justify-between gap-2">
                      <button
                        onClick={() => {
                          setQuery(saved)
                          const inputEl = document.getElementById('query-input')
                          if (inputEl) inputEl.focus()
                        }}
                        className="text-xs text-left font-semibold text-textPrimary hover:text-accent truncate flex-1 outline-none cursor-pointer"
                        title={saved}
                      >
                        {saved}
                      </button>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Link
                          to={`/market-pulse/queries/results?query=${encodeURIComponent(saved)}`}
                          className="p-1 text-textSecondary hover:text-accent hover:bg-surfaceMuted rounded transition-colors"
                          title="Run search"
                        >
                          <Play className="size-3.5 fill-current" />
                        </Link>
                        <button
                          onClick={() => setSavedFilters(savedFilters.filter(f => f !== saved))}
                          className="p-1 text-textMuted hover:text-negative hover:bg-negative-soft rounded transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>
      </div>

      <AppFooter />
    </div>
  )
}

export default QueryBuilder
