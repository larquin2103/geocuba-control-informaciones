import { getSession, clearSessionCookie } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/auth/session - Get current session
export async function GET() {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json(
        { authenticated: false },
        { status: 401 }
      )
    }

    return NextResponse.json({
      authenticated: true,
      user: session,
    })
  } catch (error) {
    console.error('Error obteniendo sesión:', error)
    return NextResponse.json(
      { authenticated: false },
      { status: 401 }
    )
  }
}

// POST /api/auth/logout - Logout
export async function POST() {
  try {
    await clearSessionCookie()
    return NextResponse.json({ success: true, message: 'Sesión cerrada' })
  } catch (error) {
    console.error('Error cerrando sesión:', error)
    return NextResponse.json(
      { error: 'Error al cerrar sesión' },
      { status: 500 }
    )
  }
}
