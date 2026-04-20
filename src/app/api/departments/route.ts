import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const departments = await db.department.findMany({
      where: { active: true },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    })
    return NextResponse.json(departments)
  } catch (error) {
    console.error('Error fetching departments:', error)
    return NextResponse.json({ error: 'Error al obtener departamentos' }, { status: 500 })
  }
}
