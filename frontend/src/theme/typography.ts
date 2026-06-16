import { theme } from './theme'

/**
 * FinScreen Semantic Typography Variants
 * 
 * Maps semantic roles to style definitions. These variants should be used
 * for all text elements in the application.
 * 
 * How to add a new variant:
 * 1. Define its shape in the `typography` object below.
 * 2. Map it to appropriate Tailwind CSS utility classes in the `<Text>` and `<Heading>` components.
 * 3. Document its use case.
 */
export const typography = {
  /** Page-level headings, main screen titles */
  pageTitle: {
    fontFamily: theme.fontFamily.sans,
    fontSize: theme.fontSize['3xl'],
    fontWeight: theme.fontWeight.semibold,
    lineHeight: '1.25',
  },
  /** Card headers, section dividers, modular headers */
  sectionTitle: {
    fontFamily: theme.fontFamily.sans,
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: '1.3',
  },
  /** Subtle text descriptive elements directly below a page/section header */
  subtitle: {
    fontFamily: theme.fontFamily.sans,
    fontSize: theme.fontSize.body,
    fontWeight: theme.fontWeight.regular,
    lineHeight: '1.5',
  },
  /** Default content, paragraphs, and list items */
  body: {
    fontFamily: theme.fontFamily.sans,
    fontSize: theme.fontSize.body,
    fontWeight: theme.fontWeight.regular,
    lineHeight: '1.5',
  },
  /** Secondary reading text, secondary list item details, dates */
  bodyMuted: {
    fontFamily: theme.fontFamily.sans,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.regular,
    lineHeight: '1.5',
  },
  /** Form input labels, small headers, category tags */
  label: {
    fontFamily: theme.fontFamily.sans,
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.medium,
    lineHeight: '1.3',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  /** Extra small metadata, table headers, tiny timestamps */
  caption: {
    fontFamily: theme.fontFamily.sans,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.regular,
    lineHeight: '1.5',
  },
  /** Tabular numbers for financial and mathematical values */
  numeric: {
    fontFamily: theme.fontFamily.mono,
    fontSize: theme.fontSize.body,
    fontWeight: theme.fontWeight.regular,
    lineHeight: '1.5',
  },
} as const

export type Typography = typeof typography
