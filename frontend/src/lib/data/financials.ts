/**
 * lib/data/financials.ts
 * Financial statement data for Reliance Industries (representative large-cap data)
 * All figures in ₹ Crores unless otherwise noted
 */

export interface FinancialRow {
  label: string
  values: (number | null)[]
  highlight?: boolean
  indent?: boolean
  expandable?: boolean
  children?: FinancialRow[]
  isPercent?: boolean
  isPositiveGood?: boolean
  isCurrency?: boolean
  unit?: string
}

export interface ShareholdingQuarter {
  quarter: string
  promoter: number
  fii: number
  dii: number
  public: number
  others: number
}

export interface PricePoint {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

// ─── Fiscal Years (Mar'14 to TTM) ───────────────────────────────────────────
export const fiscalYears: string[] = [
  "Mar'14", "Mar'15", "Mar'16", "Mar'17", "Mar'18",
  "Mar'19", "Mar'20", "Mar'21", "Mar'22", "Mar'23",
  "Mar'24", "Mar'25", "TTM",
]

// ─── Quarters ────────────────────────────────────────────────────────────────
export const quarters: string[] = [
  "Jun'22", "Sep'22", "Dec'22", "Mar'23",
  "Jun'23", "Sep'23", "Dec'23", "Mar'24",
  "Jun'24", "Sep'24", "Dec'24", "Mar'25",
]

// ─── Profit & Loss (Annual, Crores) ─────────────────────────────────────────
// Reliance Industries realistic figures
export const profitLoss: FinancialRow[] = [
  {
    label: 'Revenue from Operations',
    values: [430731, 388856, 296895, 302006, 408265, 622809, 611645, 539238, 792756, 867975, 902384, 975240, 988200],
    highlight: true,
    isCurrency: true,
  },
  {
    label: 'Total Expenses',
    values: [381264, 343821, 261234, 268412, 362874, 565473, 558239, 481248, 716834, 784256, 816234, 882340, 894120],
    highlight: true,
    isCurrency: true,
    expandable: true,
    children: [
      {
        label: 'Material Cost',
        values: [318421, 286342, 210234, 219875, 301234, 487234, 476234, 396234, 618234, 672343, 698234, 753240, 763400],
        indent: true,
        isCurrency: true,
      },
      {
        label: 'Employee Cost',
        values: [12421, 13842, 14234, 15234, 18234, 22234, 26234, 29234, 32234, 38234, 44234, 49100, 50420],
        indent: true,
        isCurrency: true,
      },
      {
        label: 'Other Expenses',
        values: [50422, 43637, 36766, 33303, 43406, 56005, 55771, 55780, 66366, 73679, 73766, 80000, 80300],
        indent: true,
        isCurrency: true,
      },
    ],
  },
  {
    label: 'EBITDA',
    values: [49467, 45035, 35661, 33594, 45391, 57336, 53406, 57990, 75922, 83719, 86150, 92900, 94080],
    highlight: true,
    isCurrency: true,
    isPositiveGood: true,
  },
  {
    label: 'EBITDA Margin %',
    values: [11.5, 11.6, 12.0, 11.1, 11.1, 9.2, 8.7, 10.8, 9.6, 9.6, 9.5, 9.5, 9.5],
    isPercent: true,
    isPositiveGood: true,
  },
  {
    label: 'Depreciation & Amortisation',
    values: [7812, 8534, 9124, 9634, 10234, 12234, 15234, 18234, 22234, 26234, 30234, 33800, 34500],
    isCurrency: true,
  },
  {
    label: 'EBIT',
    values: [41655, 36501, 26537, 23960, 35157, 45102, 38172, 39756, 53688, 57485, 55916, 59100, 59580],
    highlight: true,
    isCurrency: true,
    isPositiveGood: true,
  },
  {
    label: 'Finance Cost (Interest)',
    values: [4234, 5123, 6234, 7234, 8234, 13234, 18234, 18234, 16234, 15234, 14234, 12800, 12400],
    isCurrency: true,
  },
  {
    label: 'Other Income',
    values: [2134, 2534, 2834, 3234, 4234, 5234, 6234, 7234, 8234, 9234, 10234, 11200, 11600],
    isCurrency: true,
  },
  {
    label: 'Profit Before Tax (PBT)',
    values: [39555, 33912, 23137, 19960, 31157, 37102, 26172, 28756, 45688, 51485, 51916, 57500, 58780],
    highlight: true,
    isCurrency: true,
    isPositiveGood: true,
  },
  {
    label: 'Tax',
    values: [7534, 6123, 3234, 3234, 4234, 6234, 4234, 7234, 8234, 12234, 13234, 14800, 15200],
    isCurrency: true,
  },
  {
    label: 'Net Profit',
    values: [22719, 22719, 29904, 29901, 36080, 39537, 30903, 49128, 60705, 73670, 79020, 85420, 87900],
    highlight: true,
    isCurrency: true,
    isPositiveGood: true,
  },
  {
    label: 'EPS (₹)',
    values: [14.8, 14.8, 19.5, 19.4, 23.5, 25.7, 20.1, 31.9, 39.5, 47.9, 51.4, 55.6, 57.2],
    isPositiveGood: true,
    unit: '₹',
  },
  {
    label: 'Dividend Payout %',
    values: [12.2, 12.2, 13.5, 13.5, 14.5, 11.6, 15.0, 8.5, 8.5, 8.5, 8.5, 8.5, 8.5],
    isPercent: true,
  },
]

// ─── Quarterly Results ───────────────────────────────────────────────────────
export const quarterlyResults: FinancialRow[] = [
  {
    label: 'Sales',
    values: [199438, 208878, 207526, 251933, 211050, 227052, 240513, 242643, 237500, 243122, 252341, 242277],
    highlight: true,
    isCurrency: true,
  },
  {
    label: 'Total Expenses',
    values: [177821, 186234, 184234, 218234, 188234, 202234, 214234, 216234, 212234, 218234, 226234, 219234],
    highlight: true,
    isCurrency: true,
    expandable: true,
    children: [
      {
        label: 'Material Cost',
        values: [152234, 159234, 157234, 186234, 160234, 172234, 182234, 183234, 180234, 185234, 192234, 185234],
        indent: true,
        isCurrency: true,
      },
      {
        label: 'Employee Cost',
        values: [9234, 10234, 10234, 11234, 11234, 12234, 13234, 13234, 12234, 12234, 13234, 12234],
        indent: true,
        isCurrency: true,
      },
      {
        label: 'Other Expenses',
        values: [16353, 16766, 16766, 20766, 16766, 17766, 18766, 19766, 19766, 20766, 20766, 21766],
        indent: true,
        isCurrency: true,
      },
    ],
  },
  {
    label: 'Operating Profit',
    values: [21617, 22644, 23292, 33699, 22816, 24818, 26279, 26409, 25266, 24888, 26107, 23043],
    highlight: true,
    isCurrency: true,
    isPositiveGood: true,
  },
  {
    label: 'OPM %',
    values: [10.8, 10.8, 11.2, 13.4, 10.8, 10.9, 10.9, 10.9, 10.6, 10.2, 10.3, 9.5],
    isPercent: true,
    isPositiveGood: true,
  },
  {
    label: 'Other Income',
    values: [2345, 2567, 2789, 3012, 2500, 2750, 2900, 3100, 2800, 2900, 3050, 3200],
    isCurrency: true,
    expandable: true,
    children: [
      {
        label: 'Interest Income',
        values: [1234, 1345, 1456, 1567, 1300, 1400, 1500, 1600, 1450, 1520, 1600, 1680],
        indent: true,
        isCurrency: true,
      },
      {
        label: 'Dividend Income',
        values: [1111, 1222, 1333, 1445, 1200, 1350, 1400, 1500, 1350, 1380, 1450, 1520],
        indent: true,
        isCurrency: true,
      },
    ],
  },
  {
    label: 'Interest',
    values: [3784, 3856, 3789, 3805, 3256, 3345, 3256, 3377, 3100, 3050, 3150, 3100],
    isCurrency: true,
  },
  {
    label: 'Depreciation',
    values: [6234, 6534, 6834, 6632, 7234, 7534, 7834, 7632, 8100, 8234, 8500, 8966],
    isCurrency: true,
  },
  {
    label: 'Profit Before Tax',
    values: [13944, 14821, 15458, 26274, 14826, 16689, 18089, 18500, 16866, 16504, 17507, 14177],
    highlight: true,
    isCurrency: true,
    isPositiveGood: true,
  },
  {
    label: 'Tax %',
    values: [24.5, 24.8, 25.2, 24.0, 24.5, 24.8, 25.0, 24.5, 24.8, 25.0, 25.0, 25.0],
    isPercent: true,
  },
  {
    label: 'Net Profit',
    values: [15792, 15512, 17806, 19299, 16011, 17394, 19641, 21243, 21537, 19323, 21804, 22945],
    highlight: true,
    isCurrency: true,
    isPositiveGood: true,
  },
  {
    label: 'EPS (₹)',
    values: [10.28, 10.09, 11.59, 12.56, 10.42, 11.32, 12.78, 13.82, 14.01, 12.57, 14.19, 14.92],
    isPositiveGood: true,
    unit: '₹',
  },
]

// ─── Balance Sheet ────────────────────────────────────────────────────────────
export const balanceSheet: FinancialRow[] = [
  {
    label: 'Equity Capital',
    values: [6339, 6339, 6434, 6338, 6338, 6339, 6445, 6763, 6763, 6766, 6766, 6768, 6770],
    highlight: false,
    isCurrency: true,
  },
  {
    label: 'Reserves & Surplus',
    values: [182234, 198234, 215234, 242234, 278234, 314234, 353234, 502234, 620234, 705234, 774234, 847240, 915420],
    isCurrency: true,
  },
  {
    label: 'Total Equity (Net Worth)',
    values: [188573, 204573, 221668, 248572, 284572, 320573, 359679, 508997, 626997, 712000, 781000, 854008, 922190],
    highlight: true,
    isCurrency: true,
    isPositiveGood: true,
  },
  {
    label: 'Total Borrowings',
    values: [91234, 115234, 148234, 162234, 205234, 278234, 312234, 248234, 225234, 212234, 198234, 185240, 172300],
    highlight: false,
    isCurrency: true,
    expandable: true,
    children: [
      {
        label: 'Long Term Borrowings',
        values: [72234, 92234, 119234, 128234, 163234, 218234, 252234, 196234, 175234, 162234, 149234, 138240, 126300],
        indent: true,
        isCurrency: true,
      },
      {
        label: 'Short Term Borrowings',
        values: [12000, 16000, 22000, 27000, 35000, 49000, 48000, 39000, 36000, 34000, 33000, 31000, 30000],
        indent: true,
        isCurrency: true,
      },
      {
        label: 'Lease Liabilities',
        values: [7000, 7000, 7000, 7000, 7000, 11000, 12000, 13000, 14000, 16000, 16000, 16000, 16000],
        indent: true,
        isCurrency: true,
      },
    ],
  },
  {
    label: 'Other Liabilities',
    values: [45234, 51234, 56234, 62234, 74234, 88234, 94234, 98234, 112234, 122234, 134234, 148000, 156000],
    isCurrency: true,
  },
  {
    label: 'Total Liabilities',
    values: [325041, 371041, 426136, 473040, 564040, 687041, 766147, 855465, 964465, 1046468, 1113468, 1187248, 1250490],
    highlight: true,
    isCurrency: true,
  },
  {
    label: 'Fixed Assets (Net Block)',
    values: [112234, 136234, 162234, 189234, 231234, 296234, 352234, 358234, 372234, 384234, 395234, 408240, 420300],
    highlight: false,
    isCurrency: true,
  },
  {
    label: 'Capital Work in Progress',
    values: [45234, 52234, 62234, 78234, 98234, 108234, 94234, 72234, 62234, 52234, 46234, 42240, 38300],
    isCurrency: true,
  },
  {
    label: 'Investments',
    values: [62234, 78234, 96234, 104234, 128234, 154234, 168234, 232234, 296234, 342234, 382234, 418240, 455300],
    isCurrency: true,
    isPositiveGood: true,
  },
  {
    label: 'Other Assets',
    values: [105339, 104339, 105434, 101338, 106338, 128339, 151479, 192797, 233797, 267800, 289800, 318528, 336590],
    isCurrency: true,
    expandable: true,
    children: [
      {
        label: 'Inventories',
        values: [42234, 41234, 40234, 38234, 44234, 56234, 52234, 48234, 62234, 64234, 68234, 72240, 75300],
        indent: true,
        isCurrency: true,
      },
      {
        label: 'Trade Receivables',
        values: [18234, 17234, 16234, 15234, 18234, 22234, 26234, 28234, 32234, 36234, 38234, 42240, 44300],
        indent: true,
        isCurrency: true,
      },
      {
        label: 'Cash & Equivalents',
        values: [24234, 27234, 31234, 29234, 26234, 32234, 42234, 82234, 98234, 112234, 132234, 148240, 160300],
        indent: true,
        isCurrency: true,
        isPositiveGood: true,
      },
      {
        label: 'Short-term Loans & Advances',
        values: [20637, 18637, 17732, 18636, 17636, 17637, 30777, 34129, 41129, 55098, 51098, 55808, 56690],
        indent: true,
        isCurrency: true,
      },
    ],
  },
  {
    label: 'Total Assets',
    values: [325041, 371041, 426136, 473040, 564040, 687041, 766181, 855499, 964499, 1046502, 1113502, 1187248, 1250490],
    highlight: true,
    isCurrency: true,
  },
]

// ─── Cash Flow Statement ──────────────────────────────────────────────────────
export const cashFlow: FinancialRow[] = [
  {
    label: 'Cash from Operations',
    values: [38234, 42234, 36234, 34234, 44234, 62234, 68234, 78234, 92234, 106234, 118234, 132240, 140300],
    highlight: true,
    isCurrency: true,
    isPositiveGood: true,
  },
  {
    label: 'Cash from Investing',
    values: [-42234, -58234, -68234, -78234, -92234, -112234, -82234, -32234, -62234, -72234, -82234, -88240, -92300],
    highlight: true,
    isCurrency: true,
    expandable: true,
    children: [
      {
        label: 'Capital Expenditure',
        values: [-28234, -38234, -48234, -58234, -72234, -92234, -62234, -28234, -42234, -48234, -52234, -56240, -58300],
        indent: true,
        isCurrency: true,
      },
      {
        label: 'Investments (Net)',
        values: [-10000, -16000, -18000, -18000, -18000, -18000, -18000, 0, -18000, -22000, -28000, -30000, -32000],
        indent: true,
        isCurrency: true,
      },
      {
        label: 'Other Investing',
        values: [-4000, -4000, -2000, -2000, -2000, -2000, -2000, -4000, -2000, -2000, -2000, -2000, -2000],
        indent: true,
        isCurrency: true,
      },
    ],
  },
  {
    label: 'Cash from Financing',
    values: [8234, 18234, 34234, 42234, 46234, 52234, 10234, -44234, -24234, -32234, -36234, -44240, -48300],
    highlight: true,
    isCurrency: true,
    expandable: true,
    children: [
      {
        label: 'Debt Raised / (Repaid)',
        values: [12234, 22234, 38234, 46234, 52234, 62234, 16234, -44234, -20234, -24234, -18234, -12240, -14300],
        indent: true,
        isCurrency: true,
      },
      {
        label: 'Dividends Paid',
        values: [-2000, -2000, -3000, -3000, -5000, -8000, -5000, -4000, -5000, -7000, -8000, -10000, -10000],
        indent: true,
        isCurrency: true,
      },
      {
        label: 'Other Financing',
        values: [-2000, -2000, -1000, -1000, -1000, -2000, -1000, 4000, 1000, -1000, -10000, -22000, -24000],
        indent: true,
        isCurrency: true,
      },
    ],
  },
  {
    label: 'Net Cash Flow',
    values: [4234, 2234, 2234, -1766, -1766, 2234, -3766, 1766, 5766, 1766, -234, -240, -300],
    highlight: true,
    isCurrency: true,
    isPositiveGood: true,
  },
]

// ─── Financial Ratios ─────────────────────────────────────────────────────────
export const ratios: FinancialRow[] = [
  {
    label: 'Debtor Days',
    values: [15, 16, 20, 18, 16, 13, 16, 19, 15, 15, 15, 16, 16],
    isPositiveGood: false,
    unit: 'days',
  },
  {
    label: 'Inventory Days',
    values: [36, 37, 42, 40, 36, 30, 33, 37, 34, 27, 28, 27, 28],
    isPositiveGood: false,
    unit: 'days',
  },
  {
    label: 'Days Payable Outstanding',
    values: [22, 24, 28, 26, 22, 18, 20, 24, 21, 18, 18, 18, 18],
    isPositiveGood: true,
    unit: 'days',
  },
  {
    label: 'Cash Conversion Cycle',
    values: [29, 29, 34, 32, 30, 25, 29, 32, 28, 24, 25, 25, 26],
    isPositiveGood: false,
    unit: 'days',
  },
  {
    label: 'Working Capital Days',
    values: [22, 18, 24, 20, 18, 12, 10, 14, 12, 10, 10, 10, 11],
    isPositiveGood: false,
    unit: 'days',
  },
  {
    label: 'Return on Capital Employed %',
    values: [9.8, 9.1, 8.2, 8.4, 8.6, 9.2, 7.8, 8.2, 10.2, 11.4, 10.5, 10.6, 10.7],
    isPercent: true,
    isPositiveGood: true,
  },
  {
    label: 'Return on Equity %',
    values: [12.0, 11.1, 13.5, 12.0, 12.7, 12.3, 8.6, 9.7, 9.7, 10.4, 10.1, 10.0, 9.9],
    isPercent: true,
    isPositiveGood: true,
  },
  {
    label: 'Net Profit Margin %',
    values: [5.3, 5.8, 10.1, 9.9, 8.8, 6.3, 5.1, 9.1, 7.7, 8.5, 8.8, 8.8, 8.9],
    isPercent: true,
    isPositiveGood: true,
  },
]

// ─── Shareholding Pattern ─────────────────────────────────────────────────────
export const shareholding: ShareholdingQuarter[] = [
  { quarter: "Jun'22",  promoter: 50.49, fii: 24.26, dii: 14.82, public: 10.43, others: 0.00 },
  { quarter: "Sep'22",  promoter: 50.49, fii: 22.68, dii: 15.84, public: 10.99, others: 0.00 },
  { quarter: "Dec'22",  promoter: 50.49, fii: 22.50, dii: 16.00, public: 11.01, others: 0.00 },
  { quarter: "Mar'23",  promoter: 50.30, fii: 22.41, dii: 16.46, public: 10.83, others: 0.00 },
  { quarter: "Jun'23",  promoter: 50.30, fii: 22.30, dii: 16.58, public: 10.82, others: 0.00 },
  { quarter: "Sep'23",  promoter: 50.30, fii: 22.18, dii: 16.72, public: 10.80, others: 0.00 },
  { quarter: "Dec'23",  promoter: 50.33, fii: 22.24, dii: 16.56, public: 10.87, others: 0.00 },
  { quarter: "Mar'24",  promoter: 50.33, fii: 22.54, dii: 16.30, public: 10.83, others: 0.00 },
  { quarter: "Jun'24",  promoter: 50.33, fii: 22.62, dii: 16.14, public: 10.91, others: 0.00 },
  { quarter: "Sep'24",  promoter: 50.33, fii: 22.78, dii: 16.04, public: 10.85, others: 0.00 },
  { quarter: "Dec'24",  promoter: 50.33, fii: 22.82, dii: 16.00, public: 10.85, others: 0.00 },
  { quarter: "Mar'25",  promoter: 50.33, fii: 22.78, dii: 16.04, public: 10.85, others: 0.00 },
]

// ─── Price Series Generator ──────────────────────────────────────────────────
/**
 * Generate a synthetic price series for a given stock symbol.
 * Uses a seeded walk so output is deterministic per symbol.
 */
export function priceSeriesFor(symbol: string, basePrice: number): PricePoint[] {
  // Simple deterministic hash for symbol
  let seed = Array.from(symbol).reduce((acc, ch) => acc + ch.charCodeAt(0), 0)

  function rand(): number {
    // Park-Miller LCG
    seed = (seed * 16807 + 0) % 2147483647
    return (seed - 1) / 2147483646
  }

  const points: PricePoint[] = []
  let price = basePrice
  const today = new Date()

  // Generate 1500 calendar days backward (~1000 trading days)
  for (let i = 0; i < 1500; i++) {
    const date = new Date(today)
    date.setDate(today.getDate() - i)
    // Skip weekends
    if (date.getDay() === 0 || date.getDay() === 6) continue

    const dailyChange = (rand() - 0.49) * price * 0.015
    const open = price - (rand() - 0.5) * price * 0.003
    const close = price
    const high = Math.max(open, close) + rand() * price * 0.005
    const low = Math.min(open, close) - rand() * price * 0.005
    const volume = Math.round(1_000_000 + rand() * 9_000_000)

    points.push({
      date: date.toISOString().split('T')[0],
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume,
    })

    price = Math.max(1, price - dailyChange)
  }

  return points.reverse()
}
