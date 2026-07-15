import { useState, useCallback, useEffect } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { ChevronRight, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  QueryBuilder,
  DEFAULT_FILTERS,
  buildQueryFromFilters,
  parseFiltersFromQuery,
  type FilterRow,
} from '@/components/screener/query-builder'
import { VariablesSidebar, type Variable } from '@/components/screener/variables-sidebar'
import { Heading } from '@/components/ui/Heading'
import { useAppDispatch } from '@/store/hooks'
import { toast } from 'react-hot-toast'
import { runScreenerStart } from '@/store/slices/screenerSlice'

import { screenerApiClient } from '@/services/finscreenApi'

interface EditingScreen {
  id: string
  name: string
}

interface ScreenerLocationState {
  fromResults?: boolean
  queryText?: string
  editingScreen?: EditingScreen | null
}

export function Screener() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('editId')
  const [insertedVariable, setInsertedVariable] = useState<Variable | null>(null)
  const [filters, setFilters] = useState<FilterRow[]>(DEFAULT_FILTERS)
  const [editingScreen, setEditingScreen] = useState<EditingScreen | null>(null)

  const handleInsert = useCallback((variable: Variable) => {
    setInsertedVariable(variable)
  }, [])

  const handleInsertConsumed = useCallback(() => {
    setInsertedVariable(null)
  }, [])

  // Three ways a user lands here:
  //  1. Gallery "Edit" (?editId=...) — load that saved screen's query.
  //  2. Back from the Results page ("Edit Screen" link) — restore the last
  //     query that was just being viewed, plus whatever edit session it was
  //     already part of.
  //  3. Anything else (sidebar link, "Create New Screen") — the default
  //     multi-attribute example query, which doubles as onboarding.
  useEffect(() => {
    if (editId) {
      let cancelled = false
      screenerApiClient.get(`/saved/${editId}`).then((res) => {
        if (cancelled) return
        const screen = res.data?.screen
        if (screen) {
          setEditingScreen({ id: screen.id, name: screen.name })
          const parsed = parseFiltersFromQuery(screen.queryText)
          setFilters(parsed.length > 0 ? parsed : DEFAULT_FILTERS)
        }
      }).catch(() => {
        toast.error('Could not load the saved screen for editing.')
      })
      return () => { cancelled = true }
    }

    const state = location.state as ScreenerLocationState | null
    if (state?.fromResults) {
      const parsed = parseFiltersFromQuery(state.queryText ?? '')
      setFilters(parsed.length > 0 ? parsed : DEFAULT_FILTERS)
      setEditingScreen(state.editingScreen ?? null)
    }
    // Only ever needs to run once, on entry — not on every filters/state change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId])

  const handleRunScreener = () => {
    const query = buildQueryFromFilters(filters)
    dispatch(runScreenerStart(query ? { query } : undefined))
    navigate('/screener/results', { state: { editingScreen } })
  }

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Page Header */}
      <div className="sticky top-0 z-20 bg-surface border-b border-border/40 px-4 lg:px-6 py-4 flex-shrink-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            {/* Breadcrumb */}
            <div className="text-xs text-textSecondary/70 mb-1.5">
              <Link to="/" className="hover:text-accent transition-colors">Home</Link>
              <span className="mx-1.5">›</span>
              <Link to="/screener" className="hover:text-accent transition-colors">Screener</Link>
              <span className="mx-1.5">›</span>
              <span className="text-accent font-medium">{editingScreen ? 'Edit Screen' : 'New Screen'}</span>
            </div>

            <Heading level={1} variant="pageTitle" className="text-textPrimary">
              {editingScreen ? `Editing "${editingScreen.name}"` : 'Create a New Screen'}
            </Heading>

            <p className="text-body text-textSecondary mt-1">
              Set query filters to find matching stocks ·{' '}
              <span className="font-medium text-accent">
                Real-Time Screening
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:gap-3">
            <Link
              to="/screener/results"
              className="text-sm text-textSecondary hover:text-textPrimary transition-colors flex items-center gap-1 font-medium"
            >
              <X className="w-3.5 h-3.5" />
              Cancel
            </Link>

            <Button
              id="run-screener-btn"
              onClick={handleRunScreener}
              className="bg-accent hover:bg-accent/90 text-white h-9 text-xs font-medium shadow-none"
            >
              Run &amp; View Results
            </Button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden">
        {/* Query Builder */}
        <div className="flex-1 min-w-0 overflow-hidden animate-slide-in-left">
          <QueryBuilder
            filters={filters}
            onFiltersChange={setFilters}
            insertedVariable={insertedVariable}
            onInsertConsumed={handleInsertConsumed}
            onRun={handleRunScreener}
          />
        </div>

        {/* Variables Sidebar */}
        <div className="w-full h-96 lg:h-auto lg:w-80 flex-shrink-0 lg:overflow-hidden border-t lg:border-t-0 lg:border-l border-border bg-surface animate-slide-in-right">
          <VariablesSidebar onInsert={handleInsert} />
        </div>
      </div>
    </div>
  )
}

export default Screener
