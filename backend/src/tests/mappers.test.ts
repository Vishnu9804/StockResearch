import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request, Response } from 'express'
import { FinedgeService } from '../services/finedge.service.js'
import {
  getCompanyPL,
  getCompanyBalanceSheet,
  getCompanyCashFlow,
  getCompanyRatios,
  getCompanyShareholding,
  getCorporateActions,
  getCompanyDocuments
} from '../controllers/finedge.js'

// Mock FinedgeService
vi.mock('../services/finedge.service.js', () => {
  return {
    FinedgeService: {
      executeProxyRequest: vi.fn(),
    },
  }
})

describe('FinEdge Controller Data Mappers', () => {
  let mockReq: Partial<Request>
  let mockRes: Partial<Response>
  let statusMock: any
  let jsonMock: any

  beforeEach(() => {
    vi.clearAllMocks()
    jsonMock = vi.fn()
    statusMock = vi.fn().mockReturnValue({ json: jsonMock })
    mockReq = {
      params: { symbol: 'RELIANCE' },
      query: {},
      body: {},
      headers: {}
    }
    mockRes = {
      status: statusMock,
    }
  })

  it('should map P&L data correctly converting values to Crores', async () => {
    vi.mocked(FinedgeService.executeProxyRequest).mockResolvedValueOnce({
      symbol: 'RELIANCE',
      financials: [
        {
          year: 2026,
          period_end: 20260331,
          revenueFromOperations: 5000000000000, // 500,000 Crores
          expenses: 4000000000000,
          costOfMaterialsConsumed: 3000000000000,
          employeeBenefitExpense: 500000000000,
          otherExpenses: 500000000000,
          depreciationAndAmortisation: 100000000000,
          financeCosts: 50000000000,
          otherIncome: 20000000000,
          profitBeforeTax: 870000000000,
          taxExpense: 200000000000,
          profitLossForPeriod: 670000000000,
          eps: 55.4
        }
      ]
    })

    await getCompanyPL(mockReq as Request, mockRes as Response)

    expect(statusMock).toHaveBeenCalledWith(200)
    const data = jsonMock.mock.calls[0][0]
    expect(data).toBeDefined()
    expect(Array.isArray(data.columns)).toBe(true)
    expect(data.columns[0]).toBe('Mar 2026')
    expect(Array.isArray(data.rows)).toBe(true)

    // Check Revenue row
    const revRow = data.rows.find((r: any) => r.label === 'Revenue from Operations')
    expect(revRow).toBeDefined()
    expect(revRow.values[0]).toBe(500000) // 5000000000000 / 1e7

    // Check EPS row
    const epsRow = data.rows.find((r: any) => r.label === 'EPS (₹)')
    expect(epsRow).toBeDefined()
    expect(epsRow.values[0]).toBe(55.4) // No division for EPS
  })

  it('should return null directly for ratios to trigger frontend calculations', async () => {
    await getCompanyRatios(mockReq as Request, mockRes as Response)
    expect(statusMock).toHaveBeenCalledWith(200)
    expect(jsonMock).toHaveBeenCalledWith(null)
  })

  it('should format quarterly shareholding pattern correctly', async () => {
    vi.mocked(FinedgeService.executeProxyRequest).mockResolvedValueOnce({
      columns: ['Mar 2026', 'Dec 2025'],
      rows: [
        {
          catagory: 'Indian',
          data: { 'Mar 2026': 50.33, 'Dec 2025': 50.33 }
        },
        {
          catagory: 'InstitutionsForeign',
          data: { 'Mar 2026': 22.78, 'Dec 2025': 22.82 }
        },
        {
          catagory: 'InstitutionsDomestic',
          data: { 'Mar 2026': 16.04, 'Dec 2025': 16.00 }
        },
        {
          catagory: 'NonInstitutions',
          data: { 'Mar 2026': 10.85, 'Dec 2025': 10.85 }
        }
      ]
    })

    await getCompanyShareholding(mockReq as Request, mockRes as Response)

    expect(statusMock).toHaveBeenCalledWith(200)
    const data = jsonMock.mock.calls[0][0]
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBe(2)

    expect(data[0]).toEqual({
      quarter: "Mar'26",
      promoter: 50.33,
      fii: 22.78,
      dii: 16.04,
      public: 10.85,
      others: 0
    })
  })

  it('should map corporate actions and construct dynamic fields', async () => {
    vi.mocked(FinedgeService.executeProxyRequest).mockResolvedValueOnce([
      {
        symbol: 'RELIANCE',
        ex_date: '05-Jun-2026',
        action: 'dividend',
        subject: 'Final Dividend  - Rs. 6',
        amount: 6
      }
    ])

    await getCorporateActions(mockReq as Request, mockRes as Response)

    expect(statusMock).toHaveBeenCalledWith(200)
    const data = jsonMock.mock.calls[0][0]
    expect(data.corporateActions).toBeDefined()
    expect(data.upcomingEvents).toBeDefined()
    expect(data.dividendHistory).toBeDefined()

    expect(data.corporateActions[0].exDate).toBe('2026-06-05')
    expect(data.corporateActions[0].type).toBe('Dividend')
    expect(data.dividendHistory[0]).toEqual({ year: '2026', amount: 6 })
  })

  it('should categorize corporate documents based on keyword rules', async () => {
    vi.mocked(FinedgeService.executeProxyRequest).mockResolvedValueOnce([
      {
        category: 'Updates',
        description: 'Press Release - Q4 & FY26 Audited Financial Results',
        announcement_date: '2026-06-10 16:23:17',
        timestamp_unix: 1781088797
      },
      {
        category: 'Newspaper Publication',
        description: 'Crisil AAA Credit Rating Report',
        announcement_date: '2026-06-05 10:00:00',
        timestamp_unix: 1780617600
      }
    ])

    await getCompanyDocuments(mockReq as Request, mockRes as Response)

    expect(statusMock).toHaveBeenCalledWith(200)
    const data = jsonMock.mock.calls[0][0]
    expect(Array.isArray(data.documents)).toBe(true)
    expect(data.documents.length).toBe(2)

    expect(data.documents[0].category).toBe('announcement') // press release
    expect(data.documents[1].category).toBe('credit-rating') // rating report
  })
})
