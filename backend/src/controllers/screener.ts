/**
 * backend/src/controllers/screener.ts
 * HTTP Controller for saved stock screeners and notification systems
 */

import type { Response, NextFunction } from 'express'
import type { AuthenticatedRequest } from '../middlewares/auth.js'
import { prisma } from '../db/prisma.js'

export async function getSavedScreens(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> {
  try {
    const userId = req.user!.id
    const saved = await prisma.savedScreen.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    })
    return res.status(200).json({ success: true, screens: saved })
  } catch (error) {
    next(error)
  }
}

export async function saveScreen(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> {
  try {
    const userId = req.user!.id
    const { name, description, queryText, alertEnabled, alertFrequency } = req.body

    if (!name || !queryText) {
      return res.status(400).json({ error: true, message: 'Please provide screen name and query filters.' })
    }

    const saved = await prisma.savedScreen.create({
      data: {
        userId,
        name,
        description,
        queryText,
        alertEnabled: alertEnabled ?? false,
        alertFrequency: alertFrequency || 'IMMEDIATE'
      }
    })

    return res.status(201).json({ success: true, screen: saved })
  } catch (error) {
    next(error)
  }
}

export async function deleteScreen(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> {
  try {
    const userId = req.user!.id
    const { id } = req.params

    const screen = await prisma.savedScreen.findFirst({
      where: { id, userId }
    })

    if (!screen) {
      return res.status(404).json({ error: true, message: 'Saved screen not found or unauthorized.' })
    }

    await prisma.savedScreen.delete({ where: { id } })
    return res.status(200).json({ success: true, message: 'Saved screen deleted successfully.' })
  } catch (error) {
    next(error)
  }
}

export async function getNotifications(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> {
  try {
    const userId = req.user!.id
    const notifs = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50
    })

    const unreadCount = await prisma.notification.count({
      where: { userId, read: false }
    })

    return res.status(200).json({ success: true, notifications: notifs, unreadCount })
  } catch (error) {
    next(error)
  }
}

export async function markNotificationRead(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> {
  try {
    const userId = req.user!.id
    const { id } = req.params

    const notif = await prisma.notification.findFirst({
      where: { id, userId }
    })

    if (!notif) {
      return res.status(404).json({ error: true, message: 'Notification not found or unauthorized.' })
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { read: true }
    })

    return res.status(200).json({ success: true, notification: updated })
  } catch (error) {
    next(error)
  }
}

export async function markAllNotificationsRead(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> {
  try {
    const userId = req.user!.id

    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true }
    })

    return res.status(200).json({ success: true, message: 'All notifications marked as read.' })
  } catch (error) {
    next(error)
  }
}
