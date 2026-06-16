/**
 * FinScreen Design Tokens
 *
 * Single source of truth for design values.
 * CSS custom properties in globals.css mirror these tokens.
 */
export const theme = {
  colors: {
    background:    '#F4F7FB',
    surface:       '#FFFFFF',
    surfaceMuted:  '#F8FAFC',
    border:        '#E2E8F0',
    textPrimary:   '#0D1829',
    textSecondary: '#5A6A7E',
    textMuted:     '#8A99AD',
    accent:        '#2563EB',
    accentSoft:    '#EEF4FF',
    positive:      '#16A34A',
    positiveSoft:  '#F0FDF4',
    negative:      '#DC2626',
    negativeSoft:  '#FEF2F2',
    warning:       '#D97706',
    warningSoft:   '#FFFBEB',
    info:          '#0EA5E9',
    tableRowHover: '#EEF4FF',
    skeletonBase:  '#E2E8F0',
    skeletonHigh:  '#F1F5F9',
  },
  shadow: {
    xs: '0 1px 2px rgba(13,24,41,0.04)',
    sm: '0 1px 3px rgba(13,24,41,0.06), 0 1px 6px rgba(13,24,41,0.04)',
    md: '0 4px 12px rgba(13,24,41,0.08), 0 2px 6px rgba(13,24,41,0.04)',
    lg: '0 12px 32px rgba(13,24,41,0.10), 0 4px 12px rgba(13,24,41,0.06)',
    accent: '0 4px 16px rgba(37,99,235,0.20)',
  },
  radius: {
    sm:  '0.375rem',
    md:  '0.5rem',
    lg:  '0.625rem',
    xl:  '0.875rem',
    '2xl': '1rem',
    full: '9999px',
  },
  fontFamily: {
    sans: 'var(--fs-font)',
    mono: '"JetBrains Mono", "Courier New", monospace',
  },
  fontSize: {
    xs:   '11px',
    sm:   '12px',
    body: '13px',
    md:   '13px',
    lg:   '15px',
    xl:   '18px',
    '2xl': '21px',
    '3xl': '24px',
  },
  fontWeight: {
    regular:  '400',
    medium:   '500',
    semibold: '600',
    bold:     '700',
    black:    '900',
  },
  transition: {
    fast:    '150ms cubic-bezier(0.16, 1, 0.3, 1)',
    default: '200ms cubic-bezier(0.16, 1, 0.3, 1)',
    slow:    '350ms cubic-bezier(0.16, 1, 0.3, 1)',
  },
} as const

export type Theme = typeof theme
