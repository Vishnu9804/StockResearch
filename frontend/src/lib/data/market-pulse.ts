/**
 * lib/data/market-pulse.ts
 * Static mock data for all Market Pulse sub-pages in FinScreen.
 * No backend required — all data is illustrative / demo-quality.
 */

// ─── Announcements ────────────────────────────────────────────────────────────
export interface Announcement {
  id: string
  company: string
  symbol: string
  date: string
  category: 'Board Meeting' | 'Concall' | 'Annual Report' | 'Dividend' | 'Merger' | 'Capacity' | 'Resignation' | 'Award' | 'Results' | 'Other'
  title: string
  summary: string
}

export const announcements: Announcement[] = [
  { id: 'a1', company: 'Reliance Industries', symbol: 'RELIANCE', date: '2026-06-17', category: 'Board Meeting', title: 'Board Meeting to Consider Q1 FY27 Results', summary: 'Board meeting scheduled for July 18, 2026 to approve Q1 FY27 standalone and consolidated financial results.' },
  { id: 'a2', company: 'Infosys', symbol: 'INFY', date: '2026-06-17', category: 'Results', title: 'Q4 FY26 PAT up 11.8% YoY at ₹7,969 Cr', summary: 'Infosys reported Q4 FY26 net profit of ₹7,969 crore, up 11.8% year-on-year. Revenue grew 8.9% in constant currency.' },
  { id: 'a3', company: 'HDFC Bank', symbol: 'HDFCBANK', date: '2026-06-16', category: 'Dividend', title: 'Final Dividend of ₹22 Per Share Declared', summary: 'HDFC Bank declared a final dividend of ₹22 per equity share for FY26. Record date set for July 5, 2026.' },
  { id: 'a4', company: 'TCS', symbol: 'TCS', date: '2026-06-16', category: 'Concall', title: 'Q4 FY26 Earnings Call Transcript Available', summary: 'Transcript of TCS Q4 FY26 earnings call now available. Management guided for deal momentum to sustain through FY27.' },
  { id: 'a5', company: 'Bajaj Finance', symbol: 'BAJFINANCE', date: '2026-06-15', category: 'Capacity', title: 'New NBFC Branch Expansion: 200 Cities by FY27', summary: 'Bajaj Finance plans to expand its branch network by 200 cities, targeting tier-2 and tier-3 markets by end of FY27.' },
  { id: 'a6', company: 'Wipro', symbol: 'WIPRO', date: '2026-06-15', category: 'Resignation', title: 'CFO Resignation: Transition Plan Announced', summary: 'Wipro CFO Apala Acharyya to step down effective August 31, 2026. Succession planning underway with internal candidates.' },
  { id: 'a7', company: 'Maruti Suzuki', symbol: 'MARUTI', date: '2026-06-14', category: 'Capacity', title: 'New 4-Lakh Unit Plant in Rajasthan Operationalized', summary: 'Maruti Suzuki\'s Kharkhoda plant in Haryana begins trial production for new mid-size SUV platform, capacity 4 lakh units/year.' },
  { id: 'a8', company: 'Sun Pharma', symbol: 'SUNPHARMA', date: '2026-06-14', category: 'Award', title: 'USFDA Approval for Dermatology Drug NDA', summary: 'Sun Pharma receives USFDA approval for Winlevi (clascoterone) cream for a new indication. Launch expected in Q2 FY27.' },
  { id: 'a9', company: 'Adani Ports', symbol: 'ADANIPORTS', date: '2026-06-13', category: 'Merger', title: 'Merger of Adani Logistics with Adani Ports', summary: 'Board approves scheme of arrangement to merge wholly-owned subsidiary Adani Logistics with Adani Ports in all-stock deal.' },
  { id: 'a10', company: 'L&T', symbol: 'LT', date: '2026-06-13', category: 'Award', title: 'Wins ₹9,800 Cr Power Transmission Order', summary: 'L&T Constructions wins a significant order worth ₹9,800 crore for transmission line and substation works in UP and Rajasthan.' },
  { id: 'a11', company: 'ITC', symbol: 'ITC', date: '2026-06-12', category: 'Board Meeting', title: 'Board Approves Demerger of Hotels Business', summary: 'ITC Board approves demerger of its hotels business into a separate listed entity, effective January 2027, subject to NCLT approval.' },
  { id: 'a12', company: 'NTPC', symbol: 'NTPC', date: '2026-06-12', category: 'Capacity', title: '6 GW Solar Capacity Addition by FY27', summary: 'NTPC Green Energy commissions 1,200 MW solar projects in Rajasthan, taking total renewable capacity to 4.8 GW.' },
  { id: 'a13', company: 'Kotak Mahindra Bank', symbol: 'KOTAKBANK', date: '2026-06-11', category: 'Annual Report', title: 'Annual Report FY26 Published', summary: 'Kotak Mahindra Bank releases its FY26 Annual Report highlighting 18% PAT growth, NIM of 5.1%, and GNPA below 1.5%.' },
  { id: 'a14', company: 'Britannia Industries', symbol: 'BRITANNIA', date: '2026-06-11', category: 'Results', title: 'Q4 FY26 Volume Growth of 7% YoY', summary: 'Britannia Industries posts Q4 FY26 revenue of ₹4,200 crore with 7% volume growth. EBITDA margin at 17.4%.' },
  { id: 'a15', company: 'Power Grid Corp', symbol: 'POWERGRID', date: '2026-06-10', category: 'Dividend', title: 'Interim Dividend ₹7.50 Declared for FY27', summary: 'Power Grid Corporation declares interim dividend of ₹7.50 per share for FY27. Payment date: July 15, 2026.' },
  { id: 'a16', company: 'Asian Paints', symbol: 'ASIANPAINT', date: '2026-06-10', category: 'Other', title: 'Launches Premium Waterproofing Product Range', summary: 'Asian Paints launches SmartCare Damp Proof Premium in 12 cities, targeting the ₹2,000 crore waterproofing market.' },
  { id: 'a17', company: 'HCL Technologies', symbol: 'HCLTECH', date: '2026-06-09', category: 'Award', title: '$500M 7-Year Deal Win from US Retailer', summary: 'HCL Tech wins a $500 million, 7-year IT infrastructure modernization and cloud migration deal from a major US retail chain.' },
  { id: 'a18', company: 'Titan Company', symbol: 'TITAN', date: '2026-06-09', category: 'Capacity', title: 'Tanishq Opens 50th Standalone Showroom', summary: 'Titan\'s Tanishq division expands with its 50th standalone showroom in Tier-2 cities under Project UDAAN initiative.' },
  { id: 'a19', company: 'Ultratech Cement', symbol: 'ULTRACEMCO', date: '2026-06-08', category: 'Capacity', title: '12 MTPA India Cements Integration Complete', summary: 'Ultratech completes integration of India Cements 12 MTPA capacity, taking total installed capacity to 165 MTPA.' },
  { id: 'a20', company: 'Nestle India', symbol: 'NESTLEIND', date: '2026-06-08', category: 'Results', title: 'Q4 FY26 Revenue ₹4,850 Cr; Maggi Leads', summary: 'Nestle India Q4 FY26 revenue at ₹4,850 crore, +9.4% YoY. Maggi contributes 33% of revenue with rural penetration gains.' },
]

