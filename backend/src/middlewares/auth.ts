import type { Request, Response, NextFunction } from 'express'
import { verifyAccessToken, verifyRefreshToken, generateAccessToken, generateRefreshToken } from '../utils/token.js'
import { prisma } from '../utils/prisma.js'
import { CONFIG } from '../config/index.js'

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    plan: string
    email: string
  }
}

async function handleRefreshTokenFlow(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> {
  const refreshToken = req.cookies?.refreshToken

  if (!refreshToken) {
    return res.status(401).json({ error: true, message: 'Session expired. Please sign in again.' })
  }

  try {
    verifyRefreshToken(refreshToken)

    // Lookup session in DB
    const dbSession = await prisma.session.findUnique({
      where: { refreshToken },
      include: { user: true }
    })

    if (!dbSession || dbSession.expiresAt < new Date()) {
      // Session revoked or expired
      if (dbSession) {
        await prisma.session.delete({ where: { id: dbSession.id } }).catch(() => {})
      }
      res.clearCookie('refreshToken')
      res.clearCookie('accessToken')
      return res.status(401).json({ error: true, message: 'Session revoked or expired. Please sign in again.' })
    }

    // Session valid! Rotate session refresh token (prevents replay attacks)
    const newRefreshToken = generateRefreshToken(dbSession.userId)
    const newAccessToken = generateAccessToken(dbSession.userId, dbSession.user.plan)

    // Update in DB
    await prisma.session.update({
      where: { id: dbSession.id },
      data: {
        refreshToken: newRefreshToken,
        expiresAt: new Date(Date.now() + CONFIG.REFRESH_TOKEN_EXPIRY)
      }
    })

    // Set updated cookies
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: CONFIG.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: CONFIG.REFRESH_TOKEN_EXPIRY
    })

    res.cookie('accessToken', newAccessToken, {
      httpOnly: true,
      secure: CONFIG.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000 // 15 mins
    })

    // Populate request object
    req.user = {
      id: dbSession.user.id,
      plan: dbSession.user.plan,
      email: dbSession.user.email
    }

    // Attach fresh access token to header so frontend can fetch it
    res.setHeader('X-New-Access-Token', newAccessToken)

    return next()
  } catch (err) {
    res.clearCookie('refreshToken')
    res.clearCookie('accessToken')
    return res.status(401).json({ error: true, message: 'Session invalid. Please sign in again.' })
  }
}

export async function authGuard(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> {
  try {
    const authHeader = req.headers['authorization']
    let token = ''

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7)
    }

    if (!token) {
      // Check cookies
      token = req.cookies?.accessToken || ''
    }

    if (!token) {
      // Try refresh token if no access token is found
      return await handleRefreshTokenFlow(req, res, next)
    }

    try {
      const decoded = verifyAccessToken(token)
      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId }
      })
      
      if (!user) {
        return res.status(401).json({ error: true, message: 'User no longer exists.' })
      }

      req.user = {
        id: user.id,
        plan: user.plan,
        email: user.email
      }
      return next()
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        // Access token expired, attempt refresh flow automatically!
        return await handleRefreshTokenFlow(req, res, next)
      }
      return res.status(401).json({ error: true, message: 'Invalid access token.' })
    }
  } catch (error) {
    next(error)
  }
}

export default authGuard
