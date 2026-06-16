import React from 'react'
import { Card, CardContent } from "@/components/ui/card"
import { formatPct } from "@/lib/formatters"
import { cn } from "@/lib/utils"

interface MetricCardProps {
  label: string
  value: string | number
  unit?: string
  changePct?: number
  hint?: string
}

export function MetricCard({ label, value, unit, changePct, hint }: MetricCardProps) {
  const isPositive = changePct !== undefined ? changePct >= 0 : null
  
  return (
    <Card className="border-border/40 shadow-xs bg-surface rounded-xl hover:shadow-sm hover:border-accent/20 transition-all duration-200">
      <CardContent className="px-4 py-3 flex flex-col justify-between h-full">
        <div>
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs uppercase tracking-wider text-textSecondary font-medium">
              {label}
            </span>
            {hint && (
              <span className="text-xs text-textMuted font-normal truncate max-w-[120px]" title={hint}>
                {hint}
              </span>
            )}
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-semibold tracking-tight text-textPrimary font-mono">
              {value}
            </span>
            {unit && (
              <span className="text-xs text-textSecondary font-medium ml-0.5 font-sans">
                {unit}
              </span>
            )}
          </div>
        </div>
        {changePct !== undefined && (
          <div className="mt-2 flex items-center">
            <span
              className={cn(
                "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-mono font-medium tabular",
                isPositive
                  ? "bg-positive-soft text-positive"
                  : "bg-negative-soft text-negative"
              )}
            >
              {isPositive ? "+" : ""}
              {formatPct(changePct)}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