// ─── Industries Overview ───────────────────────────────────────────────────────
export interface Industry {
  name: string
  stocks: number
  marketCapCr: number
  peRatio: number
  pbRatio: number
  roePercent: number
  rocePct: number
  changePercent: number
}

export const industries: Industry[] = [
  { name: 'Information Technology', stocks: 250, marketCapCr: 1842500, peRatio: 28.4, pbRatio: 6.2, roePercent: 24.5, rocePct: 32.1, changePercent: 0.87 },
  { name: 'Financial Services', stocks: 620, marketCapCr: 3245600, peRatio: 18.2, pbRatio: 2.8, roePercent: 16.8, rocePct: 14.2, changePercent: 0.34 },
  { name: 'Fast Moving Consumer Goods', stocks: 160, marketCapCr: 856400, peRatio: 45.6, pbRatio: 12.4, roePercent: 28.4, rocePct: 35.6, changePercent: 0.52 },
  { name: 'Healthcare & Pharma', stocks: 310, marketCapCr: 623400, peRatio: 32.1, pbRatio: 5.4, roePercent: 18.2, rocePct: 22.4, changePercent: -0.21 },
  { name: 'Consumer Discretionary', stocks: 420, marketCapCr: 1023400, peRatio: 38.9, pbRatio: 8.1, roePercent: 22.3, rocePct: 26.7, changePercent: 0.75 },
  { name: 'Energy & Oil', stocks: 85, marketCapCr: 2156700, peRatio: 12.4, pbRatio: 1.9, roePercent: 15.4, rocePct: 18.2, changePercent: 1.12 },
  { name: 'Telecom', stocks: 48, marketCapCr: 1234500, peRatio: 22.8, pbRatio: 4.6, roePercent: 20.1, rocePct: 16.8, changePercent: 1.45 },
  { name: 'Industrials & Engineering', stocks: 580, marketCapCr: 923400, peRatio: 41.2, pbRatio: 7.8, roePercent: 19.6, rocePct: 24.3, changePercent: 0.68 },
  { name: 'Metals & Mining', stocks: 190, marketCapCr: 712300, peRatio: 8.6, pbRatio: 1.4, roePercent: 16.8, rocePct: 14.1, changePercent: -0.56 },
  { name: 'Utilities & Power', stocks: 120, marketCapCr: 534200, peRatio: 18.4, pbRatio: 2.9, roePercent: 14.2, rocePct: 11.8, changePercent: 0.34 },
  { name: 'Real Estate', stocks: 95, marketCapCr: 345600, peRatio: 24.6, pbRatio: 3.8, roePercent: 16.4, rocePct: 12.6, changePercent: -0.87 },
  { name: 'Consumer Staples', stocks: 145, marketCapCr: 423400, peRatio: 52.3, pbRatio: 14.2, roePercent: 26.8, rocePct: 30.4, changePercent: 0.22 },
  { name: 'Chemicals & Agrochemicals', stocks: 210, marketCapCr: 312400, peRatio: 34.7, pbRatio: 6.1, roePercent: 17.8, rocePct: 21.2, changePercent: 0.45 },
  { name: 'Automobile & Components', stocks: 280, marketCapCr: 1124500, peRatio: 26.4, pbRatio: 4.8, roePercent: 18.9, rocePct: 23.5, changePercent: 0.61 },
  { name: 'Capital Goods', stocks: 340, marketCapCr: 645800, peRatio: 44.8, pbRatio: 9.2, roePercent: 21.4, rocePct: 27.8, changePercent: 0.92 },
]

// ─── Annual Reports ───────────────────────────────────────────────────────────
export interface AnnualReport {
  company: string
  symbol: string
  fy: string
  revenue: number
  pat: number
  eps: number
  roe: number
  dividendPerShare: number
}

