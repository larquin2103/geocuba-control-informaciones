import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/reports/compliance - Generate compliance report
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const departmentId = searchParams.get('departmentId')

    // Build date filter
    const dateFilter: Record<string, Date> = {}
    if (dateFrom) {
      dateFilter.gte = new Date(dateFrom)
    }
    if (dateTo) {
      dateFilter.lte = new Date(dateTo)
    }

    // If period is specified, derive date range from it
    if (period) {
      if (period.includes('-Q')) {
        const [year, q] = period.split('-Q')
        const quarter = parseInt(q)
        const startMonth = (quarter - 1) * 3
        dateFilter.gte = new Date(parseInt(year), startMonth, 1)
        dateFilter.lte = new Date(parseInt(year), startMonth + 3, 0)
      } else {
        const [year, month] = period.split('-')
        dateFilter.gte = new Date(parseInt(year), parseInt(month) - 1, 1)
        dateFilter.lte = new Date(parseInt(year), parseInt(month), 0)
      }
    }

    const where: Record<string, unknown> = {}
    if (Object.keys(dateFilter).length > 0) {
      where.createdAt = dateFilter
    }
    if (departmentId) {
      where.OR = [
        { requesterDeptId: departmentId },
        { providerDeptId: departmentId },
      ]
    }

    // Get all requests matching filters
    const requests = await db.informationRequest.findMany({
      where,
      include: {
        requesterDept: true,
        providerDept: true,
      },
    })

    // Overall stats
    const total = requests.length
    const completed = requests.filter((r) => r.status === 'CUMPLIDO').length
    const incumplidas = requests.filter((r) => r.status === 'INCUMPLIDO').length
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0

    // Per-department breakdown
    const departments = await db.department.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    })

    const deptBreakdown = departments.map((dept) => {
      const asRequester = requests.filter((r) => r.requesterDeptId === dept.id)
      const asProvider = requests.filter((r) => r.providerDeptId === dept.id)

      const providerCompleted = asProvider.filter((r) => r.status === 'CUMPLIDO').length
      const providerIncumplidas = asProvider.filter((r) => r.status === 'INCUMPLIDO').length
      const providerEnFecha = asProvider.filter((r) => r.status === 'EN_FECHA').length
      const providerSolicitadas = asProvider.filter((r) => r.status === 'SOLICITADO').length
      const providerRate = asProvider.length > 0 ? Math.round((providerCompleted / asProvider.length) * 100) : 0

      return {
        id: dept.id,
        name: dept.name,
        type: dept.type,
        asProvider: {
          total: asProvider.length,
          completed: providerCompleted,
          incumplidas: providerIncumplidas,
          enFecha: providerEnFecha,
          solicitadas: providerSolicitadas,
          rate: providerRate,
        },
        asRequester: {
          total: asRequester.length,
        },
      }
    })

    // Cross-evaluation matrix (requester → provider)
    const matrix: Record<string, Record<string, { total: number; completed: number }>> = {}

    for (const req of requests) {
      const requesterName = req.requesterDept.name
      const providerName = req.providerDept.name

      if (!matrix[requesterName]) {
        matrix[requesterName] = {}
      }
      if (!matrix[requesterName][providerName]) {
        matrix[requesterName][providerName] = { total: 0, completed: 0 }
      }

      matrix[requesterName][providerName].total++
      if (req.status === 'CUMPLIDO') {
        matrix[requesterName][providerName].completed++
      }
    }

    return NextResponse.json({
      summary: {
        total,
        completed,
        incumplidas,
        rate,
      },
      departments: deptBreakdown,
      matrix,
    })
  } catch (error) {
    console.error('Error generating compliance report:', error)
    return NextResponse.json(
      { error: 'Failed to generate compliance report' },
      { status: 500 }
    )
  }
}
