/**
 * lib/data/market.ts
 * Market-wide data: indices, sector performance, gainers & losers
 */

export interface IndexData {
  name: string
  value: number
  change: number
  changePct: number
  high: number
  low: number
}

export interface SectorPerformance {
  sector: string
  change: number
  marketCap: number
  advancers: number
  decliners: number
}

export interface MarketMover {
  symbol: string
  name: string
  price: number
  change: number
  changePct: number
  volume: number
}

export interface MarketBreadth {
  advances: number
  declines: number
  unchanged: number
  total: number
  advanceDeclineRatio: number
  vix: number
  vixChangePct: number
  fiiNetCr: number
  diiNetCr: number
}

// ─── Market Indices ────────────────────────────────────────────────────────────
export const marketIndices: IndexData[] = [
  {
    name: 'NIFTY 50',
    value: 22845.75,
    change: 127.45,
    changePct: 0.56,
    high: 22912.00,
    low: 22718.40,
  },
  {
    name: 'SENSEX',
    value: 75241.90,
    change: 412.68,
    changePct: 0.55,
    high: 75480.50,
    low: 74912.30,
  },
  {
    name: 'BANK NIFTY',
    value: 48532.60,
    change: -89.25,
    changePct: -0.18,
    high: 48820.00,
    low: 48321.50,
  },
  {
    name: 'NIFTY IT',
    value: 35842.30,
    change: 234.12,
    changePct: 0.66,
    high: 36100.00,
    low: 35612.00,
  },
  {
    name: 'NIFTY MIDCAP 100',
    value: 51234.80,
    change: 312.45,
    changePct: 0.61,
    high: 51520.00,
    low: 50985.00,
  },
  {
    name: 'NIFTY SMALLCAP 100',
    value: 18456.20,
    change: 156.80,
    changePct: 0.86,
    high: 18542.50,
    low: 18312.60,
  },
  {
    name: 'NIFTY AUTO',
    value: 22134.60,
    change: 89.30,
    changePct: 0.40,
    high: 22245.00,
    low: 22034.20,
  },
  {
    name: 'NIFTY PHARMA',
    value: 19823.40,
    change: -42.15,
    changePct: -0.21,
    high: 19901.50,
    low: 19754.30,
  },
  {
    name: 'NIFTY FMCG',
    value: 53421.80,
    change: 234.60,
    changePct: 0.44,
    high: 53540.00,
    low: 53178.20,
  },
  {
    name: 'NIFTY METAL',
    value: 9234.50,
    change: -78.40,
    changePct: -0.84,
    high: 9345.60,
    low: 9198.30,
  },
  {
    name: 'INDIA VIX',
    value: 14.82,
    change: -0.34,
    changePct: -2.24,
    high: 15.24,
    low: 14.65,
  },
]

// ─── Sector Performance ───────────────────────────────────────────────────────
export const sectorPerformance: SectorPerformance[] = [
  {
    sector: 'Information Technology',
    change: 0.87,
    marketCap: 1842500,
    advancers: 38,
    decliners: 12,
  },
  {
    sector: 'Financial Services',
    change: 0.34,
    marketCap: 3245600,
    advancers: 145,
    decliners: 98,
  },
  {
    sector: 'Fast Moving Consumer Goods',
    change: 0.52,
    marketCap: 856400,
    advancers: 52,
    decliners: 28,
  },
  {
    sector: 'Healthcare',
    change: -0.21,
    marketCap: 623400,
    advancers: 89,
    decliners: 67,
  },
  {
    sector: 'Consumer Discretionary',
    change: 0.75,
    marketCap: 1023400,
    advancers: 134,
    decliners: 56,
  },
  {
    sector: 'Energy',
    change: 1.12,
    marketCap: 2156700,
    advancers: 34,
    decliners: 18,
  },
  {
    sector: 'Communication Services',
    change: 1.45,
    marketCap: 1234500,
    advancers: 18,
    decliners: 6,
  },
  {
    sector: 'Industrials',
    change: 0.68,
    marketCap: 923400,
    advancers: 212,
    decliners: 78,
  },
  {
    sector: 'Materials',
    change: -0.56,
    marketCap: 712300,
    advancers: 89,
    decliners: 145,
  },
  {
    sector: 'Utilities',
    change: 0.34,
    marketCap: 534200,
    advancers: 42,
    decliners: 28,
  },
  {
    sector: 'Real Estate',
    change: -0.87,
    marketCap: 345600,
    advancers: 56,
    decliners: 124,
  },
  {
    sector: 'Consumer Staples',
    change: 0.22,
    marketCap: 423400,
    advancers: 34,
    decliners: 22,
  },
]

