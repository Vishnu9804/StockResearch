/**
 * lib/data/corporate-actions.ts
 * Corporate actions, upcoming events, and dividend history for Reliance Industries
 */

export type CorporateActionType = 'Dividend' | 'Bonus' | 'Split' | 'Rights'

export interface CorporateAction {
  id: string
  type: CorporateActionType
  announcementDate: string
  recordDate: string
  exDate: string
  details: string
  amount?: number
}

export interface UpcomingEvent {
  type: 'AGM' | 'EarningsCall' | 'BoardMeeting' | 'Dividend'
  date: string
  title: string
  description: string
}

export interface DividendHistory {
  year: string
  amount: number
}

// ─── Corporate Actions (2015–2025) ───────────────────────────────────────────
export const corporateActions: CorporateAction[] = [
  // 2025
  {
    id: 'div-2025-interim',
    type: 'Dividend',
    announcementDate: '2025-01-16',
    recordDate: '2025-02-01',
    exDate: '2025-01-31',
    details: '₹5.50 per share interim dividend',
    amount: 5.50,
  },
  {
    id: 'div-2025-final',
    type: 'Dividend',
    announcementDate: '2025-04-22',
    recordDate: '2025-06-20',
    exDate: '2025-06-19',
    details: '₹10 per share final dividend',
    amount: 10.0,
  },

  // 2024
  {
    id: 'div-2024-interim',
    type: 'Dividend',
    announcementDate: '2024-01-18',
    recordDate: '2024-02-02',
    exDate: '2024-02-01',
    details: '₹5 per share interim dividend',
    amount: 5.0,
  },
  {
    id: 'div-2024-final',
    type: 'Dividend',
    announcementDate: '2024-04-19',
    recordDate: '2024-06-20',
    exDate: '2024-06-19',
    details: '₹9 per share final dividend',
    amount: 9.0,
  },
  {
    id: 'bonus-2024',
    type: 'Bonus',
    announcementDate: '2024-08-29',
    recordDate: '2024-10-28',
    exDate: '2024-10-25',
    details: '1:1 Bonus — 1 share for every 1 share held',
  },

  // 2023
  {
    id: 'div-2023-interim',
    type: 'Dividend',
    announcementDate: '2023-01-19',
    recordDate: '2023-02-03',
    exDate: '2023-02-02',
    details: '₹4.50 per share interim dividend',
    amount: 4.50,
  },
  {
    id: 'div-2023-final',
    type: 'Dividend',
    announcementDate: '2023-04-21',
    recordDate: '2023-06-16',
    exDate: '2023-06-15',
    details: '₹9 per share final dividend',
    amount: 9.0,
  },

  // 2022
  {
    id: 'div-2022-interim',
    type: 'Dividend',
    announcementDate: '2022-01-20',
    recordDate: '2022-02-04',
    exDate: '2022-02-03',
    details: '₹4 per share interim dividend',
    amount: 4.0,
  },
  {
    id: 'div-2022-final',
    type: 'Dividend',
    announcementDate: '2022-04-20',
    recordDate: '2022-06-17',
    exDate: '2022-06-16',
    details: '₹8 per share final dividend',
    amount: 8.0,
  },
  {
    id: 'rights-2022',
    type: 'Rights',
    announcementDate: '2022-05-20',
    recordDate: '2022-06-06',
    exDate: '2022-06-03',
    details: '1:15 Rights Issue at ₹1,257 per share (₹312.50 paid upfront)',
  },

  // 2021
  {
    id: 'div-2021-final',
    type: 'Dividend',
    announcementDate: '2021-04-22',
    recordDate: '2021-06-18',
    exDate: '2021-06-17',
    details: '₹7 per share final dividend',
    amount: 7.0,
  },

  // 2020
  {
    id: 'div-2020-final',
    type: 'Dividend',
    announcementDate: '2020-04-23',
    recordDate: '2020-06-19',
    exDate: '2020-06-18',
    details: '₹6.50 per share final dividend',
    amount: 6.50,
  },

  // 2019
  {
    id: 'div-2019-final',
    type: 'Dividend',
    announcementDate: '2019-04-18',
    recordDate: '2019-06-21',
    exDate: '2019-06-20',
    details: '₹6.50 per share final dividend',
    amount: 6.50,
  },

  // 2018
  {
    id: 'div-2018-final',
    type: 'Dividend',
    announcementDate: '2018-04-19',
    recordDate: '2018-06-22',
    exDate: '2018-06-21',
    details: '₹6 per share final dividend',
    amount: 6.0,
  },

  // 2017
  {
    id: 'div-2017-final',
    type: 'Dividend',
    announcementDate: '2017-04-27',
    recordDate: '2017-06-23',
    exDate: '2017-06-22',
    details: '₹5.50 per share final dividend',
    amount: 5.50,
  },
  {
    id: 'split-2017',
    type: 'Split',
    announcementDate: '2017-06-15',
    recordDate: '2017-07-12',
    exDate: '2017-07-11',
    details: '1:2 Stock Split — face value reduced from ₹10 to ₹5',
  },

  // 2016
  {
    id: 'div-2016-final',
    type: 'Dividend',
    announcementDate: '2016-04-21',
    recordDate: '2016-06-24',
    exDate: '2016-06-23',
    details: '₹10.50 per share final dividend (pre-split)',
    amount: 10.50,
  },

  // 2015
  {
    id: 'div-2015-final',
    type: 'Dividend',
    announcementDate: '2015-04-23',
    recordDate: '2015-06-26',
    exDate: '2015-06-25',
    details: '₹10.50 per share final dividend (pre-split)',
    amount: 10.50,
  },
  {
    id: 'bonus-2015',
    type: 'Bonus',
    announcementDate: '2015-08-20',
    recordDate: '2015-09-25',
    exDate: '2015-09-24',
    details: '1:1 Bonus — 1 share for every 1 share held',
  },

  // Additional historical records
  {
    id: 'div-2014-final',
    type: 'Dividend',
    announcementDate: '2014-04-24',
    recordDate: '2014-06-27',
    exDate: '2014-06-26',
    details: '₹9.50 per share final dividend (pre-split)',
    amount: 9.50,
  },
  {
    id: 'div-2013-final',
    type: 'Dividend',
    announcementDate: '2013-04-25',
    recordDate: '2013-06-28',
    exDate: '2013-06-27',
    details: '₹9 per share final dividend (pre-split)',
    amount: 9.0,
  },
  {
    id: 'div-2019-interim',
    type: 'Dividend',
    announcementDate: '2019-10-18',
    recordDate: '2019-11-01',
    exDate: '2019-10-31',
    details: '₹6.50 per share special interim dividend',
    amount: 6.50,
  },
  {
    id: 'div-2018-interim',
    type: 'Dividend',
    announcementDate: '2018-10-19',
    recordDate: '2018-11-02',
    exDate: '2018-11-01',
    details: '₹5 per share interim dividend',
    amount: 5.0,
  },
  {
    id: 'div-2020-interim',
    type: 'Dividend',
    announcementDate: '2020-10-22',
    recordDate: '2020-11-06',
    exDate: '2020-11-05',
    details: '₹4 per share interim dividend',
    amount: 4.0,
  },
  {
    id: 'div-2021-interim',
    type: 'Dividend',
    announcementDate: '2021-10-21',
    recordDate: '2021-11-05',
    exDate: '2021-11-04',
    details: '₹4.50 per share interim dividend',
    amount: 4.50,
  },
  {
    id: 'div-2022-special',
    type: 'Dividend',
    announcementDate: '2022-10-27',
    recordDate: '2022-11-11',
    exDate: '2022-11-10',
    details: '₹5 per share special interim dividend',
    amount: 5.0,
  },
  {
    id: 'div-2023-special',
    type: 'Dividend',
    announcementDate: '2023-10-20',
    recordDate: '2023-11-03',
    exDate: '2023-11-02',
    details: '₹5 per share special interim dividend',
    amount: 5.0,
  },
  {
    id: 'div-2024-special',
    type: 'Dividend',
    announcementDate: '2024-10-24',
    recordDate: '2024-11-08',
    exDate: '2024-11-07',
    details: '₹5.50 per share special interim dividend',
    amount: 5.50,
  },
  {
    id: 'split-2020-rights',
    type: 'Rights',
    announcementDate: '2020-05-28',
    recordDate: '2020-06-15',
    exDate: '2020-06-12',
    details: '1:15 Rights Issue at ₹1,257 per share (₹314.25 per call)',
  },
]

