import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/auth/logout - Also support GET for redirect scenarios
// POST /api/auth/logout - Main logout method (in session/route.ts)

// This route provides logout via GET for convenience
export async function GET() {
  const { clearSessionCookie } = await import('@/lib/auth')
  await clearSessionCookie()
  return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'))
}

export async function POST() {
  const { clearSessionCookie } = await import('@/lib/auth')
  await clearSessionCookie()
  return NextResponse.json({ success: true })
}
