import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { QueryBuilder } from '@/components/screener/query-builder'
import { VariablesSidebar, type Variable } from '@/components/screener/variables-sidebar'
import { Heading } from '@/components/ui/Heading'
import { Text } from '@/components/ui/Text'

export function Screener() {
  const [insertedVariable, setInsertedVariable] = useState<Variable | null>(null)

  const handleInsert = useCallback((variable: Variable) => {
    setInsertedVariable(variable)
  }, [])

  const handleInsertConsumed = useCallback(() => {
    setInsertedVariable(null)
  }, [])

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Page Header */}
      <div className="bg-surface border-b border-border px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            {/* Breadcrumb */}
            <nav className="flex items-center gap-1.5 text-xs text-textMuted mb-1">
              <Link to="/" className="hover:text-accent transition-colors">Home</Link>
              <ChevronRight className="w-3 h-3" />
              <Link to="/screener" className="hover:text-accent transition-colors">Screener</Link>
              <ChevronRight className="w-3 h-3" />
              <Text as="span" variant="bodyMuted" className="text-xs">New Screen</Text>
            </nav>
            <Heading level={1} variant="pageTitle">Create a New Screen</Heading>
            <Text variant="bodyMuted" className="mt-0.5">
              Set your filters and run the query to find matching stocks
            </Text>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/screener/results"
              className="text-sm text-textSecondary hover:text-textPrimary transition-colors flex items-center gap-1 font-semibold"
            >
              <X className="w-3.5 h-3.5" />
              Cancel
            </Link>
            <Button variant="outline" className="h-9 text-xs border-border text-textSecondary hover:bg-surfaceMuted font-bold shadow-none">
              <Save className="w-3.5 h-3.5" />
              Save Screen
            </Button>
            <Button
              asChild
              className="bg-accent hover:bg-accent/90 text-white h-9 text-xs font-bold shadow-none"
            >
              <Link to="/screener/results">Run &amp; View Results</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Body: Query Builder + Variables Sidebar */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Query Builder — main panel */}
        <div className="flex-1 min-w-0 overflow-hidden animate-slide-in-left">
          <QueryBuilder
            insertedVariable={insertedVariable}
            onInsertConsumed={handleInsertConsumed}
          />
        </div>

        {/* Variables Sidebar — 320px */}
        <div className="w-80 flex-shrink-0 overflow-hidden border-l border-border animate-slide-in-right">
          <VariablesSidebar onInsert={handleInsert} />
        </div>
      </div>
    </div>
  )
}

export default Screener

