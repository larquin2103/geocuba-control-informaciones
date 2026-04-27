import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/requests/[id] - Get a single request with full details
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const requestRecord = await db.informationRequest.findUnique({
      where: { id },
      include: {
        requesterDept: true,
        providerDept: true,
        statusHistory: {
          orderBy: { changedAt: 'desc' },
        },
        emailLogs: {
          orderBy: { sentAt: 'desc' },
        },
      },
    })

    if (!requestRecord) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(requestRecord)
  } catch (error) {
    console.error('Error fetching request:', error)
    return NextResponse.json(
      { error: 'Failed to fetch request' },
      { status: 500 }
    )
  }
}

// PATCH /api/requests/[id] - Update a request (mainly for status changes)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { status, description, deadlineDate, priority, completedNotes } = body

    const existingRequest = await db.informationRequest.findUnique({
      where: { id },
    })

    if (!existingRequest) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      )
    }

    const updateData: Record<string, unknown> = {}

    // Handle status change
    if (status && status !== existingRequest.status) {
      const validStatuses = ['SOLICITADO', 'EN_FECHA', 'CUMPLIDO', 'INCUMPLIDO']
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: `Status must be one of: ${validStatuses.join(', ')}` },
          { status: 400 }
        )
      }

      updateData.status = status

      // When marking as CUMPLIDO, set completedAt
      if (status === 'CUMPLIDO') {
        updateData.completedAt = new Date()
      }

      // Create status history entry
      updateData.statusHistory = {
        create: {
          fromStatus: existingRequest.status,
          toStatus: status,
          notes: completedNotes || `Estado cambiado de ${existingRequest.status} a ${status}`,
        },
      }
    }

    // Handle other updatable fields
    if (description !== undefined) {
      updateData.description = description
    }

    if (deadlineDate !== undefined) {
      updateData.deadlineDate = new Date(deadlineDate)
    }

    if (priority !== undefined) {
      if (!['ALTA', 'NORMAL', 'BAJA'].includes(priority)) {
        return NextResponse.json(
          { error: 'Priority must be ALTA, NORMAL, or BAJA' },
          { status: 400 }
        )
      }
      updateData.priority = priority
    }

    if (completedNotes !== undefined) {
      updateData.completedNotes = completedNotes
    }

    const updatedRequest = await db.informationRequest.update({
      where: { id },
      data: updateData,
      include: {
        requesterDept: true,
        providerDept: true,
        statusHistory: {
          orderBy: { changedAt: 'desc' },
        },
        emailLogs: {
          orderBy: { sentAt: 'desc' },
        },
      },
    })

    return NextResponse.json(updatedRequest)
  } catch (error) {
    console.error('Error updating request:', error)
    return NextResponse.json(
      { error: 'Failed to update request' },
      { status: 500 }
    )
  }
}

// DELETE /api/requests/[id] - Delete a request (Director General only)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Check authorization via session
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        { error: 'Debe iniciar sesión para realizar esta acción' },
        { status: 401 }
      )
    }

    if (!session.isDirectorGeneral) {
      return NextResponse.json(
        { error: 'Solo el Director General puede eliminar solicitudes' },
        { status: 403 }
      )
    }

    const existingRequest = await db.informationRequest.findUnique({
      where: { id },
    })

    if (!existingRequest) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      )
    }

    // Cascade deletes will handle statusHistory and emailLogs
    await db.informationRequest.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Request deleted successfully' })
  } catch (error) {
    console.error('Error deleting request:', error)
    return NextResponse.json(
      { error: 'Failed to delete request' },
      { status: 500 }
    )
  }
}
