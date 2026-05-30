/**
 * backend/src/tests/payments.test.ts
 * Cryptographic signature and PayU checkout verification tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'crypto'

// Mock Prisma Client
vi.mock('../db/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    subscription: {
      create: vi.fn(),
      update: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
    $transaction: vi.fn((promises) => Promise.all(promises)),
  },
  default: {},
}))

import { PaymentsService } from '../services/payments.service.js'
import { CONFIG } from '../config/index.js'

describe('PaymentsService Hashing & Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should compute cryptographic checkout hash correctly matching PayU formula', async () => {
    const mockUser = {
      id: 'usr_test_123',
      name: 'John Doe',
      email: 'john@example.com',
      plan: 'FREE',
    }

    const { prisma } = await import('../db/prisma.js')
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
    vi.mocked(prisma.subscription.create).mockResolvedValue({} as any)

    const order = await PaymentsService.createPayuOrder(mockUser.id)

    expect(order).toBeDefined()
    expect(order.checkoutUrl).toBe(CONFIG.PAYU_CHECKOUT_URL)
    expect(order.params.key).toBe(CONFIG.PAYU_MERCHANT_KEY)
    expect(order.params.amount).toBe('4999.00')
    expect(order.params.productinfo).toBe('FinScreen Pro Yearly')
    expect(order.params.firstname).toBe(mockUser.name)
    expect(order.params.email).toBe(mockUser.email)
    expect(order.params.udf1).toBe(mockUser.id)
    expect(order.params.hash).toHaveLength(128) // SHA-512 hex length is 128 characters
  })

  it('should successfully verify a valid cryptographically signed webhook success callback', async () => {
    const txnid = 'txn_test_999'
    const amount = '4999.00'
    const productinfo = 'FinScreen Pro Yearly'
    const firstname = 'John Doe'
    const email = 'john@example.com'
    const udf1 = 'usr_test_123'
    const status = 'success'

    // Formula: sha512(salt|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
    const baseString = `${CONFIG.PAYU_MERCHANT_SALT}|${status}||||||||||${udf1}|${email}|${firstname}|${productinfo}|${amount}|${txnid}|${CONFIG.PAYU_MERCHANT_KEY}`
    const validHash = crypto.createHash('sha512').update(baseString).digest('hex')

    const { prisma } = await import('../db/prisma.js')
    vi.mocked(prisma.subscription.update).mockResolvedValue({} as any)
    vi.mocked(prisma.user.update).mockResolvedValue({} as any)
    vi.mocked(prisma.notification.create).mockResolvedValue({} as any)

    const result = await PaymentsService.processSuccessWebhook({
      status,
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      udf1,
      hash: validHash,
    })

    expect(result).toBe(txnid)
    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { payuTxnId: txnid },
        data: expect.objectContaining({ status: 'ACTIVE' }),
      })
    )
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: udf1 },
        data: { plan: 'PRO' },
      })
    )
  })

  it('should throw an error if the webhook success callback hash does not match (tampering detected)', async () => {
    const txnid = 'txn_test_999'
    const amount = '4999.00'
    const productinfo = 'FinScreen Pro Yearly'
    const firstname = 'John Doe'
    const email = 'john@example.com'
    const udf1 = 'usr_test_123'
    const status = 'success'
    const tamperedHash = 'invalid-signature-hash-value-12345'

    await expect(
      PaymentsService.processSuccessWebhook({
        status,
        txnid,
        amount,
        productinfo,
        firstname,
        email,
        udf1,
        hash: tamperedHash,
      })
    ).rejects.toThrow('hash_verification_failed')
  })
})
