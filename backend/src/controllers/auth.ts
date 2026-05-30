import type { Response, NextFunction } from 'express'
import bcrypt from 'bcrypt'
import { prisma } from '../utils/prisma.js'
import { generateAccessToken, generateRefreshToken } from '../utils/token.js'
import { CONFIG } from '../config/index.js'
import type { AuthenticatedRequest } from '../middlewares/auth.js'

export async function signup(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> {
  try {
    const { email, password, name } = req.body

    if (!email || !password || !name) {
      return res.status(400).json({ error: true, message: 'Please provide name, email, and password.' })
    }

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return res.status(409).json({ error: true, message: 'An account with this email already exists.' })
    }

    const salt = await bcrypt.genSalt(10)
    const passwordHash = await bcrypt.hash(password, salt)

    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        plan: 'FREE'
      }
    })

    // Create a new session
    const refreshToken = generateRefreshToken(user.id)
    const accessToken = generateAccessToken(user.id, user.plan)

    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        expiresAt: new Date(Date.now() + CONFIG.REFRESH_TOKEN_EXPIRY)
      }
    })

    // Set HTTP-only cookies
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: CONFIG.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: CONFIG.REFRESH_TOKEN_EXPIRY
    })

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: CONFIG.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000 // 15 mins
    })

    return res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan
      },
      accessToken
    })
  } catch (error) {
    next(error)
  }
}

export async function login(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> {
  try {
    const { email, password, rememberMe } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: true, message: 'Please provide email and password.' })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: true, message: 'Invalid email or password.' })
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash)
    if (!isMatch) {
      return res.status(401).json({ error: true, message: 'Invalid email or password.' })
    }

    // Set custom session length if "Remember Me" is enabled
    const expiryDuration = rememberMe ? 30 * 24 * 60 * 60 * 1000 : CONFIG.REFRESH_TOKEN_EXPIRY

    // Create session in DB
    const refreshToken = generateRefreshToken(user.id)
    const accessToken = generateAccessToken(user.id, user.plan)

    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        expiresAt: new Date(Date.now() + expiryDuration)
      }
    })

    // Set HTTP-only cookies
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: CONFIG.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: expiryDuration
    })

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: CONFIG.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000 // 15 mins
    })

    return res.status(200).json({
      success: true,
      message: 'Logged in successfully.',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan
      },
      accessToken
    })
  } catch (error) {
    next(error)
  }
}

export async function profile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> {
  try {
    if (!req.user) {
      return res.status(401).json({ error: true, message: 'Unauthorized' })
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    })

    if (!user) {
      return res.status(404).json({ error: true, message: 'User not found.' })
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan
      }
    })
  } catch (error) {
    next(error)
  }
}

export async function logout(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> {
  try {
    const refreshToken = req.cookies?.refreshToken

    if (refreshToken) {
      // Invalidate in DB
      await prisma.session.delete({ where: { refreshToken } }).catch(() => {})
    }

    // Clear cookies
    res.clearCookie('refreshToken')
    res.clearCookie('accessToken')

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully.'
    })
  } catch (error) {
    next(error)
  }
}
