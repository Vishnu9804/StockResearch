import { useAppSelector } from '@/store/hooks'
import { companies } from '@/lib/data/companies'

export function useCompanyNameResolver() {
  const symbols = useAppSelector((state) => (state as any).search?.symbols ?? [])

  return (symbol?: string) => {
    if (!symbol) return ''
    const cleanSym = symbol.trim().toUpperCase()
    // 1. Try to find in dynamic search symbols cache
    const match = symbols.find((s: any) => s.symbol === cleanSym)
    if (match && match.name) return match.name
    // 2. Try static fallback companies
    const staticMatch = companies.find((c) => c.symbol === cleanSym)
    if (staticMatch && staticMatch.name) return staticMatch.name
    return symbol // fallback to symbol
  }
}

export default useCompanyNameResolver
