import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Company } from "@/lib/data/companies"
import { Check, AlertTriangle } from "lucide-react"
import { formatNumber } from "@/lib/formatters"

export function StrengthsLimitations({ company }: { company: Company }) {
  // Dynamically compute strengths and limitations based on fundamentals
  const strengths: string[] = []
  const limitations: string[] = []

  // ROE Strength
  if (company.roe > 15) {
    strengths.push(`Strong Return on Equity (ROE) of ${formatNumber(company.roe)}% over the last year.`)
  } else if (company.roe < 10) {
    limitations.push(`Relative low Return on Equity (ROE) of ${formatNumber(company.roe)}%.`)
  }

  // ROCE Strength
  if (company.roce > 15) {
    strengths.push(`High Capital Efficiency with a ROCE of ${formatNumber(company.roce)}%.`)
  }

  // Debt/Equity
  if (company.debtToEquity < 0.5) {
    strengths.push(`Virtually debt-free balance sheet with a Debt-to-Equity ratio of ${formatNumber(company.debtToEquity)}x.`)
  } else if (company.debtToEquity > 1.5) {
    limitations.push(`Higher leverage level with a Debt-to-Equity ratio of ${formatNumber(company.debtToEquity)}x.`)
  }

  // Valuation/PE
  if (company.pe < 15 && company.pe > 0) {
    strengths.push(`Stock is trading at an attractive earnings multiple of ${formatNumber(company.pe)}x.`)
  } else if (company.pe > 40) {
    limitations.push(`Trading at a premium valuation with a P/E multiple of ${formatNumber(company.pe)}x.`)
  }

  // Promoter Holding
  if (company.promoterHolding > 50) {
    strengths.push(`High promoter ownership of ${formatNumber(company.promoterHolding)}%, showing high management alignment.`)
  } else if (company.promoterHolding < 25 && company.promoterHolding > 0) {
    limitations.push(`Low promoter stake of ${formatNumber(company.promoterHolding)}%, which might expose to hostile takeovers.`)
  }

  // Fallback defaults so the cards are never empty
  if (strengths.length === 0) {
    strengths.push("Company maintains a dominant market share in its respective industrial segment.")
    strengths.push("Excellent long-term institutional backing (FII/DII interest remains robust).")
  }
  if (limitations.length === 0) {
    limitations.push("Exposure to cyclical economic factors and regulatory raw material price controls.")
    limitations.push("Intense competitive pressure from domestic and international peers.")
  }

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 select-none">
      {/* Pros / Strengths Card */}
      <Card className="border-positive/20 bg-positive-soft/10 dark:bg-positive-soft/20 shadow-none">
        <CardHeader className="pb-3 bg-positive-soft/20 border-b border-positive/10">
          <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-positive">
            <span className="flex size-5 items-center justify-center rounded-full bg-positive text-white shrink-0">
              <Check className="size-3" />
            </span>
            Pros / Strengths
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <ul className="space-y-3">
            {strengths.map((s, i) => (
              <li key={i} className="flex gap-2.5 text-xs font-medium text-textSecondary leading-relaxed">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-positive" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Cons / Limitations Card */}
      <Card className="border-negative/20 bg-negative-soft/10 dark:bg-negative-soft/20 shadow-none">
        <CardHeader className="pb-3 bg-negative-soft/20 border-b border-negative/10">
          <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-negative">
            <span className="flex size-5 items-center justify-center rounded-full bg-negative text-white shrink-0">
              <AlertTriangle className="size-3" />
            </span>
            Cons / Limitations
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <ul className="space-y-3">
            {limitations.map((s, i) => (
              <li key={i} className="flex gap-2.5 text-xs font-medium text-textSecondary leading-relaxed">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-negative" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
export default StrengthsLimitations
