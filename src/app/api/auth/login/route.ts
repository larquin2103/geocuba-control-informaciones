import { db } from '@/lib/db'
import { verifyPassword, generateToken, generateTempPassword, hashPassword, createSessionToken, setSessionCookie } from '@/lib/auth'
import { sendEmail, credentialsTemplate } from '@/lib/email'
import { NextResponse } from 'next/server'

// POST /api/auth/login - Authenticate a department head
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Correo y contraseña son requeridos' },
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
        { status: 401 }
      )
    }

    // Check if this is first-time login (no password set yet)
    if (!department.passwordHash) {
      return NextResponse.json(
        { error: 'FIRST_TIME_LOGIN', message: 'Debe configurar su contraseña primero. Se enviarán credenciales a su correo.' },
        { status: 403 }
      )
    }

    // Verify password
    const isValid = await verifyPassword(password, department.passwordHash)
    if (!isValid) {
      return NextResponse.json(
        { error: 'Contraseña incorrecta' },
        { status: 401 }
      )
    }

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

    // Update last login
    await db.department.update({
      where: { id: department.id },
      data: { lastLoginAt: new Date() },
    })

    return NextResponse.json({
      success: true,
      user: sessionData,
    })
  } catch (error) {
    console.error('Error en login:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

import { NextRequest } from 'next/server'
