import { Link } from 'react-router-dom'
import { Sun, Moon, Monitor } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'

export function AppFooter() {
  const { theme, setTheme } = useTheme()

  return (
    <footer
      style={{
        borderTop: '1px solid var(--fs-border-color)',
        background: 'var(--fs-surface)',
        marginTop: '40px',
      }}
      className="select-none"
    >
      <div
        style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '32px 24px 24px',
          display: 'grid',
          gridTemplateColumns: '1fr auto auto auto',
          gap: '40px',
          alignItems: 'start',
        }}
        className="flex-wrap"
      >
        {/* Left: Brand */}
        <div style={{ minWidth: '200px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <span
              style={{
                fontSize: '16px',
                fontWeight: 700,
                color: 'var(--fs-brand)',
                letterSpacing: '-0.01em',
              }}
            >
              FinScreen
            </span>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 600,
                color: 'var(--fs-brand)',
                background: 'var(--fs-info-soft)',
                padding: '1px 5px',
                borderRadius: '4px',
                letterSpacing: '0.05em',
              }}
            >
              BETA
            </span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--fs-text-muted)', lineHeight: 1.6, marginBottom: '12px' }}>
            Stock analysis and screening tool<br />for Indian equity markets.
          </p>
          <p style={{ fontSize: '11px', color: 'var(--fs-text-muted)', lineHeight: 1.5 }}>
            © 2025 FinScreen. All rights reserved.<br />
            Data provided for informational purposes only.
          </p>
        </div>

        {/* Product links */}
        <div>
          <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--fs-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '12px' }}>
            Product
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { label: 'Premium', to: '/pricing' },
              { label: "What's new", to: '/' },
              { label: 'Learn', to: '/screens' },
            ].map((item) => (
              <li key={item.label}>
                <Link
                  to={item.to}
                  style={{ fontSize: '12px', color: 'var(--fs-text-muted)' }}
                  className="hover:text-accent hover:underline transition-colors"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Team links */}
        <div>
          <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--fs-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '12px' }}>
            Team
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { label: 'About us', to: '/pricing' },
              { label: 'Support', to: '/pricing' },
            ].map((item) => (
              <li key={item.label}>
                <Link
                  to={item.to}
                  style={{ fontSize: '12px', color: 'var(--fs-text-muted)' }}
                  className="hover:text-accent hover:underline transition-colors"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Theme toggle */}
        <div>
          <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--fs-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '12px' }}>
            Theme
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {([
              { label: 'Light', value: 'light' as const, Icon: Sun },
              { label: 'Dark', value: 'dark' as const, Icon: Moon },
            ] as const).map(({ label, value, Icon }) => (
              <li key={label}>
                <button
                  onClick={() => setTheme(value)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    color: theme === value ? 'var(--fs-brand)' : 'var(--fs-text-muted)',
                    fontWeight: theme === value ? 600 : 400,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                  className="hover:text-accent transition-colors"
                >
                  <Icon style={{ width: '13px', height: '13px' }} />
                  {label}
                </button>
              </li>
            ))}
            <li>
              <button
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  color: 'var(--fs-text-muted)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
                className="hover:text-accent transition-colors"
              >
                <Monitor style={{ width: '13px', height: '13px' }} />
                Auto
              </button>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  )
}

export default AppFooter
