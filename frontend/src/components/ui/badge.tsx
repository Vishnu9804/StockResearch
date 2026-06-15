import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  [
    'inline-flex items-center justify-center rounded-full border px-2 py-0.5',
    'text-[10px] font-bold uppercase tracking-wide w-fit whitespace-nowrap shrink-0',
    '[&>svg]:size-3 gap-1 [&>svg]:pointer-events-none',
    'transition-colors duration-150 overflow-hidden',
  ].join(' '),
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-accent text-white',
        secondary:
          'border-transparent bg-surfaceMuted text-textSecondary',
        destructive:
          'border-transparent bg-negative text-white',
        outline:
          'border-border text-textSecondary bg-transparent',
        success:
          'border-transparent bg-positive-soft text-positive border border-positive/20',
        warning:
          'border-transparent bg-warning-soft text-warning border border-warning/20',
        info:
          'border-transparent bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'span'
  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
