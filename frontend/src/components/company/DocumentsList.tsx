
import { useState, useMemo, useEffect } from 'react'
import { useAppSelector } from '@/store/hooks'
import {
  Bookmark, Download, ExternalLink, FileText, RefreshCw, Search,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatExternalUrl } from '@/lib/formatters'

interface DocumentItem {
  id: string
  title: string
  date: string
  category: 'announcement' | 'annual-report' | 'concall' | 'credit-rating'
  size?: string
  fileUrl?: string
}

// FinEdge/NSE never expose a playable recording for a concall — only a PDF
// (transcript, filing, or notice). Each category gets the label that
// actually describes what opening the link gives the user.
const CATEGORY_ACTION_LABEL: Record<string, string> = {
  'announcement': 'View Link',
  'annual-report': 'Download Report',
  'concall': 'View Transcript',
  'credit-rating': 'View Rating',
}

const DOCUMENTS: DocumentItem[] = [
  { id: 'doc-001', title: 'Annual Report FY 2024-25', date: '2025-05-15', category: 'annual-report', size: '18.4 MB' },
  { id: 'doc-002', title: 'Q4 FY25 Earnings Conference Call Transcript', date: '2025-04-23', category: 'concall' },
  { id: 'doc-003', title: 'Credit Rating Upgrade Notice (ICRA AAA)', date: '2025-04-10', category: 'credit-rating', size: '1.2 MB' },
  { id: 'doc-004', title: 'Intimation of Board Meeting for Dividend Consideration', date: '2025-04-28', category: 'announcement', size: '820 KB' },
  { id: 'doc-005', title: 'Press Release - Q4 & FY25 Audited Financial Results', date: '2025-04-22', category: 'announcement', size: '4.5 MB' },
  { id: 'doc-006', title: 'Outcome of Board Meeting - Dividends & Audited Financials', date: '2025-04-22', category: 'announcement', size: '2.1 MB' },
  { id: 'doc-007', title: 'Annual Report FY 2023-24', date: '2024-05-18', category: 'annual-report', size: '17.1 MB' },
  { id: 'doc-008', title: 'Q3 FY25 Earnings Call Recording', date: '2025-01-18', category: 'concall' },
  { id: 'doc-009', title: 'Crisil AAA Credit Rating Report', date: '2025-01-05', category: 'credit-rating', size: '1.4 MB' },
  { id: 'doc-010', title: 'Transcript of Q3 FY25 Earnings Conference Call', date: '2025-01-24', category: 'announcement', size: '750 KB' },
  { id: 'doc-011', title: 'Q2 FY25 Earnings Call Recording', date: '2024-10-18', category: 'concall' },
  { id: 'doc-012', title: 'Annual Report FY 2022-23', date: '2023-05-20', category: 'annual-report', size: '15.8 MB' },
]

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'announcements', label: 'Announcements' },
  { id: 'annual-reports', label: 'Annual Reports' },
  { id: 'concalls', label: 'Concalls' },
  { id: 'credit-ratings', label: 'Credit Ratings' },
]

const CATEGORY_LABEL: Record<string, string> = {
  'announcement': 'NOTICE',
  'annual-report': 'REPORTS',
  'concall': 'CONCALL',
  'credit-rating': 'RATINGS',
}

const CATEGORY_STYLE: Record<string, string> = {
  'announcement': 'bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800',
  'annual-report': 'bg-positive-soft text-positive border-positive/20',
  'concall': 'bg-accentSoft text-accent border-accent/20',
  'credit-rating': 'bg-warning-soft text-warning border-warning/20',
}

