import jwt, { type Secret, type SignOptions } from 'jsonwebtoken'
import { CONFIG } from '../config/index.js'

interface AccessTokenPayload {
  userId: string
  plan: string
}

interface RefreshTokenPayload {
  userId: string
}

export function generateAccessToken(userId: string, plan: string): string {
  return jwt.sign(
    { userId, plan },
    CONFIG.JWT_ACCESS_SECRET as Secret,
    { expiresIn: CONFIG.ACCESS_TOKEN_EXPIRY } as SignOptions
  )
}

export function generateRefreshToken(userId: string): string {
  return jwt.sign(
    { userId },
    CONFIG.JWT_REFRESH_SECRET as Secret,
    { expiresIn: '7d' } as SignOptions
  )
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, CONFIG.JWT_ACCESS_SECRET as Secret) as AccessTokenPayload
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, CONFIG.JWT_REFRESH_SECRET as Secret) as RefreshTokenPayload
}
