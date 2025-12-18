import { NextResponse } from 'next/server'
import { Client } from 'pg'

export const dynamic = 'force-dynamic'

export async function GET() {
  const start = performance.now()
  let dbStatus = 'unknown'
  let dbLatency = 0

  // Check DB Connection
  const connStr = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL
  if (connStr) {
    const client = new Client({ connectionString: connStr })
    try {
      const dbStart = performance.now()
      await client.connect()
      await client.query('SELECT 1')
      await client.end()
      dbLatency = Math.round(performance.now() - dbStart)
      dbStatus = 'connected'
    } catch (e) {
      dbStatus = 'disconnected'
      console.error('Health Check DB Error:', e)
    }
  } else {
    dbStatus = 'not_configured'
  }

  const duration = Math.round(performance.now() - start)
  const status = dbStatus === 'connected' || dbStatus === 'not_configured' ? 200 : 503

  return new NextResponse(
    JSON.stringify({
      status: status === 200 ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: dbStatus,
          latency_ms: dbLatency
        },
        api: {
          uptime: process.uptime(),
          latency_ms: duration
        }
      },
      version: 'v4.1.0'
    }),
    { status, headers: { 'Content-Type': 'application/json' } }
  )
}
