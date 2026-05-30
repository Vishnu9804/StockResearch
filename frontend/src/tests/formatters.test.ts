/**
 * frontend/src/tests/formatters.test.ts
 * Unit tests for Indian formatting utility layer
 */

import { describe, it, expect } from 'vitest'
import {
  formatNumber,
  formatIndian,
  formatCrores,
  formatLakhs,
  formatPct,
  formatChange,
  formatMarketCap
} from '../lib/formatters'

describe('Indian Currency & Numeric Formatters', () => {
  it('should format numbers with standard decimals', () => {
    expect(formatNumber(12.3456, 2)).toBe('12.35')
    expect(formatNumber(12345.67, 1)).toBe('12345.7')
    expect(formatNumber(NaN)).toBe('—')
  })

  it('should format numbers into Indian Lakh/Crore systems', () => {
    expect(formatIndian(1234567)).toBe('12,34,567')
    expect(formatIndian(987654321)).toBe('98,76,54,321')
    expect(formatIndian(123)).toBe('123')
    expect(formatIndian(-1234567)).toBe('-12,34,567')
  })

  it('should format crore values with rupee prefix and Cr suffix', () => {
    expect(formatCrores(12345.678)).toBe('₹12,345.68 Cr')
    expect(formatCrores(-50.5)).toBe('-₹50.50 Cr')
  })

  it('should format lakhs correctly', () => {
    expect(formatLakhs(543.21)).toBe('₹543 L')
    expect(formatLakhs(-12.34)).toBe('-₹12 L')
  })

  it('should format percentages with signs', () => {
    expect(formatPct(15.65)).toBe('+15.65%')
    expect(formatPct(-5.2)).toBe('-5.20%')
    expect(formatPct(0)).toBe('+0.00%')
  })

  it('should format market caps intelligently based on limits', () => {
    expect(formatMarketCap(125000)).toBe('₹1.25L Cr') // Lakh crores
    expect(formatMarketCap(4500)).toBe('₹4,500 Cr')
    expect(formatMarketCap(450.5)).toBe('₹450.50 Cr')
  })
})
