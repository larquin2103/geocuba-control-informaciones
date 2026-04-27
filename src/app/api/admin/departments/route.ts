import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
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
        responsibleRole: true, email: true, phone: true, active: true,
        passwordHash: true, lastLoginAt: true, createdAt: true, updatedAt: true,
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

// POST /api/admin/departments - Create a new department
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, type, responsibleName, responsibleRole, email, phone, active, initialPassword } = body

    if (!name || !type || !responsibleName || !email) {
      return NextResponse.json(
        { error: 'Nombre, tipo, responsable y correo son requeridos' },
        { status: 400 }
      )
    }

    // Validate type
    if (!['DIRECCION_FUNCIONAL', 'UEB'].includes(type)) {
      return NextResponse.json(
        { error: 'El tipo debe ser DIRECCION_FUNCIONAL o UEB' },
        { status: 400 }
      )
    }

    // Check if name or email already exists
    const existingByName = await db.department.findUnique({ where: { name } })
    if (existingByName) {
      return NextResponse.json(
        { error: 'Ya existe un departamento con ese nombre' },
        { status: 409 }
      )
    }

    const existingByEmail = await db.department.findFirst({ where: { email: email.toLowerCase().trim() } })
    if (existingByEmail) {
      return NextResponse.json(
        { error: 'Ya existe un departamento con ese correo electrónico' },
        { status: 409 }
      )
    }

    // Create department
    const data: any = {
      name,
      type,
      responsibleName,
      responsibleRole: responsibleRole || '',
      email: email.toLowerCase().trim(),
      phone: phone || null,
      active: active !== undefined ? active : true,
    }

    // Set initial password if provided
    if (initialPassword) {
      data.passwordHash = await hashPassword(initialPassword)
    }

    const department = await db.department.create({ data })

    return NextResponse.json({
      ...department,
      hasPassword: !!department.passwordHash,
      passwordHash: undefined,
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating department:', error)
    return NextResponse.json({ error: 'Error al crear departamento' }, { status: 500 })
  }
}

// PUT /api/admin/departments - Update a department
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, type, responsibleName, responsibleRole, email, phone, active } = body

    if (!id) {
      return NextResponse.json(
        { error: 'ID de departamento es requerido' },
        { status: 400 }
      )
    }

    const existing = await db.department.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Departamento no encontrado' },
        { status: 404 }
      )
    }

    // If changing name, check uniqueness
    if (name && name !== existing.name) {
      const nameConflict = await db.department.findUnique({ where: { name } })
      if (nameConflict) {
        return NextResponse.json(
          { error: 'Ya existe un departamento con ese nombre' },
          { status: 409 }
        )
      }
    }

    // If changing email, check uniqueness
    if (email && email.toLowerCase().trim() !== existing.email) {
      const emailConflict = await db.department.findFirst({
        where: { email: email.toLowerCase().trim(), NOT: { id } },
      })
      if (emailConflict) {
        return NextResponse.json(
          { error: 'Ya existe un departamento con ese correo electrónico' },
          { status: 409 }
        )
      }
    }

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (type !== undefined) {
      if (!['DIRECCION_FUNCIONAL', 'UEB'].includes(type)) {
        return NextResponse.json({ error: 'El tipo debe ser DIRECCION_FUNCIONAL o UEB' }, { status: 400 })
      }
      updateData.type = type
    }
    if (responsibleName !== undefined) updateData.responsibleName = responsibleName
    if (responsibleRole !== undefined) updateData.responsibleRole = responsibleRole
    if (email !== undefined) updateData.email = email.toLowerCase().trim()
    if (phone !== undefined) updateData.phone = phone || null
    if (active !== undefined) updateData.active = active

    const department = await db.department.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({
      ...department,
      hasPassword: !!department.passwordHash,
      passwordHash: undefined,
    })
  } catch (error) {
    console.error('Error updating department:', error)
    return NextResponse.json({ error: 'Error al actualizar departamento' }, { status: 500 })
  }
}

// DELETE /api/admin/departments - Delete a department (deactivate)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const hard = searchParams.get('hard') === 'true'

    if (!id) {
      return NextResponse.json(
        { error: 'ID de departamento es requerido' },
        { status: 400 }
      )
    }

    const existing = await db.department.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Departamento no encontrado' },
        { status: 404 }
      )
    }

    if (hard) {
      // Hard delete - only if no related records
      const relatedRequests = await db.informationRequest.count({
        where: {
          OR: [
            { requesterDeptId: id },
            { providerDeptId: id },
          ],
        },
      })

      if (relatedRequests > 0) {
        return NextResponse.json(
          { error: 'No se puede eliminar: tiene solicitudes asociadas. Desactive el departamento en su lugar.' },
          { status: 400 }
        )
      }

      await db.department.delete({ where: { id } })
      return NextResponse.json({ message: 'Departamento eliminado permanentemente' })
    }

    // Soft delete (deactivate) - default behavior
    await db.department.update({
      where: { id },
      data: { active: false },
    })

    return NextResponse.json({ message: 'Departamento desactivado' })
  } catch (error) {
    console.error('Error deleting department:', error)
    return NextResponse.json({ error: 'Error al eliminar departamento' }, { status: 500 })
  }
}
