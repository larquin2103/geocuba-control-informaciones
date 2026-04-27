import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/auth/verify-token - Verify security token during first-time setup
export async function POST(request: NextRequest) {
  try {
    const { email, password, token } = await request.json()

    if (!email || !password || !token) {
      return NextResponse.json(
        { error: 'Correo, contraseña y token son requeridos' },
        { status: 400 }
      )
    }

    // Find department
    const department = await db.department.findFirst({
      where: { email: email.toLowerCase().trim() },
    })

    if (!department) {
      return NextResponse.json(
        { error: 'Cuenta no encontrada' },
        { status: 404 }
      )
    }

    // Verify temp password
    if (!department.passwordHash) {
      return NextResponse.json(
        { error: 'Debe inicializar sus credenciales primero' },
        { status: 400 }
      )
    }

    const isValidPassword = await verifyPassword(password, department.passwordHash)
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Contraseña temporal incorrecta' },
        { status: 401 }
      )
    }

    // Verify security token
    if (department.loginToken !== token) {
      return NextResponse.json(
        { error: 'Token de seguridad incorrecto' },
        { status: 401 }
      )
    }

    // Check token expiration
    if (department.loginTokenExpires && new Date() > department.loginTokenExpires) {
      return NextResponse.json(
        { error: 'El token de seguridad ha expirado. Solicite nuevas credenciales.' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Token verificado correctamente',
      departmentId: department.id,
    })
  } catch (error) {
    console.error('Error verificando token:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