export const annualReports: AnnualReport[] = [
  { company: 'Reliance Industries', symbol: 'RELIANCE', fy: 'FY26', revenue: 1024500, pat: 68400, eps: 101.4, roe: 10.2, dividendPerShare: 10.0 },
  { company: 'TCS', symbol: 'TCS', fy: 'FY26', revenue: 255600, pat: 46400, eps: 126.8, roe: 51.6, dividendPerShare: 72.0 },
  { company: 'HDFC Bank', symbol: 'HDFCBANK', fy: 'FY26', revenue: 184200, pat: 58400, eps: 76.8, roe: 16.4, dividendPerShare: 22.0 },
  { company: 'Infosys', symbol: 'INFY', fy: 'FY26', revenue: 165800, pat: 28400, eps: 68.4, roe: 33.2, dividendPerShare: 22.0 },
  { company: 'Bajaj Finance', symbol: 'BAJFINANCE', fy: 'FY26', revenue: 64200, pat: 16800, eps: 272.4, roe: 22.8, dividendPerShare: 36.0 },
  { company: 'Maruti Suzuki', symbol: 'MARUTI', fy: 'FY26', revenue: 148600, pat: 14800, eps: 488.2, roe: 17.6, dividendPerShare: 125.0 },
  { company: 'L&T', symbol: 'LT', fy: 'FY26', revenue: 284600, pat: 18400, eps: 131.8, roe: 16.4, dividendPerShare: 34.0 },
  { company: 'ITC', symbol: 'ITC', fy: 'FY26', revenue: 89400, pat: 22800, eps: 18.2, roe: 27.4, dividendPerShare: 14.0 },
  { company: 'Asian Paints', symbol: 'ASIANPAINT', fy: 'FY26', revenue: 42800, pat: 5200, eps: 54.2, roe: 30.8, dividendPerShare: 26.5 },
  { company: 'Sun Pharma', symbol: 'SUNPHARMA', fy: 'FY26', revenue: 52400, pat: 10800, eps: 45.0, roe: 18.4, dividendPerShare: 6.0 },
  { company: 'Titan Company', symbol: 'TITAN', fy: 'FY26', revenue: 54200, pat: 4200, eps: 47.4, roe: 32.4, dividendPerShare: 11.0 },
  { company: 'Ultratech Cement', symbol: 'ULTRACEMCO', fy: 'FY26', revenue: 82400, pat: 8400, eps: 290.6, roe: 14.8, dividendPerShare: 65.0 },
]

// ─── Market-wide Dividends ─────────────────────────────────────────────────────
export interface DividendRow {
  company: string
  symbol: string
  exDate: string
  recordDate: string
  dividendType: 'Final' | 'Interim' | 'Special'
  dividendPerShare: number
  fy: string
}

export const dividendsAll: DividendRow[] = [
  { company: 'HDFC Bank', symbol: 'HDFCBANK', exDate: '2026-07-04', recordDate: '2026-07-05', dividendType: 'Final', dividendPerShare: 22.0, fy: 'FY26' },
  { company: 'Power Grid', symbol: 'POWERGRID', exDate: '2026-07-14', recordDate: '2026-07-15', dividendType: 'Interim', dividendPerShare: 7.5, fy: 'FY27' },
  { company: 'Reliance Industries', symbol: 'RELIANCE', exDate: '2026-06-18', recordDate: '2026-06-19', dividendType: 'Final', dividendPerShare: 10.0, fy: 'FY26' },
  { company: 'TCS', symbol: 'TCS', exDate: '2026-06-10', recordDate: '2026-06-11', dividendType: 'Final', dividendPerShare: 72.0, fy: 'FY26' },
  { company: 'Infosys', symbol: 'INFY', exDate: '2026-05-30', recordDate: '2026-05-31', dividendType: 'Final', dividendPerShare: 22.0, fy: 'FY26' },
  { company: 'Coal India', symbol: 'COALINDIA', exDate: '2026-05-22', recordDate: '2026-05-23', dividendType: 'Final', dividendPerShare: 25.5, fy: 'FY26' },
  { company: 'ITC', symbol: 'ITC', exDate: '2026-07-01', recordDate: '2026-07-02', dividendType: 'Final', dividendPerShare: 14.0, fy: 'FY26' },
  { company: 'Nestle India', symbol: 'NESTLEIND', exDate: '2026-04-28', recordDate: '2026-04-29', dividendType: 'Interim', dividendPerShare: 15.0, fy: 'FY26' },
  { company: 'Asian Paints', symbol: 'ASIANPAINT', exDate: '2026-05-15', recordDate: '2026-05-16', dividendType: 'Final', dividendPerShare: 26.5, fy: 'FY26' },
  { company: 'HCL Technologies', symbol: 'HCLTECH', exDate: '2026-04-17', recordDate: '2026-04-18', dividendType: 'Interim', dividendPerShare: 18.0, fy: 'FY26' },
  { company: 'Wipro', symbol: 'WIPRO', exDate: '2026-05-05', recordDate: '2026-05-06', dividendType: 'Final', dividendPerShare: 5.0, fy: 'FY26' },
  { company: 'Sun Pharma', symbol: 'SUNPHARMA', exDate: '2026-06-03', recordDate: '2026-06-04', dividendType: 'Final', dividendPerShare: 6.0, fy: 'FY26' },
  { company: 'Ultratech Cement', symbol: 'ULTRACEMCO', exDate: '2026-06-24', recordDate: '2026-06-25', dividendType: 'Final', dividendPerShare: 65.0, fy: 'FY26' },
  { company: 'Maruti Suzuki', symbol: 'MARUTI', exDate: '2026-07-08', recordDate: '2026-07-09', dividendType: 'Final', dividendPerShare: 125.0, fy: 'FY26' },
  { company: 'NTPC', symbol: 'NTPC', exDate: '2026-06-17', recordDate: '2026-06-18', dividendType: 'Interim', dividendPerShare: 4.0, fy: 'FY27' },
]

