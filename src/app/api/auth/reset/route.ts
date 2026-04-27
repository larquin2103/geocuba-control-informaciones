import { db } from '@/lib/db'
import { generateToken, generateTempPassword, hashPassword } from '@/lib/auth'
import { sendEmail, credentialsTemplate } from '@/lib/email'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/auth/reset - Reset credentials for a user who forgot their password
// Generates a new temp password and token, sends them via email
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

    // Generate new temp password and security token
    const tempPassword = generateTempPassword()
    const token = generateToken()
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Hash the new temp password and store token
    const hashedTempPassword = await hashPassword(tempPassword)

    await db.department.update({
      where: { id: department.id },
      data: {
        passwordHash: hashedTempPassword,
        loginToken: token,
        loginTokenExpires: tokenExpires,
      },
    })

    // Try to send credentials email
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
      subject: '🔐 Credenciales Reestablecidas - Sistema de Control GEOCUBA',
      html,
      emailType: 'CREDENCIALES',
    })

    if (!emailResult.success) {
      console.error('Error enviando credenciales reset:', emailResult.error)
      // Return credentials on screen since email failed
      return NextResponse.json({
        success: true,
        message: 'No se pudo enviar el correo. Sus nuevas credenciales se muestran abajo. Guarde esta información.',
        emailSent: false,
        tempPassword,
        token,
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Nuevas credenciales enviadas a su correo electrónico. Revise su bandeja de entrada.',
      emailSent: true,
    })
  } catch (error) {
    console.error('Error reseteando credenciales:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
