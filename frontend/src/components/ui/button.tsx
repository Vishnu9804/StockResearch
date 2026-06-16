import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium',
    'transition-all duration-150 ease-out',
    'disabled:pointer-events-none disabled:opacity-50',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-1',
    '[&_svg]:pointer-events-none [&_svg:not([class*="size-"])]:size-4 shrink-0 [&_svg]:shrink-0',
    'select-none',
  ].join(' '),
  {
    variants: {
      variant: {
        default:
          'bg-accent text-white hover:bg-accent/90 active:scale-[0.97] shadow-[var(--shadow-accent)] hover:shadow-[var(--shadow-md)]',
        destructive:
          'bg-negative text-white hover:bg-negative/90 active:scale-[0.97] focus-visible:ring-negative/40',
        outline:
          'border border-border bg-transparent text-textSecondary hover:bg-accentSoft hover:text-accent hover:border-accent/40 active:scale-[0.98]',
        secondary:
          'bg-surfaceMuted text-textPrimary border border-border hover:bg-secondary hover:border-border active:scale-[0.98]',
        ghost:
          'text-textSecondary hover:bg-surfaceMuted hover:text-textPrimary active:scale-[0.98]',
        link:
          'text-accent underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        default: 'h-9 px-4 py-2 text-sm has-[>svg]:px-3',
        sm: 'h-7 rounded-md px-3 text-xs has-[>svg]:px-2.5',
        md: 'h-9 px-4 text-sm',
        lg: 'h-11 rounded-xl px-6 text-sm has-[>svg]:px-4',
        icon: 'size-9 rounded-lg',
        'icon-sm': 'size-7 rounded-md',
        'icon-lg': 'size-11 rounded-xl',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