// ─── Bulk Deals ───────────────────────────────────────────────────────────────
export interface Deal {
  date: string
  company: string
  symbol: string
  client: string
  tradeType: 'Buy' | 'Sell'
  quantity: number
  price: number
  valueCr: number
}

export const bulkDeals: Deal[] = [
  { date: '2026-06-17', company: 'Paytm', symbol: 'PAYTM', client: 'Mirae Asset MF', tradeType: 'Buy', quantity: 8450000, price: 624.5, valueCr: 527.5 },
  { date: '2026-06-17', company: 'Adani Green', symbol: 'ADANIGREEN', client: 'FMR LLC (Fidelity)', tradeType: 'Sell', quantity: 5200000, price: 1875.0, valueCr: 975.0 },
  { date: '2026-06-16', company: 'Zomato', symbol: 'ZOMATO', client: 'HDFC Mutual Fund', tradeType: 'Buy', quantity: 12400000, price: 218.6, valueCr: 271.1 },
  { date: '2026-06-16', company: 'Tata Motors', symbol: 'TATAMOTORS', client: 'Government of Singapore', tradeType: 'Buy', quantity: 6800000, price: 934.2, valueCr: 635.3 },
  { date: '2026-06-15', company: 'Yes Bank', symbol: 'YESBANK', client: 'SBI Life Insurance', tradeType: 'Sell', quantity: 45000000, price: 22.4, valueCr: 100.8 },
  { date: '2026-06-15', company: 'IndiGo', symbol: 'INDIGO', client: 'Motilal Oswal MF', tradeType: 'Buy', quantity: 980000, price: 3845.0, valueCr: 376.8 },
  { date: '2026-06-14', company: 'CAMS', symbol: 'CAMS', client: 'ICICI Prudential MF', tradeType: 'Buy', quantity: 450000, price: 2845.0, valueCr: 128.0 },
  { date: '2026-06-14', company: 'Nykaa', symbol: 'FSN', client: 'Steadview Capital', tradeType: 'Sell', quantity: 15600000, price: 178.4, valueCr: 278.3 },
  { date: '2026-06-13', company: 'Bajaj Finserv', symbol: 'BAJAJFINSV', client: 'Vanguard Group', tradeType: 'Buy', quantity: 820000, price: 1684.0, valueCr: 138.1 },
  { date: '2026-06-13', company: 'Suzlon Energy', symbol: 'SUZLON', client: 'DSP Mutual Fund', tradeType: 'Buy', quantity: 28000000, price: 48.6, valueCr: 136.1 },
  { date: '2026-06-12', company: 'Vodafone Idea', symbol: 'IDEA', client: 'Kotak MF', tradeType: 'Sell', quantity: 120000000, price: 11.8, valueCr: 141.6 },
  { date: '2026-06-12', company: 'TVS Motor', symbol: 'TVSMOTOR', client: 'Franklin Templeton', tradeType: 'Buy', quantity: 1240000, price: 2145.0, valueCr: 266.0 },
  { date: '2026-06-11', company: 'Dixon Technologies', symbol: 'DIXON', client: 'Blackrock Inc', tradeType: 'Buy', quantity: 345000, price: 12450.0, valueCr: 429.5 },
  { date: '2026-06-11', company: 'Hindalco', symbol: 'HINDALCO', client: 'Norges Bank', tradeType: 'Buy', quantity: 5600000, price: 634.2, valueCr: 355.2 },
  { date: '2026-06-10', company: 'Polycab India', symbol: 'POLYCAB', client: 'SBI Mutual Fund', tradeType: 'Buy', quantity: 680000, price: 5840.0, valueCr: 397.1 },
]

export const blockDeals: Deal[] = [
  { date: '2026-06-17', company: 'Reliance Industries', symbol: 'RELIANCE', client: 'GIC Singapore', tradeType: 'Buy', quantity: 4200000, price: 2934.7, valueCr: 1232.6 },
  { date: '2026-06-16', company: 'ICICI Bank', symbol: 'ICICIBANK', client: 'Temasek Holdings', tradeType: 'Buy', quantity: 9400000, price: 1248.6, valueCr: 1173.7 },
  { date: '2026-06-15', company: 'Tata Consultancy', symbol: 'TCS', client: 'Capital Group', tradeType: 'Sell', quantity: 2100000, price: 3684.0, valueCr: 773.6 },
  { date: '2026-06-14', company: 'Bajaj Finance', symbol: 'BAJFINANCE', client: 'Fidelity Investments', tradeType: 'Buy', quantity: 1840000, price: 6924.0, valueCr: 1274.0 },
  { date: '2026-06-13', company: 'HDFC Bank', symbol: 'HDFCBANK', client: 'JP Morgan Chase', tradeType: 'Buy', quantity: 8200000, price: 1684.0, valueCr: 1380.9 },
  { date: '2026-06-12', company: 'Infosys', symbol: 'INFY', client: 'Aberdeen Asset Mgmt', tradeType: 'Sell', quantity: 5400000, price: 1584.3, valueCr: 855.5 },
  { date: '2026-06-11', company: 'Maruti Suzuki', symbol: 'MARUTI', client: 'Kuwait Investment Auth', tradeType: 'Buy', quantity: 620000, price: 10845.0, valueCr: 672.4 },
  { date: '2026-06-10', company: 'Kotak Mahindra Bank', symbol: 'KOTAKBANK', client: 'CalPERS', tradeType: 'Buy', quantity: 3800000, price: 2134.6, valueCr: 811.1 },
  { date: '2026-06-09', company: 'L&T', symbol: 'LT', client: 'ADIA (Abu Dhabi)', tradeType: 'Buy', quantity: 1250000, price: 3784.0, valueCr: 473.0 },
  { date: '2026-06-09', company: 'Axis Bank', symbol: 'AXISBANK', client: 'Schroders plc', tradeType: 'Sell', quantity: 6800000, price: 1184.0, valueCr: 805.1 },
]