export function DocumentsList() {
  const storeDocuments = useAppSelector((state) => state.company?.documents)
  const activeDocuments = storeDocuments?.documents || DOCUMENTS

  const [activeTab, setActiveTab] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 5

  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab, searchQuery])

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3000)
  }

  const filteredDocuments = useMemo(() => {
    return activeDocuments.filter((doc: any) => {
      const matchesTab =
        activeTab === 'all' ||
        (activeTab === 'announcements' && doc.category === 'announcement') ||
        (activeTab === 'annual-reports' && doc.category === 'annual-report') ||
        (activeTab === 'concalls' && doc.category === 'concall') ||
        (activeTab === 'credit-ratings' && doc.category === 'credit-rating')
      const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesTab && matchesSearch
    })
  }, [activeTab, searchQuery, activeDocuments])

  const paginatedDocuments = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredDocuments.slice(start, start + PAGE_SIZE)
  }, [filteredDocuments, currentPage])

  const totalPages = Math.ceil(filteredDocuments.length / PAGE_SIZE)

  return (
    <div className="bg-surface border border-border/40 shadow-xs rounded-2xl overflow-hidden select-none">
      {/* Header row */}
      <div className="px-5 py-4 border-b border-border/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-textPrimary">Documents &amp; Announcements</h3>
          <p className="text-xs text-textMuted mt-0.5">
            Showing <strong className="text-textSecondary">{filteredDocuments.length}</strong> regulatory filings and corporate documents.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => showToast('✓ Data refreshed')}
            className="size-8 rounded-lg border border-border bg-surface text-textSecondary hover:border-accent hover:text-accent transition-colors flex items-center justify-center"
          >
            <RefreshCw className="size-3.5" />
          </button>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-textMuted" />
            <Input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 h-8 text-xs font-medium border-border focus:border-accent bg-surface w-52"
            />
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b border-border/40 overflow-x-auto px-4 py-2 bg-surfaceMuted/5">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-1.5 rounded-lg text-xs font-medium uppercase tracking-wider whitespace-nowrap transition-all',
              activeTab === tab.id
                ? 'bg-accent text-white'
                : 'bg-surface border border-border/40 text-textSecondary hover:border-accent/40 hover:text-textPrimary'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Document list */}
      <div className="divide-y divide-border/40">
        {filteredDocuments.length === 0 ? (
          <div className="py-14 flex flex-col items-center justify-center text-center px-6">
            <FileText className="size-8 text-border mb-2" />
            <p className="text-xs font-medium text-textPrimary">No documents found</p>
            <p className="text-xs text-textMuted mt-0.5">Try widening your search terms.</p>
          </div>
        ) : (
          paginatedDocuments.map((doc: any) => {
            const actionLabel = CATEGORY_ACTION_LABEL[doc.category] || 'View Link'
            const ActionIcon = doc.category === 'annual-report' ? Download : ExternalLink

            return (
              <div key={doc.id} className="px-5 py-4 hover:bg-surfaceMuted/20 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {/* Date column */}
                    <div className="text-right shrink-0 w-20 pt-0.5">
                      <p className="text-xs font-medium text-textSecondary font-mono">{doc.date}</p>
                    </div>
                    {/* Title + badge */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2 flex-wrap">
                        <h4 className="text-xs font-medium text-textPrimary leading-snug">{doc.title}</h4>
                        <span className={cn(
                          'text-xs font-medium uppercase tracking-widest border-none px-1.5 py-0.5 rounded-md shrink-0',
                          CATEGORY_STYLE[doc.category]
                        )}>
                          {CATEGORY_LABEL[doc.category]}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="shrink-0 flex items-center gap-2">
                    {doc.fileUrl ? (
                      <a
                        href={formatExternalUrl(doc.fileUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center rounded-md text-xs font-medium border border-border text-textSecondary hover:border-accent hover:text-accent h-8 px-3 gap-1.5 transition-colors"
                      >
                        <ActionIcon className="size-3" /> {actionLabel}
                      </a>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled
                        className="h-8 text-xs gap-1.5 font-medium border-border text-textMuted opacity-60 cursor-not-allowed"
                      >
                        <ActionIcon className="size-3" /> Not available
                      </Button>
                    )}
                    <button className="size-8 rounded-lg border border-border flex items-center justify-center text-textMuted hover:border-accent hover:text-accent transition-colors">
                      <Bookmark className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Pagination footer */}
      <div className="px-5 py-3 border-t border-border/40 flex items-center justify-between bg-surfaceMuted/5">
        <span className="text-xs text-textMuted font-medium">
          Showing {filteredDocuments.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1} to {Math.min(currentPage * PAGE_SIZE, filteredDocuments.length)} of {filteredDocuments.length} entries
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }).map((_, idx) => {
              const p = idx + 1
              return (
                <button
                  key={p}
                  onClick={() => setCurrentPage(p)}
                  className={cn(
                    "size-7 rounded-md text-xs font-medium transition-all",
                    p === currentPage
                      ? "bg-accent text-white"
                      : "border border-border text-textSecondary hover:border-accent"
                  )}
                >
                  {p}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white text-xs px-4 py-2 rounded-lg shadow-lg animate-in slide-in-from-bottom-2">
          {toastMsg}
        </div>
      )}
    </div>
  )
}

export default DocumentsList
