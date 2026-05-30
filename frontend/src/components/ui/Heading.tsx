import React from 'react'
import { Text } from './Text'
import { typography } from '@/theme'
import { cn } from '@/lib/utils'

export interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  level?: 1 | 2 | 3 | 4 | 5 | 6
  variant?: keyof typeof typography
  children?: React.ReactNode
}

export const Heading = React.forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ level = 2, variant, className, ...props }, ref) => {
    // Default variants based on heading levels
    const defaultVariant = level === 1 ? 'pageTitle' : 'sectionTitle'
    const activeVariant = variant || defaultVariant
    const tag = `h${level}` as React.ElementType

    return (
      <Text
        as={tag}
        variant={activeVariant}
        ref={ref}
        className={cn(className)}
        {...props}
      />
    )
  }
)

Heading.displayName = 'Heading'
