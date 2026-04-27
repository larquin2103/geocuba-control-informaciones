import { db } from '@/lib/db'
import { hashPassword, createSessionToken, setSessionCookie } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/auth/setup-password - Set new password after token verification
export async function POST(request: NextRequest) {
  try {
    const { departmentId, newPassword } = await request.json()

    if (!departmentId || !newPassword) {
      return NextResponse.json(
        { error: 'ID de departamento y nueva contraseña son requeridos' },
        { status: 400 }
      )
    }

    // Validate password strength
    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 6 caracteres' },
        { status: 400 }
      )
    }

    // Find department
    const department = await db.department.findUnique({
      where: { id: departmentId },
    })

    if (!department) {
      return NextResponse.json(
        { error: 'Departamento no encontrado' },
        { status: 404 }
      )
    }

    // Hash the new password
    const hashedPassword = await hashPassword(newPassword)

    // Update: set new password, clear token, update last login
    await db.department.update({
      where: { id: departmentId },
      data: {
        passwordHash: hashedPassword,
        loginToken: null,
        loginTokenExpires: null,
        lastLoginAt: new Date(),
      },
    })

    // Create session
    const isDirectorGeneral = department.name === 'Director General'
    const sessionData = {
      departmentId: department.id,
      email: department.email,
      departmentName: department.name,
      responsibleName: department.responsibleName,
      departmentType: department.type,
      isDirectorGeneral,
    }

    const token = await createSessionToken(sessionData)
    await setSessionCookie(token)

    return NextResponse.json({
      success: true,
      message: 'Contraseña configurada exitosamente',
      user: sessionData,
    })
  } catch (error) {
    console.error('Error configurando contraseña:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
