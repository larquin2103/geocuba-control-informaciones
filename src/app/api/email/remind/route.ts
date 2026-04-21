import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, reminderTemplate } from '@/lib/email'

// POST /api/email/remind - Send reminder email for a specific request
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

    // Build email data
    const emailData = {
      requestDescription: existingRequest.description,
      requesterDeptName: existingRequest.requesterDept.name,
      providerDeptName: existingRequest.providerDept.name,
      deadlineDate: existingRequest.deadlineDate.toISOString(),
      priority: existingRequest.priority,
      requestId: existingRequest.id,
      currentStatus: existingRequest.status,
      customMessage: message || undefined,
    }

    const subject = `RECORDATORIO - Solicitud pendiente: ${existingRequest.description.substring(0, 50)}${existingRequest.description.length > 50 ? '...' : ''}`
    const html = reminderTemplate(emailData)

    // Send the real email
    const result = await sendEmail({
      to: existingRequest.providerDept.email,
      subject,
      html,
      emailType: 'RECORDATORIO',
    })

    // Create email log
    const emailLog = await db.emailLog.create({
      data: {
        requestId,
        recipientEmail: existingRequest.providerDept.email,
        subject,
        emailType: 'RECORDATORIO',
        success: result.success,
        error: result.error || null,
      },
    })

    if (!result.success) {
      return NextResponse.json({
        message: 'Reminder email failed to send',
        emailLog,
        error: result.error,
      }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Reminder email sent successfully',
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
