import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/admin/set-password - Set a specific password for a department
// Use this when you want to assign a known password instead of generating a random one
export async function POST(request: NextRequest) {
  try {
    const { departmentId, newPassword } = await request.json()

    if (!departmentId || !newPassword) {
      return NextResponse.json(
        { error: 'ID de departamento y nueva contraseña son requeridos' },
        { status: 400 }
      )
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 6 caracteres' },
        { status: 400 }
      )
    }

    const dept = await db.department.findUnique({ where: { id: departmentId } })
    if (!dept) {
      return NextResponse.json({ error: 'Departamento no encontrado' }, { status: 404 })
    }

    const hashedPassword = await hashPassword(newPassword)

    await db.department.update({
      where: { id: departmentId },
      data: {
        passwordHash: hashedPassword,
        loginToken: null,
        loginTokenExpires: null,
      },
    })

    return NextResponse.json({
      success: true,
      departmentName: dept.name,
      email: dept.email,
      message: `Contraseña establecida para: ${dept.name} (${dept.email})`,
    })
  } catch (error) {
    console.error('Set password error:', error)
    return NextResponse.json({ error: 'Error al establecer contraseña' }, { status: 500 })
  }
}
