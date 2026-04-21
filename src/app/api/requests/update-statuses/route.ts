import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// POST /api/requests/update-statuses - Auto status update
// Check all SOLICITADO and EN_FECHA requests and update:
// - If deadlineDate > today but within 3 days → EN_FECHA
// - If deadlineDate < today → INCUMPLIDO (and create AffectationRecord with 0.1 affectation)
// - Calculate cumulative affectation and flag if >= 0.3 for commission review
export async function POST() {
  try {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const threeDaysFromNow = new Date(today)
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)

    const results = {
      updatedToEnFecha: 0,
      updatedToIncumplido: 0,
      affectationRecordsCreated: 0,
      flaggedForCommission: 0,
      errors: [] as string[],
    }

    // Find all SOLICITADO requests
    const solicitadoRequests = await db.informationRequest.findMany({
      where: { status: 'SOLICITADO' },
      include: {
        providerDept: true,
        requesterDept: true,
      },
    })

    // Find all EN_FECHA requests that might be overdue
    const enFechaRequests = await db.informationRequest.findMany({
      where: { status: 'EN_FECHA' },
      include: {
        providerDept: true,
        requesterDept: true,
      },
    })

    const allRequests = [...solicitadoRequests, ...enFechaRequests]

    for (const req of allRequests) {
      try {
        const deadlineDate = new Date(req.deadlineDate)
        const deadlineDateOnly = new Date(
          deadlineDate.getFullYear(),
          deadlineDate.getMonth(),
          deadlineDate.getDate()
        )

        if (deadlineDateOnly < today) {
          // Past deadline → INCUMPLIDO
          await db.informationRequest.update({
            where: { id: req.id },
            data: {
              status: 'INCUMPLIDO',
              statusHistory: {
                create: {
                  fromStatus: req.status,
                  toStatus: 'INCUMPLIDO',
                  notes: `Automatically marked as INCUMPLIDO - deadline was ${deadlineDate.toISOString().split('T')[0]}`,
                },
              },
            },
          })

          results.updatedToIncumplido++

          // Calculate cumulative affectation for this department
          const lastAffectation = await db.affectationRecord.findFirst({
            where: { departmentId: req.providerDeptId },
            orderBy: { detectedAt: 'desc' },
          })

          const previousCumulative = lastAffectation?.cumulativeAffectation || 0
          const newCumulative = previousCumulative + 0.1
          const requiresCommission = newCumulative >= 0.3

          // Create AffectationRecord
          await db.affectationRecord.create({
            data: {
              departmentId: req.providerDeptId,
              requestId: req.id,
              requestDescription: req.description,
              requesterDeptName: req.requesterDept.name,
              deadlineDate: req.deadlineDate,
              affectationValue: 0.1,
              cumulativeAffectation: newCumulative,
              requiresCommissionReview: requiresCommission,
            },
          })

          results.affectationRecordsCreated++

          if (requiresCommission) {
            results.flaggedForCommission++
          }
        } else if (deadlineDateOnly <= threeDaysFromNow && deadlineDateOnly >= today) {
          // Within 3 days → EN_FECHA (only if currently SOLICITADO)
          if (req.status === 'SOLICITADO') {
            await db.informationRequest.update({
              where: { id: req.id },
              data: {
                status: 'EN_FECHA',
                statusHistory: {
                  create: {
                    fromStatus: 'SOLICITADO',
                    toStatus: 'EN_FECHA',
                    notes: `Automatically changed to EN_FECHA - deadline is within 3 days (${deadlineDate.toISOString().split('T')[0]})`,
                  },
                },
              },
            })

            results.updatedToEnFecha++
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error'
        results.errors.push(`Request ${req.id}: ${errorMsg}`)
      }
    }

    return NextResponse.json({
      message: 'Status update completed',
      results,
      checkedAt: now.toISOString(),
    })
  } catch (error) {
    console.error('Error updating statuses:', error)
    return NextResponse.json(
      { error: 'Failed to update statuses' },
      { status: 500 }
    )
  }
}
