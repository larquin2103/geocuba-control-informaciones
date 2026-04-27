import { db } from '@/lib/db'
import { hashPassword, generateToken, generateTempPassword } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/admin/reset-password - Reset a department's password and return new credentials
export async function POST(request: NextRequest) {
  try {
    const { departmentId } = await request.json()

    if (!departmentId) {
      return NextResponse.json({ error: 'ID de departamento es requerido' }, { status: 400 })
    }

    const dept = await db.department.findUnique({ where: { id: departmentId } })
    if (!dept) {
      return NextResponse.json({ error: 'Departamento no encontrado' }, { status: 404 })
    }

    const tempPassword = generateTempPassword()
    const token = generateToken()
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const hashedTempPassword = await hashPassword(tempPassword)

    await db.department.update({
      where: { id: departmentId },
      data: {
        passwordHash: hashedTempPassword,
        loginToken: token,
        loginTokenExpires: tokenExpires,
      },
    })

    return NextResponse.json({
      success: true,
      departmentName: dept.name,
      email: dept.email,
      tempPassword,
      token,
      message: `Contraseña restablecida para: ${dept.name}\n\nContraseña temporal: ${tempPassword}\nToken de seguridad: ${token}\n\nComunique estas credenciales al responsable. El token expira en 24 horas.`,
    })
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json({ error: 'Error al restablecer contraseña' }, { status: 500 })
  }
}
