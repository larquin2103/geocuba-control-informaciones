import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/admin/dashboard - Dashboard metrics
export async function GET() {
  try {
    const [
      totalDepts, activeDepts, deptsWithPass, deptsNoPass, deptsNeverLogin,
      totalReqs, solicitadas, enFecha, cumplidas, incumplidas,
      totalEmails, okEmails, failEmails,
      totalAffect, pendingReview,
    ] = await Promise.all([
      db.department.count(),
      db.department.count({ where: { active: true } }),
      db.department.count({ where: { passwordHash: { not: null } } }),
      db.department.count({ where: { passwordHash: null } }),
      db.department.count({ where: { lastLoginAt: null } }),
      db.informationRequest.count(),
      db.informationRequest.count({ where: { status: 'SOLICITADO' } }),
      db.informationRequest.count({ where: { status: 'EN_FECHA' } }),
      db.informationRequest.count({ where: { status: 'CUMPLIDO' } }),
      db.informationRequest.count({ where: { status: 'INCUMPLIDO' } }),
      db.emailLog.count(),
      db.emailLog.count({ where: { success: true } }),
      db.emailLog.count({ where: { success: false } }),
      db.affectationRecord.count(),
      db.affectationRecord.count({ where: { requiresCommissionReview: true, reviewStatus: 'PENDIENTE' } }),
    ])

    const rate = totalReqs > 0 ? ((cumplidas / totalReqs) * 100).toFixed(1) : '0'

    const recentLogins = await db.department.findMany({
      where: { lastLoginAt: { not: null } },
      orderBy: { lastLoginAt: 'desc' }, take: 5,
      select: { id: true, name: true, email: true, lastLoginAt: true },
    })

    const upcoming = await db.informationRequest.findMany({
      where: { status: { in: ['SOLICITADO', 'EN_FECHA'] }, deadlineDate: { gte: new Date() } },
      orderBy: { deadlineDate: 'asc' }, take: 5,
      include: { requesterDept: { select: { name: true } }, providerDept: { select: { name: true } } },
    })

    const deptAffectations = await db.affectationRecord.groupBy({
      by: ['departmentId'],
      _sum: { cumulativeAffectation: true },
      _count: { id: true },
      orderBy: { _sum: { cumulativeAffectation: 'desc' } },
      take: 5,
    })

    const deptAffectationEnriched = await Promise.all(
      deptAffectations.map(async (a) => {
        const dept = await db.department.findUnique({ where: { id: a.departmentId }, select: { name: true } })
        return { departmentName: dept?.name || 'N/A', totalAffectation: a._sum.cumulativeAffectation || 0, incidentCount: a._count.id }
      })
    )

    return NextResponse.json({
      metrics: {
        totalDepts, activeDepts, deptsWithPass, deptsNoPass, deptsNeverLogin,
        totalReqs, solicitadas, enFecha, cumplidas, incumplidas, complianceRate: rate,
        totalEmails, okEmails, failEmails, totalAffect, pendingReview,
      },
      recentLogins, upcoming, deptAffectationEnriched,
    })
  } catch (error) {
    console.error('Dashboard error:', error)
    return NextResponse.json({ error: 'Error al cargar dashboard' }, { status: 500 })
  }
}
