import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const departmentId = searchParams.get('departmentId')
    const search = searchParams.get('search')

    const where: Record<string, unknown> = {}

    if (status && status !== 'TODOS') {
      where.status = status
    }

    if (departmentId) {
      where.OR = [
        { requesterDeptId: departmentId },
        { providerDeptId: departmentId },
      ]
    }

    if (search) {
      where.description = { contains: search }
    }

    const requests = await db.informationRequest.findMany({
      where,
      include: {
        requesterDept: { select: { id: true, name: true, type: true } },
        providerDept: { select: { id: true, name: true, type: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return NextResponse.json(requests)
  } catch (error) {
    console.error('Error fetching requests:', error)
    return NextResponse.json({ error: 'Error al obtener solicitudes' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { requesterDeptId, providerDeptId, description, deadlineDate, priority } = body

    if (!requesterDeptId || !providerDeptId || !description || !deadlineDate || !priority) {
      return NextResponse.json({ error: 'Todos los campos son requeridos' }, { status: 400 })
    }

    if (requesterDeptId === providerDeptId) {
      return NextResponse.json({ error: 'El departamento solicitante y proveedor no pueden ser el mismo' }, { status: 400 })
    }

    const newRequest = await db.informationRequest.create({
      data: {
        requesterDeptId,
        providerDeptId,
        description,
        deadlineDate: new Date(deadlineDate),
        priority,
        status: 'SOLICITADO',
      },
      include: {
        requesterDept: { select: { name: true } },
        providerDept: { select: { name: true } },
      },
    })

    // Create initial status history
    await db.statusHistory.create({
      data: {
        requestId: newRequest.id,
        toStatus: 'SOLICITADO',
        notes: 'Solicitud creada',
      },
    })

    return NextResponse.json(newRequest, { status: 201 })
  } catch (error) {
    console.error('Error creating request:', error)
    return NextResponse.json({ error: 'Error al crear solicitud' }, { status: 500 })
  }
}
