import { testSmtpConnection } from '@/lib/email'
import { NextResponse } from 'next/server'

// GET /api/admin/test-smtp - Test SMTP connection
export async function GET() {
  try {
    const result = await testSmtpConnection()
    return NextResponse.json(result)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({
      connected: false,
      authenticated: false,
      error: msg,
    }, { status: 500 })
  }
}
