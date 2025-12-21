import { NextResponse } from 'next/server'
import db from '@/lib/db'
import redis from '@/lib/redis'

export const dynamic = 'force-dynamic'

let dbUnavailableUntil = 0
const DB_BACKOFF_MS = 5 * 60 * 1000

export async function GET(req: Request) {
  const url = new URL(req.url)
  const start = performance.now()
  let dbStatus = 'unknown'
  let dbLatency = 0
  let redisStatus = 'disabled'
  let nodesCount: number | null = null
  let bboxCount: number | null = null

  // Check DB Connection (Pool)
  const now = Date.now()
  if (now < dbUnavailableUntil) {
    dbStatus = 'disconnected (circuit-breaker)'
  } else {
    try {
      const dbStart = performance.now()
      await db.query('SELECT 1')
      
      if (url.searchParams.get('include') === 'nodes') {
        try {
          const c1 = await db.query('select count(*)::int as c from public.nodes')
          nodesCount = (c1.rows[0]?.c as number) || 0
          const c2 = await db.query(
            'select count(*)::int as c from public.nodes where location is not null and ST_X(location::geometry) >= $1 and ST_X(location::geometry) <= $3 and ST_Y(location::geometry) >= $2 and ST_Y(location::geometry) <= $4',
            [139.73, 35.65, 139.82, 35.74]
          )
          bboxCount = (c2.rows[0]?.c as number) || 0
        } catch {}
      }
      
      dbLatency = Math.round(performance.now() - dbStart)
      dbStatus = 'connected'
    } catch (e) {
      console.error('[Health] DB Error:', e)
      dbStatus = 'disconnected'
      // Only trip circuit breaker on connection errors, not query errors
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('ECONNREFUSED') || msg.includes('password') || msg.includes('connection')) {
        dbUnavailableUntil = now + DB_BACKOFF_MS
      }
    }
  }

  // Check Redis
  if (redis) {
    try {
      await redis.ping()
      redisStatus = 'connected'
    } catch (e) {
      console.error('[Health] Redis Error:', e)
      redisStatus = 'disconnected'
    }
  }

  return new NextResponse(
    JSON.stringify({
      status: (dbStatus === 'connected' || dbStatus === 'unknown') ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      duration_ms: Math.round(performance.now() - start),
      database: {
        status: dbStatus,
        latency_ms: dbLatency,
        pool_total: db.totalCount,
        pool_idle: db.idleCount,
        pool_waiting: db.waitingCount,
        nodes_count: nodesCount,
        sample_bbox_count: bboxCount
      },
      redis: {
        status: redisStatus
      },
      env: process.env.NODE_ENV
    }),
    {
      status: (dbStatus === 'connected' || dbStatus === 'unknown') ? 200 : 503,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    }
  )
}
