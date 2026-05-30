import React from 'react'
import { typography } from '@/theme'
import { cn } from '@/lib/utils'

export interface TextProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType
  variant?: keyof typeof typography
  children?: React.ReactNode
  htmlFor?: string
  href?: string
  target?: string
  rel?: string
  disabled?: boolean
}

export const Text = React.forwardRef<HTMLElement, TextProps>(
  ({ as: Component = 'p', variant = 'body', className, ...props }, ref) => {
    // Map of typography variants to Tailwind CSS class names
    // This allows Tailwind JIT to parse static classes and apply modern styles
    const variantClassMap: Record<keyof typeof typography, string> = {
      pageTitle: 'font-sans text-2xl font-semibold tracking-tight text-textPrimary leading-tight',
      sectionTitle: 'font-sans text-lg font-semibold tracking-tight text-textPrimary leading-snug',
      subtitle: 'font-sans text-sm text-textSecondary leading-normal',
      body: 'font-sans text-sm text-textPrimary leading-relaxed',
      bodyMuted: 'font-sans text-sm text-textSecondary leading-relaxed',
      label: 'font-sans text-xs font-semibold text-textSecondary uppercase tracking-wider',
      caption: 'font-sans text-xs text-textMuted leading-normal',
      numeric: 'font-mono text-sm tracking-normal tabular-nums',
    }

    return (
      <Component
        ref={ref}
        className={cn(variantClassMap[variant], className)}
        {...props}
      />
    )
  }
)

Text.displayName = 'Text'
