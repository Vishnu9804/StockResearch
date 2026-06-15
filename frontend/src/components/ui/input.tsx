import * as React from 'react'
import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Base
        'h-9 w-full min-w-0 rounded-lg border border-border bg-surfaceMuted px-3 py-1 text-sm text-textPrimary',
        'placeholder:text-textMuted',
        // Transition
        'transition-[border-color,box-shadow,background-color] duration-150 ease-out outline-none',
        // Focus
        'focus-visible:border-accent focus-visible:bg-surface focus-visible:ring-3 focus-visible:ring-accent/20',
        // File input
        'file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-textPrimary',
        // Disabled
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        // Invalid
        'aria-invalid:border-negative aria-invalid:ring-negative/20',
        // Dark
        'dark:bg-surfaceMuted/50',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
