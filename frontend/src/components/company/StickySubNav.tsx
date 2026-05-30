'use client'

import { useEffect, useState } from 'react'
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver'
import { cn } from '@/lib/utils'

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'chart', label: 'Price Chart' },
  { id: 'peers', label: 'Peer Comparison' },
  { id: 'quarters', label: 'Quarterly Results' },
  { id: 'pl', label: 'Profit & Loss' },
  { id: 'balance-sheet', label: 'Balance Sheet' },
  { id: 'cash-flow', label: 'Cash Flow' },
  { id: 'ratios', label: 'Key Ratios' },
  { id: 'analyst', label: 'Analyst Consensus' },
  { id: 'shareholding', label: 'Shareholding' },
  { id: 'corporate-actions', label: 'Corporate Actions' },
  { id: 'documents', label: 'Documents' },
]

export function StickySubNav() {
  const sectionIds = SECTIONS.map((s) => s.id)
  const activeSection = useIntersectionObserver(sectionIds)

  const handleScrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (el) {
      const topOffset = el.getBoundingClientRect().top + window.pageYOffset - 130
      window.scrollTo({ top: topOffset, behavior: 'smooth' })
    }
  }

  return (
    <nav className="sticky top-16 bg-surface border-b border-border z-20 select-none shadow-sm">
      <div className="flex gap-1 overflow-x-auto px-6 py-1 scrollbar-none">
        {SECTIONS.map((section) => {
          const isActive = activeSection === section.id
          return (
            <button
              key={section.id}
              onClick={() => handleScrollTo(section.id)}
              className={cn(
                'relative whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wider transition-colors focus:outline-none',
                isActive ? 'text-accent' : 'text-textSecondary hover:text-textPrimary'
              )}
            >
              {section.label}
              {isActive && (
                <span className="absolute inset-x-4 bottom-0 h-0.5 bg-accent rounded-t-full" />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
