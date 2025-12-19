import { NextResponse } from 'next/server'
import { Client } from 'pg'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const start = performance.now()
  let dbStatus = 'unknown'
  let dbLatency = 0
  let nodesCount: number | null = null
  let bboxCount: number | null = null

  // Check DB Connection
  const connStr = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL
  if (connStr) {
    const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } })
    try {
      const dbStart = performance.now()
      await client.connect()
      await client.query('SELECT 1')
      if (url.searchParams.get('include') === 'nodes') {
        try {
          const c1 = await client.query('select count(*)::int as c from public.nodes')
          nodesCount = (c1.rows[0]?.c as number) || 0
          const c2 = await client.query(
            'select count(*)::int as c from public.nodes where location is not null and ST_X(location::geometry) >= $1 and ST_X(location::geometry) <= $3 and ST_Y(location::geometry) >= $2 and ST_Y(location::geometry) <= $4',
            [139.73, 35.65, 139.82, 35.74]
          )
          bboxCount = (c2.rows[0]?.c as number) || 0
        } catch {}
      }
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
      debug: url.searchParams.get('include') === 'nodes' ? { nodes_total: nodesCount, nodes_in_bbox: bboxCount } : undefined,
      version: 'v4.1.0'
    }),
    { status, headers: { 'Content-Type': 'application/json' } }
  )
}