// ─── SAST Trades ──────────────────────────────────────────────────────────────
export interface SASTrade {
  date: string
  company: string
  symbol: string
  acquirer: string
  preHolding: number
  postHolding: number
  changePercent: number
  mode: 'Open Market' | 'Off-Market' | 'Preferential Allotment'
}

export const sastTrades: SASTrade[] = [
  { date: '2026-06-17', company: 'IRB Infra', symbol: 'IRB', acquirer: 'MMP FZE (Virendra Mhaiskar)', preHolding: 27.4, postHolding: 28.9, changePercent: 1.5, mode: 'Open Market' },
  { date: '2026-06-16', company: 'Brightcom Group', symbol: 'BCG', acquirer: 'Suresh Kumar Reddy', preHolding: 22.1, postHolding: 25.0, changePercent: 2.9, mode: 'Open Market' },
  { date: '2026-06-15', company: 'Dish TV', symbol: 'DISHTV', acquirer: 'YES Bank Ltd (Pledged Sale)', preHolding: 6.8, postHolding: 4.2, changePercent: -2.6, mode: 'Off-Market' },
  { date: '2026-06-14', company: 'Glenmark Life Sciences', symbol: 'GLNCE', acquirer: 'Glenmark Pharma (Promoter)', preHolding: 51.8, postHolding: 54.2, changePercent: 2.4, mode: 'Open Market' },
  { date: '2026-06-13', company: 'PCBL Ltd', symbol: 'PCBL', acquirer: 'RPG Enterprises', preHolding: 55.6, postHolding: 56.8, changePercent: 1.2, mode: 'Open Market' },
  { date: '2026-06-12', company: 'Shree Renuka Sugars', symbol: 'RENUKA', acquirer: 'Wilmar Sugar Holdings', preHolding: 62.4, postHolding: 64.1, changePercent: 1.7, mode: 'Preferential Allotment' },
  { date: '2026-06-11', company: 'CEAT Ltd', symbol: 'CEAT', acquirer: 'RPG Group Promoters', preHolding: 48.2, postHolding: 49.5, changePercent: 1.3, mode: 'Open Market' },
  { date: '2026-06-10', company: 'TV18 Broadcast', symbol: 'TV18BRDCST', acquirer: 'Reliance Industries', preHolding: 56.8, postHolding: 58.4, changePercent: 1.6, mode: 'Open Market' },
  { date: '2026-06-09', company: 'Strides Pharma', symbol: 'STAR', acquirer: 'Arun Kumar (Promoter)', preHolding: 23.4, postHolding: 25.1, changePercent: 1.7, mode: 'Open Market' },
  { date: '2026-06-08', company: 'NCC Ltd', symbol: 'NCC', acquirer: 'Gulam Nabi Memon', preHolding: 10.1, postHolding: 11.4, changePercent: 1.3, mode: 'Open Market' },
]

// ─── Insider Trades ───────────────────────────────────────────────────────────
export interface InsiderTrade {
  date: string
  company: string
  symbol: string
  insider: string
  designation: string
  tradeType: 'Buy' | 'Sell'
  quantity: number
  price: number
  valueCr: number
}

