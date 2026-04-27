import { db } from '@/lib/db'
import { generateToken, generateTempPassword, hashPassword } from '@/lib/auth'
import { sendEmail, credentialsTemplate } from '@/lib/email'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/auth/init - Initialize credentials for a first-time user
// Generates a temp password and token, sends them via email
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

    // If already has password, don't allow re-init
    if (department.passwordHash) {
      return NextResponse.json(
        { error: 'Esta cuenta ya tiene una contraseña configurada. Use la opción de inicio de sesión normal.' },
        { status: 400 }
      )
    }

    // Generate temp password and security token
    const tempPassword = generateTempPassword()
    const token = generateToken()
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Hash the temp password and store token
    const hashedTempPassword = await hashPassword(tempPassword)

    await db.department.update({
      where: { id: department.id },
      data: {
        passwordHash: hashedTempPassword,
        loginToken: token,
        loginTokenExpires: tokenExpires,
      },
    })

    // Send credentials email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const html = credentialsTemplate({
      responsibleName: department.responsibleName,
      departmentName: department.name,
      email: department.email,
      tempPassword,
      token,
      appUrl,
    })

    const emailResult = await sendEmail({
      to: department.email,
      subject: '🔐 Credenciales de Acceso - Sistema de Control GEOCUBA',
      html,
      emailType: 'CREDENCIALES',
    })

    if (!emailResult.success) {
      console.error('Error enviando credenciales:', emailResult.error)
      // Still return success but note email issue
      return NextResponse.json({
        success: true,
        message: 'Credenciales generadas pero hubo un error al enviar el correo. Contacte al administrador.',
        emailSent: false,
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Credenciales enviadas a su correo electrónico. Revise su bandeja de entrada.',
      emailSent: true,
    })
  } catch (error) {
    console.error('Error inicializando credenciales:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
