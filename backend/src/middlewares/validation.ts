/**
 * backend/src/middlewares/validation.ts
 * Reusable Express request validation middleware using Zod schemas
 */

import type { Request, Response, NextFunction } from 'express'
import { z, ZodError } from 'zod'

export function validateRequest(schemas: {
  body?: z.ZodSchema<any>
  query?: z.ZodSchema<any>
  params?: z.ZodSchema<any>
}) {
  return async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body)
      }
      if (schemas.query) {
        req.query = await schemas.query.parseAsync(req.query)
      }
      if (schemas.params) {
        req.params = await schemas.params.parseAsync(req.params)
      }
      return next()
    } catch (error) {
      if (error instanceof ZodError) {
        const errorDetails = error.issues.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }))
        return res.status(400).json({
          error: true,
          message: 'Invalid request payload validation failed.',
          details: errorDetails,
        })
      }
      return next(error)
    }
  }
}

// ----------------------------------------------------
// STRICT SCHEMAS FOR FINSCREEN API
// ----------------------------------------------------

export const signupSchema = z.object({
  email: z.string().email('Please specify a valid email address.'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long.')
    .max(100, 'Password is too long.'),
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters long.')
    .max(50, 'Name must be under 50 characters.'),
})

export const loginSchema = z.object({
  email: z.string().email('Please specify a valid email address.'),
  password: z.string(),
  rememberMe: z.boolean().optional(),
})

export const watchlistSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Watchlist name cannot be empty.')
    .max(50, 'Watchlist name must be under 50 characters.'),
})

export const watchlistAddItemSchema = z.object({
  symbol: z
    .string()
    .trim()
    .min(1)
    .max(10)
    .toUpperCase(),
  targetPrice: z
    .union([z.number().positive(), z.string().transform((v) => parseFloat(v)).pipe(z.number().positive())])
    .nullable()
    .optional(),
  alertEnabled: z.boolean().optional(),
})

export const watchlistUpdateItemSchema = z.object({
  targetPrice: z
    .union([z.number().positive(), z.string().transform((v) => parseFloat(v)).pipe(z.number().positive())])
    .nullable()
    .optional(),
  alertEnabled: z.boolean().optional(),
})

export const saveScreenSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Screen name cannot be empty.')
    .max(100, 'Screen name must be under 100 characters.'),
  description: z.string().max(500, 'Description must be under 500 characters.').optional().nullable(),
  queryText: z.string().min(1, 'Query text cannot be empty.'),
  alertEnabled: z.boolean().optional(),
  alertFrequency: z.enum(['IMMEDIATE', 'DAILY', 'WEEKLY']).optional(),
})
