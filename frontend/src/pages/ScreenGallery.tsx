import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Plus, Trash2, Inbox } from 'lucide-react'
import { AppFooter } from '@/components/shared/AppFooter'
import { finscreenClient } from '@/services/finscreenApi'
import { toast } from 'react-hot-toast'

// ─── Sector list (inspired by screener.in's Browse Sectors panel) ──────────────
const BROWSE_SECTORS = [
  'Aerospace & Defense', 'Agricultural Food & other Products',
  'Auto Components', 'Automobiles', 'Banks', 'Beverages', 'Capital Markets',
  'Cement & Cement Products', 'Chemicals & Petrochemicals',
  'Cigarettes & Tobacco Products', 'Commercial Services & Supplies',
  'Construction', 'Consumable Fuels', 'Consumer Durables', 'Diversified',
  'Diversified FMCG', 'Diversified Metals', 'Electrical Equipment',
  'Engineering Services', 'Entertainment', 'Ferrous Metals',
  'Fertilizers & Agrochemicals', 'Finance', 'Financial Technology (Fintech)',
  'Food Products', 'Gas', 'Healthcare Equipment & Supplies',
  'Healthcare Services', 'Household Products', 'Industrial Manufacturing',
  'Industrial Products', 'Insurance', 'IT - Hardware', 'IT - Services',
  'IT - Software', 'Leisure Services', 'Media',
  'Metals & Minerals Trading', 'Minerals & Mining', 'Non - Ferrous Metals',
  'Oil', 'Other Construction Materials', 'Other Consumer Services',
  'Other Utilities', 'Paper, Forest & Jute Products', 'Personal Products',
  'Petroleum Products', 'Pharmaceuticals & Biotechnology',
  'Printing & Publication', 'Realty', 'Retailing',
  'Telecom - Equipment & Accessories', 'Telecom - Services',
  'Textiles & Apparels', 'Transport Infrastructure', 'Transport Services',
]

