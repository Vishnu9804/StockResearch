/**
 * backend/src/controllers/watchlist.ts
 * HTTP Controller for watchlist configurations
 */

import type { Response, NextFunction } from 'express'
import type { AuthenticatedRequest } from '../middlewares/auth.js'
import { prisma } from '../db/prisma.js'

export async function getWatchlists(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> {
  try {
    const userId = req.user!.id
    const watchlists = await prisma.watchlist.findMany({
      where: { userId },
      include: { items: true },
      orderBy: { createdAt: 'desc' }
    })
    
    return res.status(200).json({ success: true, watchlists })
  } catch (error) {
    next(error)
  }
}

export async function createWatchlist(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> {
  try {
    const userId = req.user!.id
    const { name } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ error: true, message: 'Please provide a valid watchlist name.' })
    }

    const newWl = await prisma.watchlist.create({
      data: {
        userId,
        name: name.trim()
      },
      include: { items: true }
    })

    return res.status(201).json({ success: true, watchlist: newWl })
  } catch (error) {
    next(error)
  }
}

export async function addItem(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> {
  try {
    const userId = req.user!.id
    const watchlistId = req.params.id
    const { symbol, targetPrice, alertEnabled } = req.body

    if (!symbol) {
      return res.status(400).json({ error: true, message: 'Please specify a company stock symbol.' })
    }

    // Verify watchlist ownership
    const wl = await prisma.watchlist.findFirst({
      where: { id: watchlistId, userId }
    })

    if (!wl) {
      return res.status(404).json({ error: true, message: 'Watchlist not found or unauthorized.' })
    }

    // Check if item already exists in watchlist
    const existing = await prisma.watchlistItem.findFirst({
      where: { watchlistId, symbol: symbol.toUpperCase() }
    })

    if (existing) {
      return res.status(409).json({ error: true, message: 'Stock already exists inside this watchlist.' })
    }

    const newItem = await prisma.watchlistItem.create({
      data: {
        watchlistId,
        symbol: symbol.toUpperCase(),
        targetPrice: targetPrice ? parseFloat(targetPrice) : null,
        alertEnabled: alertEnabled ?? false
      }
    })

    return res.status(201).json({ success: true, item: newItem })
  } catch (error) {
    next(error)
  }
}

export async function updateItem(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> {
  try {
    const userId = req.user!.id
    const { itemId } = req.params
    const { targetPrice, alertEnabled } = req.body

    // Verify ownership
    const item = await prisma.watchlistItem.findFirst({
      where: {
        id: itemId,
        watchlist: { userId }
      }
    })

    if (!item) {
      return res.status(404).json({ error: true, message: 'Watchlist item not found or unauthorized.' })
    }

    const updated = await prisma.watchlistItem.update({
      where: { id: itemId },
      data: {
        targetPrice: targetPrice !== undefined ? (targetPrice ? parseFloat(targetPrice) : null) : item.targetPrice,
        alertEnabled: alertEnabled !== undefined ? alertEnabled : item.alertEnabled
      }
    })

    return res.status(200).json({ success: true, item: updated })
  } catch (error) {
    next(error)
  }
}

export async function deleteItem(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> {
  try {
    const userId = req.user!.id
    const { itemId } = req.params

    // Verify ownership
    const item = await prisma.watchlistItem.findFirst({
      where: {
        id: itemId,
        watchlist: { userId }
      }
    })

    if (!item) {
      return res.status(404).json({ error: true, message: 'Watchlist item not found or unauthorized.' })
    }

    await prisma.watchlistItem.delete({ where: { id: itemId } })

    return res.status(200).json({ success: true, message: 'Stock removed from watchlist successfully.' })
  } catch (error) {
    next(error)
  }
}

export async function deleteWatchlist(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> {
  try {
    const userId = req.user!.id
    const { id } = req.params

    const wl = await prisma.watchlist.findFirst({
      where: { id, userId }
    })

    if (!wl) {
      return res.status(404).json({ error: true, message: 'Watchlist not found or unauthorized.' })
    }

    await prisma.watchlist.delete({ where: { id } })

    return res.status(200).json({ success: true, message: 'Watchlist deleted successfully.' })
  } catch (error) {
    next(error)
  }
}
