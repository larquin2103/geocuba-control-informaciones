import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/auth/check - Check if an email exists and if it has a password set
// This is a public endpoint used in the login flow before authentication
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Correo electrónico es requerido' },
        { status: 400 }
      )
    }

    // Find department by email
    const department = await db.department.findFirst({
      where: { email: email.toLowerCase().trim() },
    })

    if (!department) {
      return NextResponse.json(
        { error: 'No se encontró una dirección con ese correo electrónico' },
        { status: 404 }
      )
    }

    if (!department.active) {
      return NextResponse.json(
        { error: 'Esta cuenta está desactivada. Contacte al administrador.' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      exists: true,
      hasPassword: !!department.passwordHash,
      departmentName: department.name,
      responsibleName: department.responsibleName,
    })
  } catch (error) {
    console.error('Error verificando correo:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
