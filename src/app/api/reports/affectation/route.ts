import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/reports/affectation - Affectation report
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const departmentId = searchParams.get('departmentId')

    const where: Record<string, unknown> = {}
    if (departmentId) {
      where.departmentId = departmentId
    }

    // Get all affectation records
    const affectationRecords = await db.affectationRecord.findMany({
      where,
      include: {
        department: true,
      },
      orderBy: { detectedAt: 'desc' },
    })

    // Per-department cumulative affectation
    const departments = await db.department.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    })

    const deptAffectation = departments.map((dept) => {
      const records = affectationRecords.filter((r) => r.departmentId === dept.id)
      const latestRecord = records[0] // Most recent due to ordering
      const totalAffectation = latestRecord?.cumulativeAffectation || 0
      const requiresCommission = totalAffectation >= 0.3

      return {
        departmentId: dept.id,
        departmentName: dept.name,
        departmentType: dept.type,
        responsibleName: dept.responsibleName,
        totalAffectation,
        requiresCommissionReview: requiresCommission,
        records: records.map((r) => ({
          id: r.id,
          requestDescription: r.requestDescription,
          requesterDeptName: r.requesterDeptName,
          deadlineDate: r.deadlineDate.toISOString(),
          affectationValue: r.affectationValue,
          cumulativeAffectation: r.cumulativeAffectation,
          detectedAt: r.detectedAt.toISOString(),
        })),
      }
    }).filter((d) => d.records.length > 0)

    // Count departments for review
    const departmentsForReview = deptAffectation.filter(
      (d) => d.requiresCommissionReview
    ).length

    return NextResponse.json({
      summary: {
        totalRecords: affectationRecords.length,
        departmentsAffected: deptAffectation.length,
        departmentsForReview,
      },
      departments: deptAffectation,
    })
  } catch (error) {
    console.error('Error generating affectation report:', error)
    return NextResponse.json(
      { error: 'Failed to generate affectation report' },
      { status: 500 }
    )
  }
}