export const insiderTrades: InsiderTrade[] = [
  { date: '2026-06-17', company: 'Persistent Systems', symbol: 'PERSISTENT', insider: 'Sandeep Kalra', designation: 'CEO & MD', tradeType: 'Buy', quantity: 10000, price: 4245.0, valueCr: 4.2 },
  { date: '2026-06-16', company: 'Happiest Minds', symbol: 'HAPPSTMNDS', insider: 'Joseph Anantharaju', designation: 'Executive VC', tradeType: 'Sell', quantity: 200000, price: 784.0, valueCr: 15.7 },
  { date: '2026-06-15', company: 'Mastech Digital', symbol: 'MASTECH', insider: 'Sundar Kadayam', designation: 'CFO', tradeType: 'Buy', quantity: 5000, price: 1240.0, valueCr: 0.6 },
  { date: '2026-06-14', company: 'KPIT Technologies', symbol: 'KPITTECH', insider: 'Kishor Patil', designation: 'CEO & MD', tradeType: 'Buy', quantity: 50000, price: 1584.0, valueCr: 7.9 },
  { date: '2026-06-13', company: 'Zomato', symbol: 'ZOMATO', insider: 'Deepinder Goyal', designation: 'CEO', tradeType: 'Sell', quantity: 10000000, price: 218.6, valueCr: 21.9 },
  { date: '2026-06-12', company: 'Trent Ltd', symbol: 'TRENT', insider: 'Noel Tata', designation: 'Chairman', tradeType: 'Buy', quantity: 150000, price: 5840.0, valueCr: 87.6 },
  { date: '2026-06-11', company: 'Varun Beverages', symbol: 'VBL', insider: 'Ravi Jaipuria', designation: 'Chairman', tradeType: 'Buy', quantity: 1200000, price: 548.0, valueCr: 65.8 },
  { date: '2026-06-10', company: 'Astral Poly Technik', symbol: 'ASTRAL', insider: 'Sandeep Engineer', designation: 'MD', tradeType: 'Sell', quantity: 500000, price: 1948.0, valueCr: 97.4 },
  { date: '2026-06-09', company: 'Divi Laboratories', symbol: 'DIVISLAB', insider: 'Murali Krishna Prasad', designation: 'MD', tradeType: 'Buy', quantity: 80000, price: 4284.0, valueCr: 34.3 },
  { date: '2026-06-08', company: 'Route Mobile', symbol: 'ROUTE', insider: 'Rajdipkumar Gupta', designation: 'MD & CEO', tradeType: 'Buy', quantity: 100000, price: 1384.0, valueCr: 13.8 },
  { date: '2026-06-07', company: 'Teamlease Services', symbol: 'TEAMLEASE', insider: 'Ashok Reddy', designation: 'MD', tradeType: 'Sell', quantity: 75000, price: 2485.0, valueCr: 18.6 },
  { date: '2026-06-06', company: 'Aavas Financiers', symbol: 'AAVAS', insider: 'Sachindra Nath Jha', designation: 'MD & CEO', tradeType: 'Buy', quantity: 30000, price: 1684.0, valueCr: 5.1 },
  { date: '2026-06-05', company: 'SBI Cards', symbol: 'SBICARD', insider: 'Abhijit Chakravorty', designation: 'MD & CEO', tradeType: 'Sell', quantity: 500000, price: 724.0, valueCr: 36.2 },
  { date: '2026-06-04', company: 'Mphasis', symbol: 'MPHASIS', insider: 'Nitin Rakesh', designation: 'CEO', tradeType: 'Sell', quantity: 250000, price: 2184.0, valueCr: 54.6 },
  { date: '2026-06-03', company: 'Navin Fluorine', symbol: 'NAVINFLUOR', insider: 'Radhesh Welling', designation: 'MD', tradeType: 'Buy', quantity: 20000, price: 3245.0, valueCr: 6.5 },
]

// ─── Concalls ─────────────────────────────────────────────────────────────────
export interface Concall {
  company: string
  symbol: string
  date: string
  quarter: string
  hasRecording: boolean
  hasTranscript: boolean
  hasSummary: boolean
}

export const concalls: Concall[] = [
  { company: 'TCS', symbol: 'TCS', date: '2026-04-10', quarter: 'Q4 FY26', hasRecording: true, hasTranscript: true, hasSummary: true },
  { company: 'Infosys', symbol: 'INFY', date: '2026-04-12', quarter: 'Q4 FY26', hasRecording: true, hasTranscript: true, hasSummary: true },
  { company: 'HDFC Bank', symbol: 'HDFCBANK', date: '2026-04-14', quarter: 'Q4 FY26', hasRecording: true, hasTranscript: true, hasSummary: false },
  { company: 'Reliance Industries', symbol: 'RELIANCE', date: '2026-04-25', quarter: 'Q4 FY26', hasRecording: true, hasTranscript: false, hasSummary: true },
  { company: 'Wipro', symbol: 'WIPRO', date: '2026-04-16', quarter: 'Q4 FY26', hasRecording: true, hasTranscript: true, hasSummary: true },
  { company: 'HCL Technologies', symbol: 'HCLTECH', date: '2026-04-22', quarter: 'Q4 FY26', hasRecording: false, hasTranscript: true, hasSummary: true },
  { company: 'Bajaj Finance', symbol: 'BAJFINANCE', date: '2026-04-29', quarter: 'Q4 FY26', hasRecording: true, hasTranscript: true, hasSummary: false },
  { company: 'Asian Paints', symbol: 'ASIANPAINT', date: '2026-04-23', quarter: 'Q4 FY26', hasRecording: false, hasTranscript: true, hasSummary: true },
  { company: 'L&T', symbol: 'LT', date: '2026-05-08', quarter: 'Q4 FY26', hasRecording: true, hasTranscript: true, hasSummary: true },
  { company: 'Maruti Suzuki', symbol: 'MARUTI', date: '2026-04-27', quarter: 'Q4 FY26', hasRecording: true, hasTranscript: false, hasSummary: false },
  { company: 'Sun Pharma', symbol: 'SUNPHARMA', date: '2026-05-12', quarter: 'Q4 FY26', hasRecording: true, hasTranscript: true, hasSummary: true },
  { company: 'ITC', symbol: 'ITC', date: '2026-05-22', quarter: 'Q4 FY26', hasRecording: false, hasTranscript: true, hasSummary: false },
]

