import { Router } from 'express'
import { signup, login, profile, logout } from '../controllers/auth.js'
import { authGuard } from '../middlewares/auth.js'
import { validateRequest, signupSchema, loginSchema } from '../middlewares/validation.js'

export const authRouter = Router()

authRouter.post('/signup', validateRequest({ body: signupSchema }), signup)
authRouter.post('/login', validateRequest({ body: loginSchema }), login)
authRouter.post('/logout', logout)
authRouter.get('/profile', authGuard, profile)

export default authRouter
