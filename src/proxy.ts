import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'geocuba-scei-secret-key-change-in-production-2026'
)

const COOKIE_NAME = 'geocuba_session'

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/login', '/admin', '/api/auth', '/api/admin', '/api/departments/seed', '/api/health']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public routes
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    // If already authenticated and trying to access login, redirect to home
    if (pathname === '/login') {
      const token = request.cookies.get(COOKIE_NAME)?.value
      if (token) {
        try {
          await jwtVerify(token, JWT_SECRET)
          return NextResponse.redirect(new URL('/', request.url))
        } catch {
          // Token invalid, continue to login
        }
      }
    }
    return NextResponse.next()
  }

  // Allow static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.') // static files
  ) {
    return NextResponse.next()
  }

  // Check for session cookie
  const token = request.cookies.get(COOKIE_NAME)?.value

  if (!token) {
    // For API routes, return 401 instead of redirecting
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'No autenticado', authenticated: false },
        { status: 401 }
      )
    }
    // For page routes, redirect to login
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  try {
    // Verify the JWT token
    await jwtVerify(token, JWT_SECRET)
    return NextResponse.next()
  } catch {
    // Token is invalid or expired, redirect to login
    const loginUrl = new URL('/login', request.url)
    const response = NextResponse.redirect(loginUrl)
    // Clear the invalid cookie
    response.cookies.delete(COOKIE_NAME)
    return response
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
