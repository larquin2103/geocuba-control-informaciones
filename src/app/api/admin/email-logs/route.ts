import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/admin/email-logs - Get all email logs with pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const emailType = searchParams.get('type') || ''
    const success = searchParams.get('success') // 'true', 'false', or '' (all)

    const where: any = {}
    if (emailType) where.emailType = emailType
    if (success === 'true') where.success = true
    if (success === 'false') where.success = false

    const [logs, total] = await Promise.all([
      db.emailLog.findMany({
        where,
        include: {
          request: {
            select: {
              description: true,
              status: true,
              providerDept: { select: { name: true } },
              requesterDept: { select: { name: true } },
            },
          },
        },
        orderBy: { sentAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.emailLog.count({ where }),
    ])

    return NextResponse.json({
      logs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Error fetching email logs:', error)
    return NextResponse.json({ error: 'Error al cargar registros de correos' }, { status: 500 })
  }
}
