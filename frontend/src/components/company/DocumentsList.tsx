
import { useState, useMemo } from 'react'
import { useAppSelector } from '@/store/hooks'
import { FileText, Download, Play, Pause, Search, ExternalLink, Headphones } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

interface DocumentItem {
  id: string
  title: string
  date: string
  category: 'announcement' | 'annual-report' | 'concall' | 'credit-rating'
  size?: string
  duration?: string // for concalls
}

const DOCUMENTS: DocumentItem[] = [
  { id: 'doc-001', title: 'Annual Report FY 2024-25', date: '2025-05-15', category: 'annual-report', size: '18.4 MB' },
  { id: 'doc-002', title: 'Q4 FY25 Earnings Call Audio Recording', date: '2025-04-23', category: 'concall', duration: '54:12' },
  { id: 'doc-003', title: 'Credit Rating Upgrade Notice (ICRA AAA)', date: '2025-04-10', category: 'credit-rating', size: '1.2 MB' },
  { id: 'doc-004', title: 'Transcript of Q4 FY25 Earnings Conference Call', date: '2025-04-28', category: 'announcement', size: '820 KB' },
  { id: 'doc-005', title: 'Press Release - Q4 & FY25 Audited Financial Results', date: '2025-04-22', category: 'announcement', size: '4.5 MB' },
  { id: 'doc-006', title: 'Outcome of Board Meeting - Dividends & Audited Financials', date: '2025-04-22', category: 'announcement', size: '2.1 MB' },
  { id: 'doc-007', title: 'Annual Report FY 2023-24', date: '2024-05-18', category: 'annual-report', size: '17.1 MB' },
  { id: 'doc-008', title: 'Q3 FY25 Earnings Call Recording', date: '2025-01-18', category: 'concall', duration: '48:35' },
  { id: 'doc-009', title: 'Crisil AAA Credit Rating Report', date: '2025-01-05', category: 'credit-rating', size: '1.4 MB' },
  { id: 'doc-010', title: 'Transcript of Q3 FY25 Earnings Conference Call', date: '2025-01-24', category: 'announcement', size: '750 KB' },
  { id: 'doc-011', title: 'Q2 FY25 Earnings Call Recording', date: '2024-10-18', category: 'concall', duration: '42:15' },
  { id: 'doc-012', title: 'Transcript of Q2 FY25 Earnings Conference Call', date: '2024-10-24', category: 'announcement', size: '690 KB' },
  { id: 'doc-013', title: 'Annual Report FY 2022-23', date: '2023-05-20', category: 'annual-report', size: '15.8 MB' },
  { id: 'doc-014', title: 'Q1 FY25 Earnings Call Recording', date: '2024-07-20', category: 'concall', duration: '38:50' },
  { id: 'doc-015', title: 'Transcript of Q1 FY25 Earnings Conference Call', date: '2024-07-26', category: 'announcement', size: '720 KB' },
]

