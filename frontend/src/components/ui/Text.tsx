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
      pageTitle: 'font-sans text-3xl font-semibold tracking-tight text-textPrimary leading-tight',
      sectionTitle: 'font-sans text-xl font-semibold tracking-tight text-textPrimary leading-snug',
      subtitle: 'font-sans text-body text-textSecondary leading-normal',
      body: 'font-sans text-body text-textPrimary leading-normal',
      bodyMuted: 'font-sans text-sm text-textSecondary leading-normal',
      label: 'font-sans text-xs font-medium text-textSecondary uppercase tracking-wider leading-none',
      caption: 'font-sans text-sm text-textMuted leading-normal',
      numeric: 'font-mono text-body tracking-normal tabular-nums leading-normal',
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
