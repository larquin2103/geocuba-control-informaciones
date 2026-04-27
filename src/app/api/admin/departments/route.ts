import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/admin/departments - List departments with filters
export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams.get('search') || ''
    const filter = request.nextUrl.searchParams.get('filter') || ''

    const where: any = {}
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { responsibleName: { contains: search } },
      ]
    }
    if (filter === 'no_password') where.passwordHash = null
    if (filter === 'never_login') where.lastLoginAt = null
    if (filter === 'has_password') where.passwordHash = { not: null }

    const departments = await db.department.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true, name: true, type: true, responsibleName: true,
        email: true, phone: true, active: true,
        passwordHash: true, lastLoginAt: true, createdAt: true,
      },
    })

    return NextResponse.json(departments.map(d => ({
      ...d,
      hasPassword: !!d.passwordHash,
      passwordHash: undefined, // Don't expose hash
    })))
  } catch (error) {
    console.error('Departments error:', error)
    return NextResponse.json({ error: 'Error al cargar departamentos' }, { status: 500 })
  }
}
