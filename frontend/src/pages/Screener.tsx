import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Save, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { QueryBuilder } from '@/components/screener/query-builder'
import { VariablesSidebar, type Variable } from '@/components/screener/variables-sidebar'
import { Heading } from '@/components/ui/Heading'
import { Text } from '@/components/ui/Text'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { toast } from 'react-hot-toast'
import { runScreenerStart } from '@/store/slices/screenerSlice'

export function Screener() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { isAuthenticated } = useAppSelector((state) => state.auth)
  const [insertedVariable, setInsertedVariable] = useState<Variable | null>(null)

  const handleInsert = useCallback((variable: Variable) => {
    setInsertedVariable(variable)
  }, [])

  const handleInsertConsumed = useCallback(() => {
    setInsertedVariable(null)
  }, [])

  // Fix: was a <Link> that only navigated — never dispatched runScreenerStart.
  // Results page would always show stale/empty data.
  const handleRunScreener = () => {
    dispatch(runScreenerStart())
    navigate('/screener/results')
  }

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Page Header */}
      <div className="sticky top-0 z-20 bg-surface border-b border-border px-4 lg:px-6 py-4 flex-shrink-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            {/* Breadcrumb */}
            <nav className="flex items-center gap-1.5 text-xs text-textMuted mb-1">
              <Link to="/" className="hover:text-accent transition-colors">
                Home
              </Link>
              <ChevronRight className="w-3 h-3" />
              <Link
                to="/screener"
                className="hover:text-accent transition-colors"
              >
                Screener
              </Link>
              <ChevronRight className="w-3 h-3" />
              <Text as="span" variant="bodyMuted" className="text-xs">
                New Screen
              </Text>
            </nav>

            <Heading level={1} variant="pageTitle">
              Create a New Screen
            </Heading>

            <Text variant="bodyMuted" className="mt-0.5">
              Set your filters and run the query to find matching stocks
            </Text>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:gap-3">
            <Link
              to="/screener/results"
              className="text-sm text-textSecondary hover:text-textPrimary transition-colors flex items-center gap-1 font-semibold"
            >
              <X className="w-3.5 h-3.5" />
              Cancel
            </Link>

            <Button
              variant="outline"
              onClick={() => {
                if (!isAuthenticated) {
                  toast.error('Please sign in to save screens.')
                  const redirectPath = encodeURIComponent(window.location.pathname + window.location.search)
                  navigate(`/login?redirect=${redirectPath}`)
                } else {
                  toast.success('✓ Screen saved (mock)')
                }
              }}
              className="h-9 text-xs border-border text-textSecondary hover:bg-surfaceMuted font-bold shadow-none"
            >
              <Save className="w-3.5 h-3.5" />
              <span className="hidden sm:inline ml-1">Save Screen</span>
            </Button>

            <Button
              id="run-screener-btn"
              onClick={handleRunScreener}
              className="bg-accent hover:bg-accent/90 text-white h-9 text-xs font-bold shadow-none"
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
            insertedVariable={insertedVariable}
            onInsertConsumed={handleInsertConsumed}
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
