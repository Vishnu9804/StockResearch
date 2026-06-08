import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { exportToCSV } from '@/utils/csv'

describe('CSV export utility tests', () => {
  let createdElement: any

  beforeEach(() => {
    createdElement = {
      setAttribute: vi.fn(),
      style: { visibility: 'visible' },
      click: vi.fn(),
    }
    
    // Mock document.createElement to return our mock element
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'a') return createdElement
      return {} as any
    })
    
    // Mock document.body.appendChild/removeChild
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => ({} as any))
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => ({} as any))
    
    // Mock URL.createObjectURL and URL.revokeObjectURL
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('mock-url')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('should format CSV cells and trigger document download', () => {
    const headers = ['Name', 'Value', 'Details']
    const rows = [
      ['Reliance', 2400.5, 'Active, high-cap'],
      ['TCS', 3200, 'Clean "IT" service'],
      [null, undefined, 'Empty cells test'],
    ]

    exportToCSV('test_stocks.csv', headers, rows as any)

    // Verify URL was created from blob
    expect(URL.createObjectURL).toHaveBeenCalled()
    
    // Verify file link properties were configured
    expect(document.createElement).toHaveBeenCalledWith('a')
    expect(createdElement.setAttribute).toHaveBeenCalledWith('href', 'mock-url')
    expect(createdElement.setAttribute).toHaveBeenCalledWith('download', 'test_stocks.csv')
    expect(createdElement.style.visibility).toBe('hidden')
    expect(createdElement.click).toHaveBeenCalled()
  })
})
