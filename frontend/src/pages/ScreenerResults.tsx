import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, Bell, Download, Columns3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScreenerResultsTable } from '@/components/screener/results-table'
import { Heading } from '@/components/ui/Heading'
import { Text } from '@/components/ui/Text'
import { useAppSelector } from '@/store/hooks'
import { toast } from 'react-hot-toast'

export function ScreenerResults() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAppSelector((state) => state.auth)
  return (
    <div className="min-h-screen bg-background">
      {/* Page Header */}
      <div className="sticky top-0 z-20 bg-surface border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <nav className="flex items-center gap-1.5 text-xs text-textMuted mb-1">
              <Link to="/" className="hover:text-accent transition-colors">Home</Link>
              <ChevronRight className="w-3 h-3" />
              <Link to="/screener" className="hover:text-accent transition-colors">Screener</Link>
              <ChevronRight className="w-3 h-3" />
              <Text as="span" variant="bodyMuted" className="text-xs">Results</Text>
            </nav>
            <Heading level={1} variant="pageTitle">
              Screener Results: <span className="text-accent">Quality Compounders</span>
            </Heading>
            <Text variant="bodyMuted" className="mt-0.5">
              Filters: Market Cap ≥ 500 Cr · ROE &gt; 15% · D/E &lt; 1 · Profit Growth 3Y &gt; 10%
            </Text>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-9 text-xs border-border text-textSecondary hover:bg-surfaceMuted font-bold shadow-none gap-2">
              <Columns3 className="w-3.5 h-3.5" />
              Edit Columns
            </Button>
            <Button variant="outline" size="sm" className="h-9 text-xs border-border text-textSecondary hover:bg-surfaceMuted font-bold shadow-none gap-2">
              <Download className="w-3.5 h-3.5" />
              Export Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (!isAuthenticated) {
                  toast.error('Please sign in to create alerts.')
                  const redirectPath = encodeURIComponent(window.location.pathname + window.location.search)
                  navigate(`/login?redirect=${redirectPath}`)
                } else {
                  toast.success('✓ Alert dialog opened (mock)')
                }
              }}
              className="h-9 text-xs border-border text-textSecondary hover:bg-surfaceMuted font-bold shadow-none gap-2"
            >
              <Bell className="w-3.5 h-3.5" />
              Create Alert
            </Button>
            <Button asChild className="bg-accent hover:bg-accent/90 text-white h-9 text-xs font-bold shadow-none">
              <Link to="/screener">Edit Screen</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Results table */}
      <div className="p-6">
        <ScreenerResultsTable />
      </div>
    </div>
  )
}

export default ScreenerResults

