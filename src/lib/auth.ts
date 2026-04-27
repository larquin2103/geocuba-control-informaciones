import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

// ============================================================================
// AUTH CONFIGURATION
// ============================================================================

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'geocuba-scei-secret-key-change-in-production-2026'
)

const COOKIE_NAME = 'geocuba_session'

const SESSION_DURATION = '8h' // Duración de la sesión

export interface SessionData {
  departmentId: string
  email: string
  departmentName: string
  responsibleName: string
  departmentType: string
  isDirectorGeneral: boolean
}

// ============================================================================
// PASSWORD UTILITIES
// ============================================================================

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

/**
 * Verify a password against its hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/**
 * Generate a secure random token for first-time login
 */
export function generateToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Generate a random temporary password (6 digits)
 */
export function generateTempPassword(): string {
  const array = new Uint8Array(3)
  crypto.getRandomValues(array)
  return Array.from(array, byte => (byte % 10).toString()).join('') +
    Array.from(array, byte => (byte % 10).toString()).join('') +
    Math.floor(Math.random() * 100).toString().padStart(2, '0')
}

// ============================================================================
// JWT SESSION UTILITIES
// ============================================================================

/**
 * Create a JWT session token
 */
export async function createSessionToken(data: SessionData): Promise<string> {
  return new SignJWT({ ...data })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(SESSION_DURATION)
    .sign(JWT_SECRET)
}

/**
 * Verify and decode a JWT session token
 */
export async function verifySessionToken(token: string): Promise<SessionData | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as SessionData
  } catch {
    return null
  }
}

// ============================================================================
// COOKIE UTILITIES
// ============================================================================

/**
 * Set the session cookie
 */
export async function setSessionCookie(token: string) {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 8, // 8 hours
    path: '/',
  })
}

/**
 * Get the current session from cookies
 */
export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifySessionToken(token)
}

/**
 * Clear the session cookie (logout)
 */
export async function clearSessionCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}