export const upcomingConcalls: Concall[] = [
  { company: 'Reliance Industries', symbol: 'RELIANCE', date: '2026-07-18', quarter: 'Q1 FY27', hasRecording: false, hasTranscript: false, hasSummary: false },
  { company: 'TCS', symbol: 'TCS', date: '2026-07-11', quarter: 'Q1 FY27', hasRecording: false, hasTranscript: false, hasSummary: false },
  { company: 'Infosys', symbol: 'INFY', date: '2026-07-12', quarter: 'Q1 FY27', hasRecording: false, hasTranscript: false, hasSummary: false },
  { company: 'HDFC Bank', symbol: 'HDFCBANK', date: '2026-07-19', quarter: 'Q1 FY27', hasRecording: false, hasTranscript: false, hasSummary: false },
  { company: 'Wipro', symbol: 'WIPRO', date: '2026-07-16', quarter: 'Q1 FY27', hasRecording: false, hasTranscript: false, hasSummary: false },
  { company: 'Bajaj Finance', symbol: 'BAJFINANCE', date: '2026-07-27', quarter: 'Q1 FY27', hasRecording: false, hasTranscript: false, hasSummary: false },
  { company: 'L&T', symbol: 'LT', date: '2026-08-07', quarter: 'Q1 FY27', hasRecording: false, hasTranscript: false, hasSummary: false },
  { company: 'HCL Technologies', symbol: 'HCLTECH', date: '2026-07-22', quarter: 'Q1 FY27', hasRecording: false, hasTranscript: false, hasSummary: false },
]

// ─── Quarterly Results ─────────────────────────────────────────────────────────
export interface QuarterlyResult {
  company: string
  symbol: string
  quarter: string
  resultDate: string
  revenue: number
  revenueChange: number
  pat: number
  patChange: number
  ebitdaMargin: number
  sector: string
}

export const quarterlyResults: QuarterlyResult[] = [
  { company: 'Nestle India', symbol: 'NESTLEIND', quarter: 'Q4 FY26', resultDate: '2026-06-08', revenue: 4850, revenueChange: 9.4, pat: 840, patChange: 7.2, ebitdaMargin: 22.4, sector: 'FMCG' },
  { company: 'Britannia Industries', symbol: 'BRITANNIA', quarter: 'Q4 FY26', resultDate: '2026-06-14', revenue: 4200, revenueChange: 11.8, pat: 620, patChange: 14.2, ebitdaMargin: 17.4, sector: 'FMCG' },
  { company: 'Colgate-Palmolive', symbol: 'COLPAL', quarter: 'Q4 FY26', resultDate: '2026-06-06', revenue: 1480, revenueChange: 8.2, pat: 248, patChange: 9.8, ebitdaMargin: 31.2, sector: 'FMCG' },
  { company: 'Marico', symbol: 'MARICO', quarter: 'Q4 FY26', resultDate: '2026-06-05', revenue: 2640, revenueChange: 7.6, pat: 380, patChange: 8.4, ebitdaMargin: 19.8, sector: 'FMCG' },
  { company: 'IndusInd Bank', symbol: 'INDUSINDBK', quarter: 'Q4 FY26', resultDate: '2026-06-04', revenue: 14200, revenueChange: 12.4, pat: 2180, patChange: 15.6, ebitdaMargin: 45.2, sector: 'Banks' },
  { company: 'Federal Bank', symbol: 'FEDERALBNK', quarter: 'Q4 FY26', resultDate: '2026-06-03', revenue: 5240, revenueChange: 14.8, pat: 1020, patChange: 18.2, ebitdaMargin: 42.6, sector: 'Banks' },
  { company: 'Grasim Industries', symbol: 'GRASIM', quarter: 'Q4 FY26', resultDate: '2026-06-02', revenue: 28400, revenueChange: 6.8, pat: 3240, patChange: 12.4, ebitdaMargin: 18.6, sector: 'Conglomerates' },
  { company: 'Ambuja Cements', symbol: 'AMBUJACEM', quarter: 'Q4 FY26', resultDate: '2026-05-30', revenue: 8240, revenueChange: 9.2, pat: 980, patChange: 22.4, ebitdaMargin: 21.4, sector: 'Cement' },
  { company: 'SBI Life Insurance', symbol: 'SBILIFE', quarter: 'Q4 FY26', resultDate: '2026-05-28', revenue: 12400, revenueChange: 18.4, pat: 1680, patChange: 24.2, ebitdaMargin: 28.6, sector: 'Insurance' },
  { company: 'HDFC Life', symbol: 'HDFCLIFE', quarter: 'Q4 FY26', resultDate: '2026-05-27', revenue: 10840, revenueChange: 15.8, pat: 1440, patChange: 19.6, ebitdaMargin: 26.8, sector: 'Insurance' },
  { company: 'Tata Power', symbol: 'TATAPOWER', quarter: 'Q4 FY26', resultDate: '2026-05-25', revenue: 16800, revenueChange: 21.4, pat: 1240, patChange: 28.6, ebitdaMargin: 16.4, sector: 'Power' },
  { company: 'Torrent Power', symbol: 'TORNTPOWER', quarter: 'Q4 FY26', resultDate: '2026-05-24', revenue: 8240, revenueChange: 14.2, pat: 1080, patChange: 21.8, ebitdaMargin: 24.6, sector: 'Power' },
  { company: 'Divi Laboratories', symbol: 'DIVISLAB', quarter: 'Q4 FY26', resultDate: '2026-05-22', revenue: 2840, revenueChange: 18.6, pat: 720, patChange: 32.4, ebitdaMargin: 38.4, sector: 'Pharma' },
  { company: 'Alkem Laboratories', symbol: 'ALKEM', quarter: 'Q4 FY26', resultDate: '2026-05-21', revenue: 2680, revenueChange: 12.4, pat: 420, patChange: 16.8, ebitdaMargin: 22.8, sector: 'Pharma' },
  { company: 'Cummins India', symbol: 'CUMMINSIND', quarter: 'Q4 FY26', resultDate: '2026-05-20', revenue: 2840, revenueChange: 16.8, pat: 480, patChange: 24.2, ebitdaMargin: 26.4, sector: 'Industrials' },
]

