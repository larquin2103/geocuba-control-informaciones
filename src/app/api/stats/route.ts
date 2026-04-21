import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { differenceInDays } from 'date-fns'

// GET /api/stats - Dashboard statistics
export async function GET() {
  try {
    const now = new Date()
    const sevenDaysFromNow = new Date(now)
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)

    // Count requests by status using groupBy for efficiency
    const statusCounts = await db.informationRequest.groupBy({
      by: ['status'],
      _count: { status: true },
    })

    const statusMap: Record<string, number> = {}
    for (const sc of statusCounts) {
      statusMap[sc.status] = sc._count.status
    }

    const totalRequests = Object.values(statusMap).reduce((a, b) => a + b, 0)
    const cumplidoCount = statusMap['CUMPLIDO'] || 0
    const enFechaCount = statusMap['EN_FECHA'] || 0
    const solicitadoCount = statusMap['SOLICITADO'] || 0
    const incumplidoCount = statusMap['INCUMPLIDO'] || 0

    const tasaCumplimiento = totalRequests > 0
      ? Math.round((cumplidoCount / totalRequests) * 100)
      : 0

    // Upcoming deadlines (next 7 days, not completed)
    const upcomingRequests = await db.informationRequest.findMany({
      where: {
        status: { in: ['SOLICITADO', 'EN_FECHA'] },
        deadlineDate: { gte: now, lte: sevenDaysFromNow },
      },
      include: {
        requesterDept: { select: { id: true, name: true, type: true } },
        providerDept: { select: { id: true, name: true, type: true } },
      },
      orderBy: { deadlineDate: 'asc' },
      take: 10,
    })

    const upcomingDeadlines = upcomingRequests.map((r) => ({
      id: r.id,
      description: r.description,
      deadlineDate: r.deadlineDate.toISOString(),
      status: r.status,
      priority: r.priority,
      requesterDeptId: r.requesterDeptId,
      providerDeptId: r.providerDeptId,
      requesterDept: r.requesterDept,
      providerDept: r.providerDept,
      daysUntilDeadline: differenceInDays(new Date(r.deadlineDate), now),
    }))

    // Recent activity from status history
    const recentStatusChanges = await db.statusHistory.findMany({
      take: 10,
      orderBy: { changedAt: 'desc' },
      include: {
        request: {
          include: {
            requesterDept: { select: { name: true } },
            providerDept: { select: { name: true } },
          },
        },
      },
    })

    const recentActivity = recentStatusChanges.map((sh) => ({
      id: sh.id,
      fromStatus: sh.fromStatus,
      toStatus: sh.toStatus,
      changedAt: sh.changedAt.toISOString(),
      notes: sh.notes,
      request: {
        description: sh.request.description,
        requesterDept: { name: sh.request.requesterDept.name },
        providerDept: { name: sh.request.providerDept.name },
      },
    }))

    // Compliance by department (as provider) - optimized with groupBy
    const providerCompliance = await db.informationRequest.groupBy({
      by: ['providerDeptId', 'status'],
      _count: { status: true },
    })

    const departments = await db.department.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, type: true },
    })

    const complianceByDept = departments.map((dept) => {
      const deptRecords = providerCompliance.filter(r => r.providerDeptId === dept.id)
      const total = deptRecords.reduce((sum, r) => sum + r._count.status, 0)
      const completed = deptRecords
        .filter(r => r.status === 'CUMPLIDO')
        .reduce((sum, r) => sum + r._count.status, 0)
      const uncompleted = deptRecords
        .filter(r => r.status === 'INCUMPLIDO')
        .reduce((sum, r) => sum + r._count.status, 0)
      const rate = total > 0 ? Math.round((completed / total) * 100) : 0

      return { name: dept.name, type: dept.type, total, completed, uncompleted, rate }
    })

    return NextResponse.json({
      total: totalRequests,
      cumplidas: cumplidoCount,
      enFecha: enFechaCount,
      incumplidas: incumplidoCount,
      solicitadas: solicitadoCount,
      tasaCumplimiento,
      complianceByDept,
      upcomingDeadlines,
      recentActivity,
    })
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    )
  }
}
