import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Plus, Trash2, Inbox, Sparkles, BookOpen, TrendingUp, DollarSign } from 'lucide-react'
import { AppFooter } from '@/components/shared/AppFooter'
import { screenerApiClient } from '@/services/finscreenApi'
import { toast } from 'react-hot-toast'

// ─── Sector list (inspired by screener.in's Browse Sectors panel) ──────────────
const BROWSE_SECTORS = [
  'Information Technology', 'Metals & Mining', 'Energy & Oil',
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

// ─── Template groups mapping to local db columns ───────────────────────────────
const POPULAR_THEMES = [
  {
    name: 'Low on 10 year average earnings',
    description: 'Graham-style value: low PE, high ROCE, dividend payers with low debt.',
    query: 'pe < 15 AND dividend_yield > 2 AND debt_to_equity < 0.5 AND roce > 15',
  },
  {
    name: 'Capacity expansion',
    description: 'Companies exhibiting high sales growth and strong capital returns.',
    query: 'sales_growth_3y > 15 AND roce > 15',
  },
  {
    name: 'Debt reduction',
    description: 'Deleveraging firms with comfortable interest coverage and low debt.',
    query: 'debt_to_equity < 0.5 AND interest_coverage > 5',
  },
]

const POPULAR_FORMULAS = [
  {
    name: 'Piotroski Scan',
    description: 'High quality companies matching strong financial health criteria.',
    query: 'roce > 15 AND roe > 15 AND debt_to_equity < 0.5',
  },
  {
    name: 'Magic Formula',
    description: 'Joel Greenblatt\'s strategy: buying capital-efficient firms at cheap prices.',
    query: 'roce > 20 AND pe < 15 AND market_cap > 500',
  },
  {
    name: 'Coffee Can Portfolio',
    description: 'Low risk compounders: consistent double digit growth and high ROCE.',
    query: 'sales_growth_3y > 10 AND roce > 15 AND debt_to_equity < 0.5',
  },
]

const PRICE_VOLUME = [
  {
    name: 'Golden Crossover',
    description: 'Stocks exhibiting upward trend momentum with positive daily change.',
    query: 'cmp > 100 AND change_pct > 1',
  },
  {
    name: '52-Week Highs',
    description: 'Stocks trading at momentum highs with daily gain confirmation.',
    query: 'cmp > 100 AND change_pct > 2',
  },
  {
    name: 'RSI - Oversold Stocks',
    description: 'Quality companies in technically oversold territory (RSI < 35).',
    query: 'rsi14 < 35 AND roce > 15',
  },
]

const VALUATION_SCREENS = [
  {
    name: 'Undervalued by Book',
    description: 'Stocks trading near or below book value with solid ROE.',
    query: 'pb < 1.5 AND roe > 10 AND pe < 20',
  },
  {
    name: 'Low PE High Growth',
    description: 'Growth at a Reasonable Price (GARP) stocks with low valuations.',
    query: 'pe < 15 AND sales_growth_3y > 15 AND roce > 15',
  },
  {
    name: 'High ROE, Low Debt',
    description: 'Super-efficient compounders with minimal leverage requirements.',
    query: 'roe > 20 AND debt_to_equity < 0.3 AND net_profit_margin > 10',
  },
]

// ─── Template Card component ──────────────────────────────────────────────────
function TemplateCard({ name, description, query }: { name: string; description: string; query: string }) {
  const navigate = useNavigate()
  
  const handleClick = () => {
    navigate(`/screener/results?query=${encodeURIComponent(query)}&name=${encodeURIComponent(name)}`)
  }

  return (
    <div
      onClick={handleClick}
      style={{
        padding: '16px 20px',
        border: '1px solid var(--fs-border-color)',
        borderRadius: '8px',
        background: 'var(--fs-surface)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
      className="hover:border-accent hover:shadow-sm group"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--fs-brand)', margin: 0 }} className="group-hover:underline">
          {name}
        </h3>
        <ArrowRight style={{ width: '14px', height: '14px', color: 'var(--fs-brand)', opacity: 0.5 }} className="group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
      </div>
      <p style={{ fontSize: '12px', color: 'var(--fs-text-secondary)', margin: '6px 0 0', lineHeight: 1.5 }}>
        {description}
      </p>
    </div>
  )
}

// ─── Saved Screen Card component ──────────────────────────────────────────────
function SavedScreenTile({ screen, onDelete }: { screen: any; onDelete: (id: string) => void }) {
  return (
    <div
      style={{
        padding: '14px 18px',
        border: '1px solid var(--fs-border-color)',
        borderRadius: '8px',
        background: 'var(--fs-surface)',
        marginBottom: '10px',
        position: 'relative'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <Link
            to={`/screener/results?query=${encodeURIComponent(screen.queryText)}&name=${encodeURIComponent(screen.name)}`}
            style={{ fontSize: '13px', fontWeight: 600, color: 'var(--fs-brand)', textDecoration: 'none' }}
            className="hover:underline"
          >
            {screen.name}
            <ArrowRight style={{ display: 'inline', width: '12px', height: '12px', marginLeft: '5px', verticalAlign: 'middle', opacity: 0.6 }} />
          </Link>
          <p style={{ fontSize: '11px', color: 'var(--fs-text-secondary)', margin: '4px 0 0', lineHeight: 1.4 }}>
            {screen.description || 'No description provided.'}
          </p>
          <code style={{ display: 'block', fontSize: '10px', color: 'var(--fs-text-muted)', background: 'var(--fs-background)', padding: '4px 8px', borderRadius: '4px', marginTop: '6px', fontFamily: 'monospace', overflowX: 'auto', whiteSpace: 'nowrap' }}>
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
            padding: '4px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          className="hover:bg-red-50 dark:hover:bg-red-950/20"
          title="Delete Saved Screen"
        >
          <Trash2 style={{ width: '14px', height: '14px' }} />
        </button>
      </div>
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
        <h3 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--fs-text-primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Browse sectors
        </h3>
      </div>
      <div style={{ padding: '10px 14px 16px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {BROWSE_SECTORS.map((sector) => (
          <Link
            key={sector}
            to={`/screener/results?query=${encodeURIComponent(`sector = "${sector}"`)}&name=${encodeURIComponent(`Sector: ${sector}`)}`}
            style={{
              fontSize: '11px',
              color: 'var(--fs-brand)',
              textDecoration: 'none',
              padding: '2px 0',
              lineHeight: 1.7,
            }}
            className="hover:underline font-medium"
          >
            {sector}
            {sector !== BROWSE_SECTORS[BROWSE_SECTORS.length - 1] && (
              <span style={{ color: 'var(--fs-border-color)', marginLeft: '6px', marginRight: '2px' }}>·</span>
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
      const res = await screenerApiClient.get('/saved')
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
      const deletePromise = screenerApiClient.delete(`/saved/${id}`)
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
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '28px', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--fs-text-primary)', margin: 0, letterSpacing: '-0.01em' }}>
              Stock Screens
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--fs-text-secondary)', margin: '4px 0 0' }}>
              Predefined popular templates and custom database queries.
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
              borderRadius: '6px',
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '28px', alignItems: 'start', marginBottom: '40px' }}>

          {/* Left: Stacked category panels */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            
            {/* 1. Popular Investing Themes */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <Sparkles style={{ width: '16px', height: '16px', color: 'var(--fs-brand)' }} />
                <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--fs-text-primary)', margin: 0 }}>
                  Popular Themes
                </h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
                {POPULAR_THEMES.map((theme, i) => (
                  <TemplateCard key={i} {...theme} />
                ))}
              </div>
            </div>

            {/* 2. Popular Formulas */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <BookOpen style={{ width: '16px', height: '16px', color: 'var(--fs-brand)' }} />
                <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--fs-text-primary)', margin: 0 }}>
                  Popular Formulas
                </h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
                {POPULAR_FORMULAS.map((formula, i) => (
                  <TemplateCard key={i} {...formula} />
                ))}
              </div>
            </div>

            {/* 3. Price or Volume */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <TrendingUp style={{ width: '16px', height: '16px', color: 'var(--fs-brand)' }} />
                <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--fs-text-primary)', margin: 0 }}>
                  Price or Volume
                </h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
                {PRICE_VOLUME.map((pv, i) => (
                  <TemplateCard key={i} {...pv} />
                ))}
              </div>
            </div>

            {/* 4. Valuation Screens */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <DollarSign style={{ width: '16px', height: '16px', color: 'var(--fs-brand)' }} />
                <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--fs-text-primary)', margin: 0 }}>
                  Valuation Screens
                </h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
                {VALUATION_SCREENS.map((val, i) => (
                  <TemplateCard key={i} {...val} />
                ))}
              </div>
            </div>

            {/* 5. Custom / Saved Screens */}
            <div style={{ borderTop: '1px solid var(--fs-border-color)', paddingTop: '24px', marginTop: '8px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--fs-text-primary)', margin: '0 0 14px' }}>
                Your Saved Screens
              </h2>
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ height: '70px', background: 'var(--fs-surface)', borderRadius: '8px', border: '1px solid var(--fs-border-color)' }} className="animate-pulse" />
                  <div style={{ height: '70px', background: 'var(--fs-surface)', borderRadius: '8px', border: '1px solid var(--fs-border-color)' }} className="animate-pulse" />
                </div>
              ) : error ? (
                <div style={{ padding: '20px', border: '1px solid #FCA5A5', background: '#FEF2F2', borderRadius: '8px', color: '#B91C1C', fontSize: '13px', fontWeight: 500, textAlign: 'center' }}>
                  <p style={{ margin: '0 0 10px' }}>{error}</p>
                  <button onClick={fetchScreens} style={{ padding: '6px 14px', background: '#EF4444', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                    Retry
                  </button>
                </div>
              ) : screens.length === 0 ? (
                <div style={{ padding: '32px 24px', border: '1px dashed var(--fs-border-color)', borderRadius: '8px', background: 'var(--fs-surface)', textAlign: 'center' }}>
                  <Inbox style={{ width: '28px', height: '28px', color: 'var(--fs-text-muted)', marginBottom: '8px' }} />
                  <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--fs-text-primary)', margin: 0 }}>No saved screens found</h3>
                  <p style={{ fontSize: '11px', color: 'var(--fs-text-secondary)', margin: '4px 0 12px' }}>
                    Create custom screens in Query Builder and save them here.
                  </p>
                  <Link to="/screener" style={{ display: 'inline-block', padding: '6px 16px', background: 'var(--fs-brand)', color: '#fff', borderRadius: '6px', fontSize: '11px', fontWeight: 600, textDecoration: 'none' }}>
                    Create a Screen
                  </Link>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
