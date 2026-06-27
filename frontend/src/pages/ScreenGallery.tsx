import { Link } from 'react-router-dom'
import { ArrowRight, Plus } from 'lucide-react'
import { SCREENER_TEMPLATES, type ScreenerTemplate } from '@/lib/data/screener'
import { AppFooter } from '@/components/shared/AppFooter'

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

// ─── Category panel definitions ───────────────────────────────────────────────
interface PanelDef {
  title: string
  subtitle: string
  categoryFilter: string[]
  ids?: string[]
}

const PANELS: PanelDef[] = [
  {
    title: 'Popular themes',
    subtitle: 'Popular investing themes',
    categoryFilter: [],
    ids: ['debt-free', 'low-pe-growth', 'magic-formula', 'high-dividend', 'small-cap-growth', 'turnaround'],
  },
  {
    title: 'Popular formulas',
    subtitle: 'Screening formulas based on books',
    categoryFilter: [],
    ids: ['magic-formula', 'consistent-compounders', 'high-roe-low-debt'],
  },
  {
    title: 'Price or Volume',
    subtitle: 'Screens based on price or volume action',
    categoryFilter: ['Technical'],
  },
  {
    title: 'Quarterly results',
    subtitle: 'Screens around latest quarterly results',
    categoryFilter: [],
    ids: ['turnaround', 'small-cap-growth'],
  },
  {
    title: 'Valuation Screens',
    subtitle: 'Screens based on stock valuations',
    categoryFilter: ['Valuation'],
  },
  {
    title: 'Shareholding patterns',
    subtitle: 'Screens based on institutional and promoter activity',
    categoryFilter: ['Shareholding'],
  },
  {
    title: 'Popular stock screens',
    subtitle: 'Popular screens commonly used by investors',
    categoryFilter: [],
    ids: ['high-dividend', 'golden-crossover', 'magic-formula', 'low-pe-growth', 'debt-free', '52w-highs'],
  },
]

// ─── Screen tile ──────────────────────────────────────────────────────────────
function ScreenTile({ screen }: { screen: ScreenerTemplate }) {
  return (
    <Link
      to="/screener/results"
      style={{
        display: 'block',
        padding: '12px 14px',
        border: '1px solid var(--fs-border-color)',
        borderRadius: '8px',
        background: 'var(--fs-surface)',
        textDecoration: 'none',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--fs-brand)'
        ;(e.currentTarget as HTMLElement).style.boxShadow = '0 1px 6px rgba(0,0,0,0.08)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--fs-border-color)'
        ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--fs-brand)', margin: 0, lineHeight: 1.3 }}>
            {screen.name}
            <ArrowRight style={{ display: 'inline', width: '12px', height: '12px', marginLeft: '3px', verticalAlign: 'middle', opacity: 0.6 }} />
          </p>
          <p style={{ fontSize: '12px', color: 'var(--fs-text-secondary)', margin: '3px 0 0', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {screen.description}
          </p>
        </div>
      </div>
    </Link>
  )
}

// ─── Category panel ───────────────────────────────────────────────────────────
function CategoryPanel({ panel }: { panel: PanelDef }) {
  let screens: ScreenerTemplate[] = []

  if (panel.ids && panel.ids.length > 0) {
    screens = panel.ids
      .map((id) => SCREENER_TEMPLATES.find((t) => t.id === id))
      .filter(Boolean) as ScreenerTemplate[]
  } else if (panel.categoryFilter.length > 0) {
    screens = SCREENER_TEMPLATES.filter((t) => panel.categoryFilter.includes(t.category))
  }

  if (screens.length === 0) return null

  return (
    <div
      style={{
        background: 'var(--fs-surface)',
        border: '1px solid var(--fs-border-color)',
        borderRadius: '10px',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        marginBottom: '16px',
      }}
    >
      {/* Panel header */}
      <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--fs-border-color)' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--fs-text-primary)', margin: 0 }}>
          {panel.title}
        </h2>
        <p style={{ fontSize: '12px', color: 'var(--fs-text-muted)', margin: '2px 0 0' }}>
          {panel.subtitle}
        </p>
      </div>

      {/* Tile grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '10px',
          padding: '14px 16px',
        }}
      >
        {screens.slice(0, 6).map((screen) => (
          <ScreenTile key={screen.id} screen={screen} />
        ))}
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
  return (
    <div className="min-h-screen bg-background font-sans select-none">
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '28px 24px 0' }}>

        {/* Page header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--fs-text-primary)', margin: 0 }}>
            Stock screens
          </h1>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: '20px', alignItems: 'start' }}>

          {/* Left: Stacked category panels */}
          <div>
            {PANELS.map((panel) => (
              <CategoryPanel key={panel.title} panel={panel} />
            ))}

            {/* Show all screens CTA */}
            <div style={{ textAlign: 'center', margin: '8px 0 32px' }}>
              <Link
                to="/screener"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '9px 22px',
                  border: '1px solid var(--fs-border-color)',
                  borderRadius: '8px',
                  background: 'var(--fs-surface)',
                  color: 'var(--fs-text-primary)',
                  fontSize: '13px', fontWeight: 500,
                  textDecoration: 'none',
                }}
                className="hover:border-accent hover:text-accent transition-colors"
              >
                SHOW ALL SCREENS
                <ArrowRight style={{ width: '14px', height: '14px' }} />
              </Link>
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
