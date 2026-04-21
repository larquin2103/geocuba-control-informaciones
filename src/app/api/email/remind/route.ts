import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/email/remind - Send reminder email for a specific request (simulated)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { requestId, message } = body

    if (!requestId) {
      return NextResponse.json(
        { error: 'Missing required field: requestId' },
        { status: 400 }
      )
    }

    const existingRequest = await db.informationRequest.findUnique({
      where: { id: requestId },
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
        { error: 'Cannot send reminder for completed request' },
        { status: 400 }
      )
    }

    // Create email log (simulated - just log it)
    const emailLog = await db.emailLog.create({
      data: {
        requestId,
        recipientEmail: existingRequest.providerDept.email,
        subject: `RECORDATORIO - Solicitud pendiente: ${existingRequest.description.substring(0, 50)}`,
        emailType: 'RECORDATORIO',
        success: true,
      },
    })

    // Log to console (simulated email sending)
    console.log(`[EMAIL REMINDER] To: ${existingRequest.providerDept.email}, Subject: ${emailLog.subject}, Message: ${message || 'No custom message'}`)

    return NextResponse.json({
      message: 'Reminder email sent successfully (simulated)',
      emailLog,
      recipient: existingRequest.providerDept.email,
      requestDescription: existingRequest.description,
      deadlineDate: existingRequest.deadlineDate,
      currentStatus: existingRequest.status,
    })
  } catch (error) {
    console.error('Error sending reminder email:', error)
    return NextResponse.json(
      { error: 'Failed to send reminder email' },
      { status: 500 }
    )
  }
}
