'use client'

import { Link } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface NewsItem {
  id: string
  category: 'Markets' | 'Economy' | 'Corporate' | 'Global'
  source: string
  time: string
  title: string
  symbols?: string[]
}

const MOCK_NEWS: NewsItem[] = [
  {
    id: 'news-1',
    category: 'Markets',
    source: 'FinEdge Feed',
    time: '20 mins ago',
    title: 'Nifty 50 breaks 22,800 barrier; IT and Energy stocks lead the momentum',
    symbols: ['RELIANCE', 'TCS', 'INFY']
  },
  {
    id: 'news-2',
    category: 'Corporate',
    source: 'NSE Filings',
    time: '1 hour ago',
    title: 'HDFC Bank announces interim board meeting to decide on annual final dividend payout',
    symbols: ['HDFCBANK']
  },
  {
    id: 'news-3',
    category: 'Economy',
    source: 'RBI Press',
    time: '3 hours ago',
    title: 'Reserve Bank of India maintains repo rate at 6.5%; projects GDP growth at 7.2% for FY26',
  },
  {
    id: 'news-4',
    category: 'Global',
    source: 'Reuters',
    time: '5 hours ago',
    title: 'US Federal Reserve hints at potential rate cuts later this year as inflation cools down',
  },
  {
    id: 'news-5',
    category: 'Markets',
    source: 'LiveMint',
    time: '6 hours ago',
    title: 'Midcap and Smallcap indices outpace largecap benchmarks; breadth remains highly positive',
    symbols: ['SBIN', 'ICICIBANK']
  }
]

const categoryStyles: Record<string, string> = {
  Markets: "bg-accentSoft text-accent border-blue-200",
  Economy: "bg-purple-50 text-purple-700 border-purple-200",
  Corporate: "bg-positive-soft/40 text-positive border-green-200",
  Global: "bg-surfaceMuted text-slate-700 border-border",
}

export function NewsFeed() {
  return (
    <Card className="border-border shadow-none overflow-hidden select-none">
      <CardHeader className="flex flex-row items-center justify-between gap-2 border-b border-border/50 bg-surfaceMuted/50 px-5 py-4">
        <CardTitle className="text-xs font-bold text-textPrimary uppercase tracking-wide">
          Market News
        </CardTitle>
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-[11px] font-bold text-accent hover:underline uppercase tracking-wide"
        >
          All updates <ArrowRight className="size-3" />
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border/50">
          {MOCK_NEWS.map((n) => (
            <li
              key={n.id}
              className="px-5 py-3.5 hover:bg-surfaceMuted transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                    categoryStyles[n.category] ?? ""
                  )}
                >
                  {n.category}
                </span>
                <span className="text-[10px] text-textMuted font-medium font-mono">
                  {n.source} · {n.time}
                </span>
              </div>
              <p className="mt-2 text-xs font-bold text-slate-850 leading-relaxed">
                {n.title}
              </p>
              {n.symbols && n.symbols.length > 0 ? (
                <div className="mt-2.5 flex flex-wrap gap-1">
                  {n.symbols.map((s) => (
                    <Link key={s} to={`/company/${s}`}>
                      <Badge variant="outline" className="font-mono text-[9px] font-bold bg-surfaceMuted border border-border text-textSecondary rounded-sm hover:bg-surfaceMuted">
                        {s}
                      </Badge>
                    </Link>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
export default NewsFeed
