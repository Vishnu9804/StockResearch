/**
 * lib/formatters.ts
 * Complete formatters for Indian financial data
 */

/**
 * Format a number with fixed decimal places
 */
export function formatNumber(value: number, decimals = 2): string {
  if (!isFinite(value)) return '—'
  return value.toFixed(decimals)
}

/**
 * Format number in Indian system (using lakh/crore separators)
 * e.g., 1234567 → "12,34,567"
 */
export function formatIndian(value: number): string {
  if (!isFinite(value)) return '—'
  const isNegative = value < 0
  const abs = Math.abs(value)
  const str = Math.round(abs).toString()

  if (str.length <= 3) {
    return isNegative ? `-${str}` : str
  }

  // Last 3 digits
  const last3 = str.slice(-3)
  // Remaining digits grouped in 2s
  const remaining = str.slice(0, -3)
  const groups: string[] = []
  for (let i = remaining.length; i > 0; i -= 2) {
    groups.unshift(remaining.slice(Math.max(0, i - 2), i))
  }

  const formatted = [...groups, last3].join(',')
  return isNegative ? `-${formatted}` : formatted
}

/**
 * Format value in crores with ₹ symbol
 * e.g., 12345.67 → "₹12,345.67 Cr"
 */
export function formatCrores(value: number): string {
  if (!isFinite(value)) return '—'
  const isNegative = value < 0
  const abs = Math.abs(value)
  const intPart = Math.floor(abs)
  const decPart = (abs - intPart).toFixed(2).slice(1) // ".XX"
  const formatted = formatIndian(intPart) + decPart
  return isNegative ? `-₹${formatted} Cr` : `₹${formatted} Cr`
}

/**
 * Format value in lakhs with ₹ symbol
 * e.g., 123456 crores → "₹1,23,456 L"
 */
export function formatLakhs(value: number): string {
  if (!isFinite(value)) return '—'
  const isNegative = value < 0
  const abs = Math.abs(value)
  const formatted = formatIndian(Math.round(abs))
  return isNegative ? `-₹${formatted} L` : `₹${formatted} L`
}

/**
 * Format percentage with sign
 * e.g., 12.3456 → "+12.35%" or -5.6 → "-5.60%"
 */
export function formatPct(value: number, decimals = 2): string {
  if (!isFinite(value)) return '—'
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)}%`
}

/**
 * Format a numeric change value with sign
 * e.g., 123.45 → "+123.45" or -45.67 → "-45.67"
 */
export function formatChange(value: number): string {
  if (!isFinite(value)) return '—'
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}`
}

/**
 * Returns Tailwind class for positive/negative value
 * positive → "text-positive", negative → "text-negative", zero → "text-textSecondary"
 */
export function changeClass(value: number): string {
  if (value > 0) return 'text-positive'
  if (value < 0) return 'text-negative'
  return 'text-textSecondary'
}

/**
 * Returns Tailwind class based on whether high value is good (e.g. ROE)
 * or whether low value is good (e.g. Debt ratio)
 */
export function positiveClass(value: number): string {
  return value >= 0 ? 'text-positive' : 'text-negative'
}

/**
 * Format market cap intelligently
 * < 1,00,000 Cr → "₹XX,XXX Cr"
 * >= 1,00,000 Cr → "₹X.XXL Cr" (lakh crores)
 */
export function formatMarketCap(crores: number): string {
  if (!isFinite(crores)) return '—'
  if (crores >= 100000) {
    // Lakh crores
    const lakhCr = crores / 100000
    return `₹${lakhCr.toFixed(2)}L Cr`
  }
  if (crores >= 1000) {
    const intPart = Math.floor(crores)
    return `₹${formatIndian(intPart)} Cr`
  }
  return `₹${crores.toFixed(2)} Cr`
}

/**
 * Format ISO date string to Indian readable date
 * e.g., "2025-05-25" → "25 May 2025"
 */
export function formatDate(date: string): string {
  if (!date) return '—'
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ]
  const d = new Date(date)
  if (isNaN(d.getTime())) return '—'
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
}

/**
 * Format a date string as relative time
 * e.g., "2 hours ago", "3 days ago", "just now"
 */
export function formatRelativeTime(date: string): string {
  if (!date) return '—'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '—'
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)
  const diffWeeks = Math.floor(diffDays / 7)
  const diffMonths = Math.floor(diffDays / 30)
  const diffYears = Math.floor(diffDays / 365)

  if (diffSeconds < 60) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
  if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks === 1 ? '' : 's'} ago`
  if (diffMonths < 12) return `${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`
  return `${diffYears} year${diffYears === 1 ? '' : 's'} ago`
}

/**
 * Format volume number compactly
 * e.g., 12500000 → "12.5M", 1200000000 → "1.2B", 125000 → "1.25L"
 */
export function formatVolume(volume: number): string {
  if (!isFinite(volume)) return '—'
  const abs = Math.abs(volume)
  if (abs >= 1_000_000_000) {
    return `${(volume / 1_000_000_000).toFixed(2)}B`
  }
  if (abs >= 1_000_000) {
    return `${(volume / 1_000_000).toFixed(2)}M`
  }
  if (abs >= 100_000) {
    // Indian lakh
    return `${(volume / 100_000).toFixed(2)}L`
  }
  if (abs >= 1_000) {
    return `${(volume / 1_000).toFixed(2)}K`
  }
  return volume.toString()
}
