/**
 * backend/src/services/payments.service.ts
 * Premium, production-ready payment flow service for PayU integration
 * Manages order state machines in DB, computes checkout hashes, and handles cryptographically signed webhooks.
 */

import crypto from 'crypto'
import { prisma } from '../db/prisma.js'
import { CONFIG } from '../config/index.js'
import { logger } from '../utils/logger.js'

// SHA-512 Hash Helper
function generateSha512Hash(str: string): string {
  return crypto.createHash('sha512').update(str).digest('hex')
}

export interface PayuOrderParameters {
  key: string
  txnid: string
  amount: string
  productinfo: string
  firstname: string
  email: string
  phone: string
  surl: string
  furl: string
  hash: string
  udf1: string
  service_provider: string
}

export const PaymentsService = {
  /**
   * Initializes a pending transaction order in our database
   * and builds cryptographically signed payload for PayU gateway
   */
  async createPayuOrder(userId: string, apiBaseUrl?: string): Promise<{ checkoutUrl: string; params: PayuOrderParameters }> {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      throw new Error('User not found.')
    }

    const amount = '4999.00'
    const productInfo = 'FinScreen Pro Yearly'
    const txnid = `txn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

    // Step 1. Register transaction in database (initially marked as FAILED until webhook validates it)
    await prisma.subscription.create({
      data: {
        userId,
        plan: 'PRO',
        status: 'FAILED',
        amount: parseFloat(amount),
        payuTxnId: txnid,
        payuOrderId: `order_${Date.now()}`,
      },
    })

    // Step 2. Compute cryptographically signed signature hash for PayU Gateway security
    // Formula: sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||salt)
    const hashString = `${CONFIG.PAYU_MERCHANT_KEY}|${txnid}|${amount}|${productInfo}|${user.name}|${user.email}|${userId}||||||||||${CONFIG.PAYU_MERCHANT_SALT}`
    const paymentHash = generateSha512Hash(hashString)

    logger.info(`[PaymentsService] Order successfully registered: ${txnid} for User: ${userId}`)

    const successUrl = apiBaseUrl ? `${apiBaseUrl.replace(/\/$/, '')}/payments/payu/success` : CONFIG.PAYU_SUCCESS_URL
    const failureUrl = apiBaseUrl ? `${apiBaseUrl.replace(/\/$/, '')}/payments/payu/failure` : CONFIG.PAYU_FAILURE_URL

    return {
      checkoutUrl: CONFIG.PAYU_CHECKOUT_URL,
      params: {
        key: CONFIG.PAYU_MERCHANT_KEY,
        txnid,
        amount,
        productinfo: productInfo,
        firstname: user.name,
        email: user.email,
        phone: '9999999999', // Test cell number
        surl: successUrl,
        furl: failureUrl,
        hash: paymentHash,
        udf1: userId,
        service_provider: 'payu_paisa',
      },
    }
  },


  /**
   * Validates cryptographically signed PayU success callback payloads,
   * activates subscription tier in the DB, and dispatches in-app alarms
   */
  async processSuccessWebhook(body: {
    status: string
    txnid: string
    amount: string
    productinfo: string
    firstname: string
    email: string
    udf1: string
    hash: string
    additionalCharges?: string
  }): Promise<string> {
    const { status, txnid, amount, productinfo, firstname, email, udf1, hash, additionalCharges } = body

    logger.info(`[PaymentsService] Validating webhook signature for transaction: ${txnid}`)

    // Formula: sha512(salt|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
    let baseString = `${status}||||||||||${udf1}|${email}|${firstname}|${productinfo}|${amount}|${txnid}|${CONFIG.PAYU_MERCHANT_KEY}`
    if (additionalCharges) {
      baseString = `${additionalCharges}|${CONFIG.PAYU_MERCHANT_SALT}|${baseString}`
    } else {
      baseString = `${CONFIG.PAYU_MERCHANT_SALT}|${baseString}`
    }

    const calculatedHash = generateSha512Hash(baseString)

    if (calculatedHash !== hash) {
      logger.error(`[PaymentsService] Cryptographic mismatch! Potential fraud attempt on transaction: ${txnid}`)
      throw new Error('hash_verification_failed')
    }

    // Signature matches cleanly! Upgrade user tier within a single transactional pipeline
    await prisma.$transaction([
      prisma.subscription.update({
        where: { payuTxnId: txnid },
        data: {
          status: 'ACTIVE',
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 Year Active plan
        },
      }),
      prisma.user.update({
        where: { id: udf1 },
        data: { plan: 'PRO' },
      }),
      prisma.notification.create({
        data: {
          userId: udf1,
          type: 'info',
          title: 'Premium Activated ⚡',
          body: 'Thank you! Your FinScreen Pro subscription is now active. Enjoy full 15-year financial statements and unlimited screener alarms.',
          actionUrl: '/',
        },
      }),
    ])

    logger.info(`[PaymentsService] User ${udf1} cleanly upgraded to PRO via verified transaction: ${txnid}`)
    return txnid
  },

  /**
   * Processes failures and marks transaction attempts in-line
   */
  async processFailureWebhook(body: { txnid: string; udf1?: string; message?: string }): Promise<void> {
    const { txnid, message } = body
    logger.warn(`[PaymentsService] Payment transaction failed for ${txnid}. Reason: ${message}`)

    await prisma.subscription
      .update({
        where: { payuTxnId: txnid },
        data: { status: 'FAILED' },
      })
      .catch((err) => {
        logger.error(`[PaymentsService] Order failed status update skipped for ${txnid}: ${err.message}`)
      })
  },
}

export default PaymentsService