// ─── Top Gainers ──────────────────────────────────────────────────────────────
export const gainers: MarketMover[] = [
  {
    symbol: 'ADANIPORTS',
    name: 'Adani Ports & SEZ Ltd',
    price: 1423.55,
    change: 78.45,
    changePct: 5.83,
    volume: 4523780,
  },
  {
    symbol: 'TATAMOTORS',
    name: 'Tata Motors Ltd',
    price: 934.20,
    change: 42.35,
    changePct: 4.75,
    volume: 12345670,
  },
  {
    symbol: 'JSWSTEEL',
    name: 'JSW Steel Ltd',
    price: 912.40,
    change: 38.65,
    changePct: 4.42,
    volume: 8234560,
  },
  {
    symbol: 'RELIANCE',
    name: 'Reliance Industries Ltd',
    price: 2934.75,
    change: 32.45,
    changePct: 1.12,
    volume: 8542310,
  },
  {
    symbol: 'BHARTIARTL',
    name: 'Bharti Airtel Ltd',
    price: 1634.80,
    change: 28.50,
    changePct: 1.77,
    volume: 5678920,
  },
  {
    symbol: 'BAJAJ-AUTO',
    name: 'Bajaj Auto Ltd',
    price: 9234.50,
    change: 234.50,
    changePct: 2.61,
    volume: 456780,
  },
  {
    symbol: 'HCLTECH',
    name: 'HCL Technologies Ltd',
    price: 1834.60,
    change: 42.30,
    changePct: 2.36,
    volume: 3456780,
  },
  {
    symbol: 'DRREDDY',
    name: 'Dr Reddy\'s Laboratories Ltd',
    price: 6234.80,
    change: 134.20,
    changePct: 2.20,
    volume: 789560,
  },
  {
    symbol: 'WIPRO',
    name: 'Wipro Ltd',
    price: 487.35,
    change: 6.80,
    changePct: 1.41,
    volume: 11234560,
  },
  {
    symbol: 'INFY',
    name: 'Infosys Ltd',
    price: 1584.30,
    change: 22.10,
    changePct: 1.41,
    volume: 7896540,
  },
]

// ─── Top Losers ───────────────────────────────────────────────────────────────
export const losers: MarketMover[] = [
  {
    symbol: 'TATASTEEL',
    name: 'Tata Steel Ltd',
    price: 168.45,
    change: -8.35,
    changePct: -4.72,
    volume: 34567890,
  },
  {
    symbol: 'HINDALCO',
    name: 'Hindalco Industries Ltd',
    price: 634.20,
    change: -28.40,
    changePct: -4.29,
    volume: 9876540,
  },
  {
    symbol: 'ASIANPAINT',
    name: 'Asian Paints Ltd',
    price: 2287.65,
    change: -34.20,
    changePct: -1.47,
    volume: 1456890,
  },
  {
    symbol: 'TITAN',
    name: 'Titan Company Ltd',
    price: 3456.70,
    change: -28.40,
    changePct: -0.81,
    volume: 1245670,
  },
  {
    symbol: 'ICICIBANK',
    name: 'ICICI Bank Ltd',
    price: 1248.60,
    change: -5.40,
    changePct: -0.43,
    volume: 15234890,
  },
  {
    symbol: 'KOTAKBANK',
    name: 'Kotak Mahindra Bank Ltd',
    price: 2134.60,
    change: -11.30,
    changePct: -0.53,
    volume: 4231560,
  },
  {
    symbol: 'SBIN',
    name: 'State Bank of India',
    price: 827.45,
    change: -4.25,
    changePct: -0.51,
    volume: 22456780,
  },
  {
    symbol: 'SUNPHARMA',
    name: 'Sun Pharmaceutical Industries',
    price: 1678.90,
    change: -12.30,
    changePct: -0.73,
    volume: 2134560,
  },
  {
    symbol: 'NESTLEIND',
    name: 'Nestle India Ltd',
    price: 2345.80,
    change: -18.40,
    changePct: -0.78,
    volume: 456780,
  },
  {
    symbol: 'ULTRACEMCO',
    name: 'UltraTech Cement Ltd',
    price: 10234.50,
    change: -87.30,
    changePct: -0.85,
    volume: 312560,
  },
]

// ─── Market Breadth ───────────────────────────────────────────────────────────
export const marketBreadth: MarketBreadth = {
  advances: 1423,
  declines: 896,
  unchanged: 134,
  total: 2453,
  advanceDeclineRatio: 1.59,
  vix: 14.82,
  vixChangePct: -2.24,
  fiiNetCr: 1245.80,
  diiNetCr: 876.40,
}

// ─── Most Active by Volume ─────────────────────────────────────────────────────
export const mostActiveByVolume: MarketMover[] = [
  {
    symbol: 'SBIN',
    name: 'State Bank of India',
    price: 827.45,
    change: -4.25,
    changePct: -0.51,
    volume: 22456780,
  },
  {
    symbol: 'ICICIBANK',
    name: 'ICICI Bank Ltd',
    price: 1248.60,
    change: -5.40,
    changePct: -0.43,
    volume: 15234890,
  },
  {
    symbol: 'TATASTEEL',
    name: 'Tata Steel Ltd',
    price: 168.45,
    change: -8.35,
    changePct: -4.72,
    volume: 34567890,
  },
  {
    symbol: 'WIPRO',
    name: 'Wipro Ltd',
    price: 487.35,
    change: 6.80,
    changePct: 1.41,
    volume: 11234560,
  },
  {
    symbol: 'INFY',
    name: 'Infosys Ltd',
    price: 1584.30,
    change: 22.10,
    changePct: 1.41,
    volume: 7896540,
  },
]
