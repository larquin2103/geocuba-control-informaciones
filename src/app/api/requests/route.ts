import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { sendEmail, newRequestTemplate } from '@/lib/email'

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
    const { requesterDeptId, providerDeptId, providerDeptIds, description, deadlineDate, priority } = body

    // Support both single providerDeptId and multiple providerDeptIds
    const providerIds: string[] = providerDeptIds || (providerDeptId ? [providerDeptId] : [])

    if (!requesterDeptId || providerIds.length === 0 || !description || !deadlineDate || !priority) {
      return NextResponse.json({ error: 'Todos los campos son requeridos' }, { status: 400 })
    }

    // Validate that no provider is the same as the requester
    const invalidIds = providerIds.filter(id => id === requesterDeptId)
    if (invalidIds.length > 0) {
      return NextResponse.json({ error: 'El departamento proveedor no puede ser el mismo que el solicitante' }, { status: 400 })
    }

    // Verify all departments exist and get their details for email
    const allDeptIds = [requesterDeptId, ...providerIds]
    const departments = await db.department.findMany({
      where: { id: { in: allDeptIds } },
    })

    if (departments.length !== allDeptIds.length) {
      return NextResponse.json({ error: 'Uno o más departamentos no existen' }, { status: 400 })
    }

    const requesterDept = departments.find(d => d.id === requesterDeptId)!

    // Create a request for each provider department
    const createdRequests: Record<string, unknown>[] = []
    const emailResults: { provider: string; email: string; sent: boolean }[] = []

    for (const providerId of providerIds) {
      const providerDept = departments.find(d => d.id === providerId)!

      const newRequest = await db.informationRequest.create({
        data: {
          requesterDeptId,
          providerDeptId: providerId,
          description,
          deadlineDate: new Date(deadlineDate),
          priority,
          status: 'SOLICITADO',
        },
        include: {
          requesterDept: { select: { name: true } },
          providerDept: { select: { name: true, email: true } },
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

      // Send notification email to the provider
      const emailData = {
        requestDescription: description,
        requesterDeptName: requesterDept.name,
        providerDeptName: providerDept.name,
        deadlineDate,
        priority,
        requestId: newRequest.id,
        currentStatus: 'SOLICITADO',
      }

      const subject = `Nueva solicitud de información - ${description.substring(0, 50)}${description.length > 50 ? '...' : ''}`
      const html = newRequestTemplate(emailData)

      const emailResult = await sendEmail({
        to: providerDept.email,
        subject,
        html,
        emailType: 'NOTIFICACION',
      })

      // Log the email
      await db.emailLog.create({
        data: {
          requestId: newRequest.id,
          recipientEmail: providerDept.email,
          subject,
          emailType: 'NOTIFICACION',
          success: emailResult.success,
          error: emailResult.error || null,
        },
      })

      emailResults.push({
        provider: providerDept.name,
        email: providerDept.email,
        sent: emailResult.success,
      })

      createdRequests.push(newRequest)
    }

    return NextResponse.json({
      created: createdRequests.length,
      requests: createdRequests,
      emailNotifications: emailResults,
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating request:', error)
    return NextResponse.json({ error: 'Error al crear solicitud' }, { status: 500 })
  }
}
