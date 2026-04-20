import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/reports/cross-evaluation - Cross evaluation report
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const period = searchParams.get('period')

    // Build date filter
    const dateFilter: Record<string, Date> = {}
    if (dateFrom) {
      dateFilter.gte = new Date(dateFrom)
    }
    if (dateTo) {
      dateFilter.lte = new Date(dateTo)
    }

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

    const requests = await db.informationRequest.findMany({
      where,
      include: {
        requesterDept: true,
        providerDept: true,
      },
    })

    const departments = await db.department.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    })

    // Build cross-evaluation matrix
    // Rows = requesters (Direcciones Funcionales), Columns = providers (UEB)
    type CellData = {
      total: number
      completed: number
      uncompleted: number
      inProgress: number
      complianceRate: number
    }

    const matrix: Record<string, Record<string, CellData>> = {}

    // Initialize matrix with zeros
    for (const requester of departments) {
      matrix[requester.name] = {}
      for (const provider of departments) {
        matrix[requester.name][provider.name] = {
          total: 0,
          completed: 0,
          uncompleted: 0,
          inProgress: 0,
          complianceRate: 0,
        }
      }
    }

    // Fill matrix with data
    for (const req of requests) {
      const requesterName = req.requesterDept.name
      const providerName = req.providerDept.name

      if (matrix[requesterName] && matrix[requesterName][providerName]) {
        const cell = matrix[requesterName][providerName]
        cell.total++

        if (req.status === 'CUMPLIDO') {
          cell.completed++
        } else if (req.status === 'INCUMPLIDO') {
          cell.uncompleted++
        } else {
          cell.inProgress++
        }
      }
    }

    // Calculate compliance rates
    for (const requester of departments) {
      for (const provider of departments) {
        const cell = matrix[requester.name][provider.name]
        if (cell.total > 0) {
          cell.complianceRate = Math.round((cell.completed / cell.total) * 10000) / 100
        }
      }
    }

    // Per-department summary
    const departmentSummary = departments.map((dept) => {
      const asRequester = requests.filter((r) => r.requesterDeptId === dept.id)
      const asProvider = requests.filter((r) => r.providerDeptId === dept.id)

      const providerCompleted = asProvider.filter((r) => r.status === 'CUMPLIDO').length
      const providerUncompleted = asProvider.filter((r) => r.status === 'INCUMPLIDO').length

      return {
        id: dept.id,
        name: dept.name,
        type: dept.type,
        asRequester: {
          total: asRequester.length,
          completed: asRequester.filter((r) => r.status === 'CUMPLIDO').length,
          uncompleted: asRequester.filter((r) => r.status === 'INCUMPLIDO').length,
        },
        asProvider: {
          total: asProvider.length,
          completed: providerCompleted,
          uncompleted: providerUncompleted,
          complianceRate:
            asProvider.length > 0
              ? Math.round((providerCompleted / asProvider.length) * 10000) / 100
              : 0,
        },
      }
    })

    // Only include departments that have interactions in the relevant view
    const requesterNames = departments
      .filter((d) => requests.some((r) => r.requesterDeptId === d.id))
      .map((d) => d.name)

    const providerNames = departments
      .filter((d) => requests.some((r) => r.providerDeptId === d.id))
      .map((d) => d.name)

    return NextResponse.json({
      period: period || 'all',
      matrix,
      activeRequesters: requesterNames,
      activeProviders: providerNames,
      departmentSummary,
      totalRequests: requests.length,
    })
  } catch (error) {
    console.error('Error generating cross-evaluation report:', error)
    return NextResponse.json(
      { error: 'Failed to generate cross-evaluation report' },
      { status: 500 }
    )
  }
}
