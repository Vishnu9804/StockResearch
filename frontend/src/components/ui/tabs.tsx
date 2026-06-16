import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn('flex flex-col gap-3', className)}
      {...props}
    />
  )
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        'inline-flex h-9 items-center gap-0.5 rounded-lg bg-surfaceMuted border border-border p-1',
        className,
      )}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5',
        'text-xs font-medium whitespace-nowrap text-textSecondary',
        'transition-all duration-150 ease-out',
        'hover:text-textPrimary hover:bg-surface/60',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
        'disabled:pointer-events-none disabled:opacity-40',
        'data-[state=active]:bg-surface data-[state=active]:text-accent data-[state=active]:shadow-[var(--shadow-sm)] data-[state=active]:font-medium',
        '[&_svg]:pointer-events-none [&_svg:not([class*="size-"])]:size-3.5 [&_svg]:shrink-0',
        className,
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn('flex-1 outline-none animate-[fadeInUp_0.18s_ease-out]', className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