// ─── Saved Screen Card component ──────────────────────────────────────────────
function SavedScreenTile({ screen, onDelete }: { screen: any; onDelete: (id: string) => void }) {
  return (
    <div
      style={{
        display: 'block',
        padding: '16px 20px',
        border: '1px solid var(--fs-border-color)',
        borderRadius: '10px',
        background: 'var(--fs-surface)',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        marginBottom: '12px',
        position: 'relative'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <Link
            to={`/screener/results?query=${encodeURIComponent(screen.queryText)}`}
            style={{ fontSize: '14px', fontWeight: 600, color: 'var(--fs-brand)', textDecoration: 'none', lineHeight: 1.3 }}
            className="hover:underline"
          >
            {screen.name}
            <ArrowRight style={{ display: 'inline', width: '13px', height: '13px', marginLeft: '5px', verticalAlign: 'middle', opacity: 0.6 }} />
          </Link>
          <p style={{ fontSize: '12px', color: 'var(--fs-text-secondary)', margin: '6px 0 0', lineHeight: 1.5 }}>
            {screen.description || 'No description provided.'}
          </p>
          <code style={{ display: 'block', fontSize: '11px', color: 'var(--fs-text-muted)', background: 'var(--fs-background)', padding: '6px 10px', borderRadius: '6px', marginTop: '8px', fontFamily: 'monospace', overflowX: 'auto', whiteSpace: 'nowrap' }}>
            {screen.queryText}
          </code>
        </div>
        <button
          onClick={() => {
            if (window.confirm(`Are you sure you want to delete "${screen.name}"?`)) {
              onDelete(screen.id)
            }
          }}
          style={{
            background: 'none',
            border: 'none',
            color: '#EF4444',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.15s'
          }}
          className="hover:bg-red-50 dark:hover:bg-red-950/20"
          title="Delete Saved Screen"
        >
          <Trash2 style={{ width: '15px', height: '15px' }} />
        </button>
      </div>
    </div>
  )
}

// ─── Saved Screen Skeleton component ───────────────────────────────────────────
function SavedScreenSkeleton() {
  return (
    <div
      style={{
        padding: '16px 20px',
        border: '1px solid var(--fs-border-color)',
        borderRadius: '10px',
        background: 'var(--fs-surface)',
        marginBottom: '12px'
      }}
      className="animate-pulse"
    >
      <div style={{ height: '15px', backgroundColor: 'var(--fs-border-color)', width: '35%', borderRadius: '4px', marginBottom: '8px' }} />
      <div style={{ height: '12px', backgroundColor: 'var(--fs-border-color)', width: '55%', borderRadius: '4px', marginBottom: '12px' }} />
      <div style={{ height: '24px', backgroundColor: 'var(--fs-border-color)', width: '100%', borderRadius: '6px' }} />
    </div>
  )
}

// ─── Browse Sectors panel ─────────────────────────────────────────────────────
function BrowseSectors() {
  return (
    <div
      style={{
        background: 'var(--fs-surface)',
        border: '1px solid var(--fs-border-color)',
        borderRadius: '10px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        overflow: 'hidden',
        position: 'sticky',
        top: '20px',
      }}
    >
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--fs-border-color)' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--fs-text-primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Browse sectors
        </h3>
      </div>
      <div style={{ padding: '10px 12px 14px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {BROWSE_SECTORS.map((sector) => (
          <Link
            key={sector}
            to="/screener/results"
            style={{
              fontSize: '11px',
              color: 'var(--fs-brand)',
              textDecoration: 'none',
              padding: '2px 0',
              lineHeight: 1.7,
            }}
            className="hover:underline"
          >
            {sector}
            {sector !== BROWSE_SECTORS[BROWSE_SECTORS.length - 1] && (
              <span style={{ color: 'var(--fs-border-color)', marginLeft: '4px' }}>·</span>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export function ScreenGallery() {
  const [screens, setScreens] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchScreens = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await finscreenClient.get('/screener/saved')
      if (res.data.success) {
        setScreens(res.data.screens || [])
      }
    } catch (err: any) {
      console.error('Failed to fetch saved screens:', err)
      setError('Unable to load saved screens. Please sign in or refresh the page.')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleDeleteScreen = async (id: string) => {
    try {
      const deletePromise = finscreenClient.delete(`/screener/saved/${id}`)
      toast.promise(deletePromise, {
        loading: 'Deleting screen...',
        success: '✓ Screen deleted successfully!',
        error: (err) => err.response?.data?.detail?.message || err.message || 'Failed to delete screen',
      })
      
      await deletePromise
      setScreens((prev) => prev.filter((s) => s.id !== id))
    } catch (err) {
      console.error('Delete screen error:', err)
    }
  }

  useEffect(() => {
    fetchScreens()
  }, [fetchScreens])

  return (
    <div className="min-h-screen bg-background font-sans select-none">
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '28px 24px 0' }}>

        {/* Page header row */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--fs-text-primary)', margin: 0 }}>
              Saved Stock Screens
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--fs-text-secondary)', margin: '4px 0 0' }}>
              Your custom database filters and saved watch queries
            </p>
          </div>
          <Link
            to="/screener"
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px',
              background: 'var(--fs-brand)',
              color: '#fff',
              border: 'none',
              borderRadius: '7px',
              fontSize: '12px', fontWeight: 600,
              textDecoration: 'none',
              letterSpacing: '0.02em',
            }}
            className="hover:opacity-90 transition-opacity shadow-sm"
          >
            <Plus style={{ width: '13px', height: '13px' }} />
            CREATE NEW SCREEN
          </Link>
        </div>

        {/* Main 2-column layout: panels left, sectors right */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '24px', alignItems: 'start' }}>

          {/* Left: Stacked category panels */}
          <div>
            {loading ? (
              <div>
                <SavedScreenSkeleton />
                <SavedScreenSkeleton />
                <SavedScreenSkeleton />
              </div>
            ) : error ? (
              <div style={{ padding: '24px', border: '1px solid #FCA5A5', background: '#FEF2F2', borderRadius: '10px', color: '#B91C1C', fontSize: '13px', fontWeight: 500, textAlign: 'center' }}>
                <p style={{ margin: '0 0 10px' }}>{error}</p>
                <button onClick={fetchScreens} style={{ padding: '6px 14px', background: '#EF4444', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                  Retry
                </button>
              </div>
            ) : screens.length === 0 ? (
              <div style={{ padding: '48px 24px', border: '1px dashed var(--fs-border-color)', borderRadius: '10px', background: 'var(--fs-surface)', textAlign: 'center' }}>
                <Inbox style={{ width: '32px', height: '32px', color: 'var(--fs-text-muted)', marginBottom: '12px' }} />
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--fs-text-primary)', margin: 0 }}>No saved screens found</h3>
                <p style={{ fontSize: '12px', color: 'var(--fs-text-secondary)', margin: '4px 0 16px' }}>
                  Create and save custom screen formulas to monitor the market.
                </p>
                <Link to="/screener" style={{ display: 'inline-block', padding: '8px 18px', background: 'var(--fs-brand)', color: '#fff', borderRadius: '6px', fontSize: '12px', fontWeight: 600, textDecoration: 'none' }}>
                  Create a Screen
                </Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {screens.map((screen) => (
                  <SavedScreenTile
                    key={screen.id}
                    screen={screen}
                    onDelete={handleDeleteScreen}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right: Browse sectors */}
          <BrowseSectors />
        </div>
      </div>

      <AppFooter />
    </div>
  )
}

export default ScreenGallery
