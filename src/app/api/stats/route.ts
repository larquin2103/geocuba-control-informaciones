import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { differenceInDays } from 'date-fns'

// GET /api/stats - Dashboard statistics
export async function GET() {
  try {
    const now = new Date()
    const sevenDaysFromNow = new Date(now)
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)

    // Count requests by status
    const [
      totalRequests,
      solicitadoCount,
      enFechaCount,
      cumplidoCount,
      incumplidoCount,
    ] = await Promise.all([
      db.informationRequest.count(),
      db.informationRequest.count({ where: { status: 'SOLICITADO' } }),
      db.informationRequest.count({ where: { status: 'EN_FECHA' } }),
      db.informationRequest.count({ where: { status: 'CUMPLIDO' } }),
      db.informationRequest.count({ where: { status: 'INCUMPLIDO' } }),
    ])

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

    // Compliance by department (as provider)
    const departments = await db.department.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    })

    const complianceByDept = await Promise.all(
      departments.map(async (dept) => {
        const asProvider = await db.informationRequest.findMany({
          where: { providerDeptId: dept.id },
        })
        const total = asProvider.length
        const completed = asProvider.filter((r) => r.status === 'CUMPLIDO').length
        const uncompleted = asProvider.filter((r) => r.status === 'INCUMPLIDO').length
        const rate = total > 0 ? Math.round((completed / total) * 100) : 0

        return {
          name: dept.name,
          type: dept.type,
          total,
          completed,
          uncompleted,
          rate,
        }
      })
    )

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