export function DocumentsList() {
  const storeDocuments = useAppSelector((state) => state.company?.documents)
  const activeDocuments = storeDocuments?.documents || DOCUMENTS

  const [activeTab, setActiveTab] = useState<'all' | 'announcements' | 'annual-reports' | 'concalls' | 'credit-ratings'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  
  // Audio Player State for Concalls
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [audioProgress, setAudioProgress] = useState(0)

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3000)
  }

  const handleDownload = (title: string) => {
    showToast(`✓ Starting PDF download: ${title}`)
  }

  const handlePlayToggle = (id: string) => {
    if (playingId === id) {
      setPlayingId(null)
    } else {
      setPlayingId(id)
      setAudioProgress(0)
      // Simulate simple audio progress ticker
      const interval = setInterval(() => {
        setAudioProgress((p) => {
          if (p >= 100) {
            clearInterval(interval)
            setPlayingId(null)
            return 0
          }
          return p + 2
        })
      }, 500)
    }
  }

  const filteredDocuments = useMemo(() => {
    return activeDocuments.filter((doc: any) => {
      // Tab Category matching
      const matchesTab =
        activeTab === 'all' ||
        (activeTab === 'announcements' && doc.category === 'announcement') ||
        (activeTab === 'annual-reports' && doc.category === 'annual-report') ||
        (activeTab === 'concalls' && doc.category === 'concall') ||
        (activeTab === 'credit-ratings' && doc.category === 'credit-rating')

      // Search matching
      const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase())

      return matchesTab && matchesSearch
    })
  }, [activeTab, searchQuery])

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden select-none">
      <div className="px-5 py-4 border-b border-border/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-surfaceMuted/50">
        <div>
          <h3 className="text-sm font-bold text-textPrimary uppercase tracking-wide">
            Corporate filings & reports
          </h3>
          <p className="text-[11px] text-textMuted mt-0.5">
            Institutional archives and audio earnings call recordings
          </p>
        </div>
        
        {/* Search Input */}
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-textMuted" />
          <Input
            type="text"
            placeholder="Search reports..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 h-8 text-[11px] font-medium border-border focus:border-blue-700 bg-surface"
          />
        </div>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-border/50 overflow-x-auto bg-surfaceMuted/20 px-3">
        {[
          { id: 'all', label: 'All Files' },
          { id: 'announcements', label: 'Announcements' },
          { id: 'annual-reports', label: 'Annual Reports' },
          { id: 'concalls', label: 'Earnings Calls' },
          { id: 'credit-ratings', label: 'Credit Ratings' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              'px-4 py-3 text-[10px] font-bold uppercase tracking-wider transition-colors whitespace-nowrap focus:outline-none border-b-2 border-transparent',
              activeTab === tab.id
                ? 'border-blue-700 text-accent'
                : 'text-textSecondary hover:text-textPrimary'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Documents items list */}
      <div className="divide-y divide-border/50 max-h-[500px] overflow-y-auto">
        {filteredDocuments.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center px-6">
            <FileText className="size-8 text-slate-200 mb-2" />
            <p className="text-xs font-semibold text-slate-950">No documents found</p>
            <p className="text-[10px] text-textMuted mt-0.5">Try widening your search terms.</p>
          </div>
        ) : (
          filteredDocuments.map((doc: any) => {
            const isConcall = doc.category === 'concall'
            const isPlaying = playingId === doc.id

            return (
              <div key={doc.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-surfaceMuted transition-colors">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="size-8 rounded-lg bg-surfaceMuted border border-border/50 flex items-center justify-center shrink-0 text-textSecondary mt-0.5">
                    {isConcall ? <Headphones className="size-4" /> : <FileText className="size-4" />}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-textPrimary leading-snug truncate max-w-md sm:max-w-xl">
                      {doc.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-textMuted font-mono font-medium">{doc.date}</span>
                      <span className="text-textMuted">•</span>
                      <span className="text-[10px] text-textMuted font-mono uppercase tracking-wide">
                        {doc.category.replace('-', ' ')}
                      </span>
                      {doc.size && (
                        <>
                          <span className="text-textMuted">•</span>
                          <span className="text-[10px] text-textMuted font-mono">{doc.size}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="shrink-0 flex items-center gap-2.5 self-end sm:self-center w-full sm:w-auto">
                  {isConcall && (
                    <div className="flex-1 sm:flex-initial flex items-center gap-3">
                      {isPlaying && (
                        <div className="w-24 sm:w-32 flex flex-col gap-1.5 shrink-0">
                          <Progress value={audioProgress} className="h-1 bg-surfaceMuted" />
                          <div className="flex justify-between text-[8px] font-mono text-textMuted leading-none">
                            <span>Playing</span>
                            <span>{doc.duration}</span>
                          </div>
                        </div>
                      )}
                      <Button
                        size="sm"
                        variant={isPlaying ? 'destructive' : 'outline'}
                        onClick={() => handlePlayToggle(doc.id)}
                        className="h-8 text-[11px] gap-1.5 w-24 shrink-0 font-bold uppercase"
                      >
                        {isPlaying ? (
                          <>
                            <Pause className="size-3" /> Pause
                          </>
                        ) : (
                          <>
                            <Play className="size-3" /> Listen ({doc.duration})
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  {!isConcall && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownload(doc.title)}
                      className="h-8 text-[11px] gap-1.5 font-bold uppercase ml-auto sm:ml-0"
                    >
                      <Download className="size-3" /> Download PDF
                    </Button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white text-xs px-4 py-2 rounded-lg shadow-lg animate-in slide-in-from-bottom-2">
          {toastMsg}
        </div>
      )}
    </div>
  )
}

export default DocumentsList