// ─── Upcoming Events ──────────────────────────────────────────────────────────
export const upcomingEvents: UpcomingEvent[] = [
  {
    type: 'EarningsCall',
    date: '2025-07-18',
    title: 'Q1 FY26 Results & Earnings Call',
    description:
      'Reliance Industries will announce its Q1 FY26 (April–June 2025) quarterly results. An investor earnings call is scheduled at 5:00 PM IST.',
  },
  {
    type: 'AGM',
    date: '2025-08-28',
    title: 'Annual General Meeting (AGM) FY25',
    description:
      'Reliance Industries\' 47th Annual General Meeting. Expected to include announcements on new ventures, capex plans, and telecom/retail expansion updates.',
  },
  {
    type: 'BoardMeeting',
    date: '2025-07-17',
    title: 'Board Meeting — Q1 FY26 Financials',
    description:
      'Board meeting to consider and approve Q1 FY26 standalone and consolidated financial results.',
  },
  {
    type: 'Dividend',
    date: '2025-07-25',
    title: 'Interim Dividend Record Date',
    description:
      'Record date for the FY26 interim dividend (if declared at the board meeting). Shareholders on record will be eligible.',
  },
]

// ─── Dividend History (FY18–FY25) ─────────────────────────────────────────────
export const dividendHistory: DividendHistory[] = [
  { year: 'FY18', amount: 6.0 },
  { year: 'FY19', amount: 6.5 },
  { year: 'FY20', amount: 6.5 },
  { year: 'FY21', amount: 7.0 },
  { year: 'FY22', amount: 8.0 },
  { year: 'FY23', amount: 9.0 },
  { year: 'FY24', amount: 9.0 },
  { year: 'FY25', amount: 10.0 },
]
