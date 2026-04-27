import { NextResponse } from 'next/server'

// GET /api/health - Public health check endpoint for deployment verification
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'GEOCUBA CM-CA - Control de Entrega de Informaciones',
    timestamp: new Date().toISOString(),
  })
}
