/**
 * FinScreen Base Design Tokens
 * 
 * This file defines the foundational color palette, typography scale,
 * and font weights for the FinScreen design system.
 * 
 * To update design tokens:
 * 1. Modify the values in the `theme` object below.
 * 2. Ensure that corresponding Tailwind CSS custom properties in `src/globals.css` are aligned.
 */
export const theme = {
  colors: {
    background: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceMuted: '#F9FAFB',
    border: '#E5E7EB',
    textPrimary: '#0F172A',
    textSecondary: '#64748B',
    textMuted: '#94A3B8',
    accent: '#1D4ED8',
    accentSoft: '#EFF6FF',
    positive: '#16A34A',
    negative: '#DC2626',
    warning: '#D97706',
    info: '#0EA5E9',
    tableRowHover: '#EFF6FF',
    skeletonBase: '#E2E8F0',
    skeletonHighlight: '#F1F5F9',
  },
  fontFamily: {
    sans: '"Inter", system-ui, -apple-system, sans-serif',
    mono: '"JetBrains Mono", "Courier New", monospace',
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    md: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const

export type Theme = typeof theme
