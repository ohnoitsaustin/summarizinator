import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET!

export type JWTPayload = { sub: string; email: string; githubLogin: string }

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, SECRET) as JWTPayload
}
