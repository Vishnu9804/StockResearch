import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { Bell, Columns3, Download, Edit3, Play, ChevronRight, Mail, Save } from 'lucide-react'
import { ScreenerResultsTable } from '@/components/screener/results-table'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { setQuery as setReduxQuery, runScreenerStart } from '@/store/slices/screenerSlice'
import { toast } from 'react-hot-toast'
import { AppFooter } from '@/components/shared/AppFooter'
import { screenerApiClient } from '@/services/finscreenApi'

interface EditingScreen {
  id: string
  name: string
}

interface ResultsLocationState {
  editingScreen?: EditingScreen | null
}

export function ScreenerResults() {
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useAppDispatch()
  const { isAuthenticated } = useAppSelector((state) => state.auth)
  const { queryText, totalCount, status } = useAppSelector((state) => state.screener)

  const [query, setQuery] = useState(
    queryText ||
    `market_cap > 500 AND
roe > 15 AND
debt_to_equity < 1`
  )
  const [onlyLatest, setOnlyLatest] = useState(false)
  const [screenName, setScreenName] = useState('Custom Screen')
  const [editingScreen, setEditingScreen] = useState<EditingScreen | null>(
    (location.state as ResultsLocationState | null)?.editingScreen ?? null
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlQuery = params.get('query')
    const urlName = params.get('name')
    if (urlName) {
      setScreenName(urlName)
    } else {
      setScreenName('Custom Screen')
    }

    if (urlQuery) {
      // URL has explicit query param — use it
      setQuery(urlQuery)
      dispatch(setReduxQuery(urlQuery))
      dispatch(runScreenerStart({ query: urlQuery }))
    } else if (status === 'loading') {
      // Already in flight from the screener page — do nothing, saga is running
      return
    } else if (queryText) {
      // Use existing query text from Redux state
      setQuery(queryText)
      dispatch(runScreenerStart({ query: queryText }))
    } else {
      // Fallback: run with default query
      dispatch(setReduxQuery(query))
      dispatch(runScreenerStart({ query }))
    }
  }, [dispatch]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the "customize query" textarea in sync when the query changes some
  // other way (e.g. removing a filter chip re-runs a shorter query).
  useEffect(() => {
    if (queryText) setQuery(queryText)
  }, [queryText])

  const handleSaveScreen = async () => {
    if (!isAuthenticated) {
      toast.error('Please sign in to save screens.')
      navigate(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`)
      return
    }

    const currentQuery = (queryText || query).trim()
    if (!currentQuery) {
      toast.error('Please run a query with at least one filter before saving.')
      return
    }

    const name = window.prompt(
      editingScreen ? 'Update the name for this screen:' : 'Enter a name for this saved screen:',
      editingScreen?.name ?? (screenName !== 'Custom Screen' ? screenName : '')
    )
    if (name === null) return // Cancelled
    if (!name.trim()) {
      toast.error('Please provide a valid name.')
      return
    }

    try {
      setSaving(true)
      const payload = {
        name: name.trim(),
        queryText: currentQuery,
        alertEnabled: false,
        alertFrequency: 'IMMEDIATE',
      }
      const savePromise = editingScreen
        ? screenerApiClient.put(`/saved/${editingScreen.id}`, payload)
        : screenerApiClient.post('/saved', payload)

      toast.promise(savePromise, {
        loading: editingScreen ? 'Updating screen...' : 'Saving screen to account...',
        success: editingScreen ? '✓ Screen updated successfully!' : '✓ Screen saved successfully!',
        error: (err) => err.response?.data?.detail?.message || err.message || 'Failed to save screen',
      })
      await savePromise
      navigate('/screens')
    } catch (err) {
      console.error('Save screen error:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-background font-sans select-none">

      {/* ── Main content area ── */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '28px 24px 0' }}>

        {/* Breadcrumb */}
        <div style={{ fontSize: 'var(--fs-size-xs)', color: 'var(--fs-text-muted)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Link to="/" className="hover:underline hover:text-accent transition-colors">Home</Link>
          <ChevronRight style={{ width: '13px', height: '13px', opacity: 0.5 }} />
          <Link to="/screener" className="hover:underline hover:text-accent transition-colors">Screeners</Link>
          <ChevronRight style={{ width: '13px', height: '13px', opacity: 0.5 }} />
          <span style={{ color: 'var(--fs-brand)', fontWeight: 500 }}>{screenName}</span>
        </div>

        {/* ── Main Content Card (title + table) ── */}
        <div
          style={{
            background: 'var(--fs-surface)',
            border: '1px solid var(--fs-border-color)',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            marginBottom: '20px',
          }}
        >
          {/* Card Header — Title band */}
          <div
            style={{
              padding: '20px 24px 16px',
              borderBottom: '1px solid var(--fs-border-color)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
              {/* Left: Title + description + meta */}
              <div style={{ flex: 1, minWidth: '280px' }}>
                <h1 style={{ fontSize: 'var(--fs-size-3xl)', fontWeight: 600, color: 'var(--fs-text-primary)', margin: 0, lineHeight: 1.3, letterSpacing: '-0.01em' }}>
                  {screenName}
                </h1>
                <p style={{ fontSize: 'var(--fs-size-body)', color: 'var(--fs-text-secondary)', margin: '6px 0 0', lineHeight: 1.6, fontFamily: 'var(--font-mono, monospace)', background: 'var(--fs-background)', padding: '6px 10px', borderRadius: '6px', display: 'inline-block', maxWidth: '100%', wordBreak: 'break-word' }}>
                  {queryText || query}
                </p>
                <p style={{ fontSize: 'var(--fs-size-sm)', color: 'var(--fs-text-muted)', margin: '8px 0 0' }}>
                  by{' '}
                  <span style={{ color: 'var(--fs-brand)', fontWeight: 500, cursor: 'default' }}>FinScreen Team</span>
                </p>
                <p style={{ fontSize: 'var(--fs-size-sm)', color: 'var(--fs-text-muted)', margin: '4px 0 0' }}>
                  <span style={{ color: 'var(--fs-brand)', fontWeight: 500 }}>{totalCount} results found</span>
                  {status === 'loading' && <span style={{ marginLeft: '8px', color: 'var(--fs-text-secondary)' }}>(Loading...)</span>}
                </p>
              </div>

              {/* Right: Action buttons */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Edit Columns */}
                <button
                  onClick={() => toast.success('Columns editing dialog opened')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    padding: '7px 12px',
                    border: '1px solid var(--fs-border-color)',
                    borderRadius: '6px',
                    background: 'var(--fs-surface)',
                    fontSize: 'var(--fs-size-sm)', fontWeight: 500,
                    color: 'var(--fs-text-secondary)',
                    cursor: 'pointer',
                  }}
                  className="hover:bg-surfaceMuted transition-colors"
                >
                  <Columns3 style={{ width: '13px', height: '13px' }} />
                  Edit Columns
                </button>

                {/* Export */}
                <button
                  onClick={() => toast.success('✓ Exported to Excel')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    padding: '7px 12px',
                    border: '1px solid var(--fs-border-color)',
                    borderRadius: '6px',
                    background: 'var(--fs-surface)',
                    fontSize: 'var(--fs-size-sm)', fontWeight: 500,
                    color: 'var(--fs-text-secondary)',
                    cursor: 'pointer',
                  }}
                  className="hover:bg-surfaceMuted transition-colors"
                >
                  <Download style={{ width: '13px', height: '13px' }} />
                  Export
                </button>

                {/* Edit Screen */}
                <Link
                  to="/screener"
                  state={{ fromResults: true, queryText: queryText || query, editingScreen }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    padding: '7px 12px',
                    border: '1px solid var(--fs-border-color)',
                    borderRadius: '6px',
                    background: 'var(--fs-surface)',
                    fontSize: 'var(--fs-size-sm)', fontWeight: 500,
                    color: 'var(--fs-text-secondary)',
                    textDecoration: 'none',
                  }}
                  className="hover:bg-surfaceMuted transition-colors"
                >
                  <Edit3 style={{ width: '13px', height: '13px' }} />
                  Edit Screen
                </Link>

                {/* Save Screen */}
                <button
                  onClick={handleSaveScreen}
                  disabled={saving}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    padding: '7px 12px',
                    border: '1px solid var(--fs-border-color)',
                    borderRadius: '6px',
                    background: 'var(--fs-surface)',
                    fontSize: 'var(--fs-size-sm)', fontWeight: 500,
                    color: 'var(--fs-text-secondary)',
                    cursor: saving ? 'default' : 'pointer',
                    opacity: saving ? 0.6 : 1,
                  }}
                  className="hover:bg-surfaceMuted transition-colors"
                >
                  <Save style={{ width: '13px', height: '13px' }} />
                  {editingScreen ? 'Update Screen' : 'Save Screen'}
                </button>

                {/* Get Email Updates — primary CTA */}
                <button
                  onClick={() => {
                    if (!isAuthenticated) {
                      toast.error('Please sign in to get email updates.')
                      navigate(`/login?redirect=${encodeURIComponent(window.location.pathname)}`)
                    } else {
                      toast.success('✓ Email updates enabled for this screen')
                    }
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '7px 14px',
                    border: 'none',
                    borderRadius: '6px',
                    background: 'var(--fs-brand)',
                    color: '#fff',
                    fontSize: 'var(--fs-size-sm)', fontWeight: 600,
                    cursor: 'pointer',
                    letterSpacing: '0.01em',
                  }}
                  className="hover:opacity-90 transition-opacity shadow-sm"
                >
                  <Mail style={{ width: '13px', height: '13px' }} />
                  Get Email Updates
                </button>
              </div>
            </div>
          </div>

          {/* Table area — ScreenerResultsTable handles: stat row, filter chips, data table, pagination */}
          <div style={{ padding: '0' }}>
            <ScreenerResultsTable />
          </div>
        </div>

        {/* ── Query & Helper Panel ── */}
        <div
          style={{
            background: 'var(--fs-surface)',
            border: '1px solid var(--fs-border-color)',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            marginBottom: '20px',
          }}
        >
          <div style={{ padding: '20px 24px' }}>
            {/* Section title */}
            <h2 style={{ fontSize: 'var(--fs-size-lg)', fontWeight: 600, color: 'var(--fs-text-primary)', margin: '0 0 4px' }}>
              Search Query
            </h2>
            <p style={{ fontSize: 'var(--fs-size-sm)', color: 'var(--fs-text-secondary)', margin: '0 0 16px' }}>
              You can customize the query below:
            </p>

            {/* Two-column query layout */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '16px', alignItems: 'start' }}>
              {/* Left: query editor */}
              <div>
                <label
                  htmlFor="screener-query"
                  style={{ display: 'block', fontSize: 'var(--fs-size-xs)', fontWeight: 600, color: 'var(--fs-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}
                >
                  Query
                </label>
                <textarea
                  id="screener-query"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  rows={5}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '12px 14px',
                    fontSize: 'var(--fs-size-body)',
                    fontFamily: 'var(--font-mono, monospace)',
                    color: 'var(--fs-text-primary)',
                    background: 'var(--fs-background)',
                    border: '1px solid var(--fs-border-color)',
                    borderRadius: '8px',
                    resize: 'vertical',
                    lineHeight: 1.7,
                    outline: 'none',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--fs-brand)' }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--fs-border-color)' }}
                  spellCheck={false}
                />

                {/* Checkbox */}
                <label
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    marginTop: '10px',
                    fontSize: 'var(--fs-size-sm)',
                    color: 'var(--fs-text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={onlyLatest}
                    onChange={(e) => setOnlyLatest(e.target.checked)}
                    style={{ width: '13px', height: '13px', cursor: 'pointer', accentColor: 'var(--fs-brand)' }}
                  />
                  Only companies with Mar 2026 results
                </label>

                {/* Run Query button */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '14px' }}>
                  <button
                    onClick={() => {
                      dispatch(setReduxQuery(query))
                      dispatch(runScreenerStart({ query }))
                      toast.success('Query executed — results updated')
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '7px',
                      padding: '9px 20px',
                      background: 'var(--fs-brand)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: 'var(--fs-size-body)', fontWeight: 600,
                      cursor: 'pointer',
                      letterSpacing: '0.02em',
                    }}
                    className="hover:opacity-90 transition-opacity"
                  >
                    <Play style={{ width: '13px', height: '13px', fill: '#fff' }} />
                    RUN THIS QUERY
                  </button>
                  <button
                    onClick={() => toast.success('Showing all available ratios')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '5px',
                      background: 'none',
                      border: 'none',
                      color: 'var(--fs-text-secondary)',
                      fontSize: 'var(--fs-size-sm)', fontWeight: 500,
                      cursor: 'pointer',
                    }}
                    className="hover:text-accent transition-colors"
                  >
                    ↗ SHOW ALL RATIOS
                  </button>
                </div>
              </div>

              {/* Right: Custom query example */}
              <div
                style={{
                  background: 'var(--fs-background)',
                  border: '1px solid var(--fs-border-color)',
                  borderRadius: '8px',
                  padding: '14px 16px',
                }}
              >
                <p style={{ fontSize: 'var(--fs-size-body)', fontWeight: 600, color: 'var(--fs-text-primary)', margin: '0 0 10px' }}>
                  Custom query example
                </p>
                <pre
                  style={{
                    fontSize: 'var(--fs-size-sm)',
                    fontFamily: 'var(--font-mono, monospace)',
                    color: 'var(--fs-text-secondary)',
                    lineHeight: 1.8,
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                  }}
                >
{`Market capitalization > 500 AND
Price to earning < 15 AND
Return on capital employed > 22%`}
                </pre>
                <hr style={{ border: 'none', borderTop: '1px solid var(--fs-border-color)', margin: '12px 0' }} />
                <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); toast.success('Opening documentation') }}
                  style={{ fontSize: 'var(--fs-size-sm)', color: 'var(--fs-brand)', fontWeight: 500, textDecoration: 'none' }}
                  className="hover:underline"
                >
                  Detailed guide on creating screens →
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <AppFooter />
    </div>
  )
}

export default ScreenerResults