// ─── IPOs ─────────────────────────────────────────────────────────────────────
export interface UpcomingIPO {
  company: string
  subscriptionStart: string
  subscriptionEnd: string
  listingDate: string
  issueSize: number
  priceband: string
  category: string
}

export interface RecentIPO {
  company: string
  symbol: string
  listingDate: string
  ipoPrice: number
  currentPrice: number
  changePercent: number
  ipoMarketCapCr: number
  currentMarketCapCr: number
}

export const iposUpcoming: UpcomingIPO[] = [
  { company: 'Ola Electric Technologies', subscriptionStart: '2026-07-01', subscriptionEnd: '2026-07-03', listingDate: '2026-07-08', issueSize: 5500, priceband: '₹72–76', category: 'Electric Vehicles' },
  { company: 'Lenskart Solutions', subscriptionStart: '2026-07-07', subscriptionEnd: '2026-07-09', listingDate: '2026-07-14', issueSize: 3200, priceband: '₹384–404', category: 'Retail / Opticals' },
  { company: 'Pine Labs Ltd', subscriptionStart: '2026-07-14', subscriptionEnd: '2026-07-16', listingDate: '2026-07-21', issueSize: 7800, priceband: '₹625–660', category: 'Fintech' },
  { company: 'Meesho Inc', subscriptionStart: '2026-07-21', subscriptionEnd: '2026-07-23', listingDate: '2026-07-28', issueSize: 4800, priceband: '₹240–256', category: 'E-Commerce' },
  { company: 'HealthKart Parent', subscriptionStart: '2026-07-28', subscriptionEnd: '2026-07-30', listingDate: '2026-08-04', issueSize: 1800, priceband: '₹180–192', category: 'Health & Wellness' },
  { company: 'Tata Capital Financial', subscriptionStart: '2026-08-04', subscriptionEnd: '2026-08-06', listingDate: '2026-08-11', issueSize: 12000, priceband: '₹485–512', category: 'NBFC' },
  { company: 'Blinkit Technologies', subscriptionStart: '2026-08-11', subscriptionEnd: '2026-08-13', listingDate: '2026-08-18', issueSize: 6400, priceband: '₹312–328', category: 'Quick Commerce' },
  { company: 'ACME Solar Holdings', subscriptionStart: '2026-08-18', subscriptionEnd: '2026-08-20', listingDate: '2026-08-25', issueSize: 2800, priceband: '₹289–305', category: 'Renewable Energy' },
]

export const iposRecent: RecentIPO[] = [
  { company: 'Premier Energies', symbol: 'PREMIENERG', listingDate: '2025-09-06', ipoPrice: 450, currentPrice: 847.4, changePercent: 88.3, ipoMarketCapCr: 14500, currentMarketCapCr: 27300 },
  { company: 'Ola Electric', symbol: 'OLAELEC', listingDate: '2024-08-09', ipoPrice: 76, currentPrice: 68.4, changePercent: -10.0, ipoMarketCapCr: 34000, currentMarketCapCr: 30700 },
  { company: 'NTPC Green Energy', symbol: 'NTPCGREEN', listingDate: '2024-11-27', ipoPrice: 108, currentPrice: 138.6, changePercent: 28.3, ipoMarketCapCr: 100400, currentMarketCapCr: 128700 },
  { company: 'Hyundai India', symbol: 'HYUNDAI', listingDate: '2024-10-22', ipoPrice: 1960, currentPrice: 1824.0, changePercent: -6.9, ipoMarketCapCr: 159000, currentMarketCapCr: 147600 },
  { company: 'Swiggy', symbol: 'SWIGGY', listingDate: '2024-11-13', ipoPrice: 390, currentPrice: 342.0, changePercent: -12.3, ipoMarketCapCr: 87500, currentMarketCapCr: 76900 },
  { company: 'Bajaj Housing Finance', symbol: 'BAJAJHFL', listingDate: '2024-09-16', ipoPrice: 70, currentPrice: 98.6, changePercent: 40.9, ipoMarketCapCr: 58000, currentMarketCapCr: 81700 },
  { company: 'Waaree Energies', symbol: 'WAAREEENER', listingDate: '2024-10-28', ipoPrice: 1503, currentPrice: 2248.0, changePercent: 49.6, ipoMarketCapCr: 42500, currentMarketCapCr: 63600 },
  { company: 'FirstCry (Brainbees)', symbol: 'BRAINBEES', listingDate: '2024-08-13', ipoPrice: 465, currentPrice: 418.0, changePercent: -10.1, ipoMarketCapCr: 24500, currentMarketCapCr: 22000 },
  { company: 'Awfis Space Solutions', symbol: 'AWFIS', listingDate: '2024-06-07', ipoPrice: 383, currentPrice: 498.0, changePercent: 30.0, ipoMarketCapCr: 3400, currentMarketCapCr: 4400 },
  { company: 'Unicommerce eSolutions', symbol: 'UNICOMMERCE', listingDate: '2024-08-13', ipoPrice: 108, currentPrice: 246.0, changePercent: 127.8, ipoMarketCapCr: 1800, currentMarketCapCr: 4100 },
]
