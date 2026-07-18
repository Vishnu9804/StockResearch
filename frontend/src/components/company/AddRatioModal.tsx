import { useMemo, useState } from 'react'
import { Search, Plus } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import type { RatioDefinition } from '@/hooks/useRatioPreferences'

interface AddRatioModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Ratios not already pinned to the company page — names only, no values. */
  availableRatios: RatioDefinition[]
  onAdd: (keys: string[]) => void
}

export function AddRatioModal({ open, onOpenChange, availableRatios, onAdd }: AddRatioModalProps) {
  const [query, setQuery] = useState('')
  const [checked, setChecked] = useState<Set<string>>(new Set())

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? availableRatios.filter((r) => r.label.toLowerCase().includes(q) || r.category.toLowerCase().includes(q))
      : availableRatios

    const byCategory = new Map<string, RatioDefinition[]>()
    for (const r of list) {
      if (!byCategory.has(r.category)) byCategory.set(r.category, [])
      byCategory.get(r.category)!.push(r)
    }
    return byCategory
  }, [availableRatios, query])

  const toggle = (key: string) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleAdd = () => {
    if (checked.size === 0) return
    onAdd(Array.from(checked))
    setChecked(new Set())
    setQuery('')
    onOpenChange(false)
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setChecked(new Set())
      setQuery('')
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-5 pb-3 border-b border-border/50">
          <DialogTitle className="text-sm font-medium text-textPrimary">Add Ratios</DialogTitle>
          <DialogDescription className="text-xs text-textMuted">
            Pick the ratios you want pinned to every company page you visit.
          </DialogDescription>
          <div className="relative mt-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-textMuted" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search ratios (e.g. PEG, EV/EBITDA)..."
              className="h-9 pl-8 text-xs border-border bg-surface text-textPrimary"
              autoFocus
            />
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
          {filtered.size === 0 && (
            <p className="text-xs text-textMuted text-center py-8">
              {availableRatios.length === 0 ? 'All available ratios are already added.' : 'No ratios match your search.'}
            </p>
          )}
          {Array.from(filtered.entries()).map(([category, ratios]) => (
            <div key={category}>
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-textMuted mb-1.5">
                {category}
              </h4>
              <div className="space-y-0.5">
                {ratios.map((r) => (
                  <label
                    key={r.key}
                    htmlFor={`ratio-${r.key}`}
                    className="flex items-center gap-2.5 py-1.5 px-2 rounded-md hover:bg-surfaceMuted/60 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      id={`ratio-${r.key}`}
                      checked={checked.has(r.key)}
                      onCheckedChange={() => toggle(r.key)}
                    />
                    <span className="text-xs font-medium text-textSecondary">{r.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="p-4 border-t border-border/50 flex-row items-center justify-between sm:justify-between">
          <span className="text-xs text-textMuted">
            {checked.size > 0 ? `${checked.size} selected` : ' '}
          </span>
          <Button
            size="sm"
            disabled={checked.size === 0}
            onClick={handleAdd}
            className="gap-1.5 bg-accent hover:bg-accent/90 text-white font-medium text-xs uppercase tracking-wide h-8"
          >
            <Plus className="size-3.5" />
            Add {checked.size > 0 ? `(${checked.size})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default AddRatioModal
