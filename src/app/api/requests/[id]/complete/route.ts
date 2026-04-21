import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/requests/[id]/complete - Mark a request as CUMPLIDO
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { notes } = body

    const existingRequest = await db.informationRequest.findUnique({
      where: { id },
      include: {
        providerDept: true,
        requesterDept: true,
      },
    })

    if (!existingRequest) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      )
    }

    if (existingRequest.status === 'CUMPLIDO') {
      return NextResponse.json(
        { error: 'Request is already completed' },
        { status: 400 }
      )
    }

    const previousStatus = existingRequest.status

    const updatedRequest = await db.informationRequest.update({
      where: { id },
      data: {
        status: 'CUMPLIDO',
        completedAt: new Date(),
        completedNotes: notes || null,
        statusHistory: {
          create: {
            fromStatus: previousStatus,
            toStatus: 'CUMPLIDO',
            notes: notes || `Solicitud completada (estado anterior: ${previousStatus})`,
          },
        },
        emailLogs: {
          create: {
            recipientEmail: existingRequest.requesterDept.email,
            subject: `Solicitud completada - ${existingRequest.description.substring(0, 50)}`,
            emailType: 'CONFIRMACION',
            success: true,
          },
        },
      },
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
    console.error('Error completing request:', error)
    return NextResponse.json(
      { error: 'Failed to complete request' },
      { status: 500 }
    )
  }
}
