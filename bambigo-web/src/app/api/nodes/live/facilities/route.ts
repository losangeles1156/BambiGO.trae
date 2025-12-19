import { NextResponse } from 'next/server'
import { GET as NodesGET } from '../../route'
import { GET as LiveGET } from '../../../live/route'
import { GET as FacilitiesGET } from '../../../facilities/route'
import { withMonitor } from '../../../../../lib/monitor'

// Per-IP rate limiting buckets (independent for this aggregator endpoint)
const rateBuckets = new Map<string, { count: number; resetAt: number }>()

export type AggregatedResponse = {
  nodes: unknown
  live: unknown
  facilities: unknown
  updated_at: string
}

async function handler(req: Request) {
  // Configurable rate limit via NODES_LIVE_FACILITIES_RATE_LIMIT env, format "<max>,<windowSec>"
  const rateCfg = process.env.NODES_LIVE_FACILITIES_RATE_LIMIT
  if (rateCfg && !/^\s*(off|false|0)\s*$/i.test(rateCfg)) {
    let max = 60
    let windowSec = 60
    const m1 = rateCfg.match(/^(\d+)\s*[,/]\s*(\d+)$/)
    if (m1) {
      max = Math.max(1, parseInt(m1[1], 10))
      windowSec = Math.max(1, parseInt(m1[2], 10))
    }
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
      || req.headers.get('x-real-ip')
      || 'local'
    const now = Date.now()
    const b = rateBuckets.get(ip) || { count: 0, resetAt: now + windowSec * 1000 }
    if (now >= b.resetAt) {
      b.count = 0
      b.resetAt = now + windowSec * 1000
    }
    b.count += 1
    rateBuckets.set(ip, b)
    if (b.count > max) {
      const retry = Math.max(1, Math.ceil((b.resetAt - now) / 1000))
      return new NextResponse(
        JSON.stringify({ error: { code: 'RATE_LIMITED', message: 'Too many requests', details: { retry_after_seconds: retry } } }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(retry),
            'X-API-Version': 'v4.1-strict',
          },
        }
      )
    }
  }

  const url = new URL(req.url)
  const nodeId = url.searchParams.get('node_id')
  const bboxParam = url.searchParams.get('bbox')

  // Optional tuning parameters for underlying endpoints
  const typeParam = url.searchParams.get('type') // for /api/nodes
  const limitNodes = url.searchParams.get('limit_nodes')
  const limitMobility = url.searchParams.get('limit_mobility')
  const limitFacilities = url.searchParams.get('limit_facilities')
  const suitabilityTag = url.searchParams.get('suitability')
  const minConfidence = url.searchParams.get('min_confidence')

  // Require at least node_id or bbox to make the aggregation meaningful
  if (!nodeId && !bboxParam) {
    return new NextResponse(
      JSON.stringify({ error: { code: 'MISSING_PARAMETER', message: 'Provide node_id or bbox' } }),
      { status: 400, headers: { 'Content-Type': 'application/json', 'X-API-Version': 'v4.1-strict' } }
    )
  }

  // Validate bbox format when present
  if (bboxParam) {
    const parts = bboxParam.split(',').map((s) => parseFloat(s))
    const ok = parts.length === 4 && parts.every((n) => Number.isFinite(n))
    if (!ok) {
      return new NextResponse(
        JSON.stringify({ error: { code: 'INVALID_PARAMETER', message: 'bbox must be 4 comma-separated numbers', details: { bbox: bboxParam } } }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'X-API-Version': 'v4.1-strict' } }
      )
    }
  }

  // Compose underlying requests with forwarded headers to preserve rate-limit identity
  const origin = url.origin || 'http://localhost'

  const nodesUrl = new URL(`${origin}/api/nodes`)
  if (bboxParam) nodesUrl.searchParams.set('bbox', bboxParam)
  if (typeParam) nodesUrl.searchParams.set('type', typeParam)
  if (limitNodes) nodesUrl.searchParams.set('limit', limitNodes)

  const liveUrl = new URL(`${origin}/api/live`)
  if (nodeId) liveUrl.searchParams.set('node_id', nodeId)
  if (bboxParam) liveUrl.searchParams.set('bbox', bboxParam)
  if (limitMobility) liveUrl.searchParams.set('limit', limitMobility)

  const facilitiesUrl = new URL(`${origin}/api/facilities`)
  if (nodeId) facilitiesUrl.searchParams.set('node_id', nodeId)
  if (bboxParam) facilitiesUrl.searchParams.set('bbox', bboxParam)
  if (limitFacilities) facilitiesUrl.searchParams.set('limit', limitFacilities)
  if (suitabilityTag) facilitiesUrl.searchParams.set('suitability', suitabilityTag)
  if (minConfidence) facilitiesUrl.searchParams.set('min_confidence', minConfidence)

  const forwardedHeaders: Record<string, string> = {}
  const xf = req.headers.get('x-forwarded-for')
  const xr = req.headers.get('x-real-ip')
  if (xf) forwardedHeaders['x-forwarded-for'] = xf
  if (xr) forwardedHeaders['x-real-ip'] = xr

  const nodesRes = await NodesGET(new Request(nodesUrl.toString(), { headers: forwardedHeaders }))
  const liveRes = await LiveGET(new Request(liveUrl.toString(), { headers: forwardedHeaders }))
  let facilitiesRes: Response | null = null
  if (nodeId || bboxParam) {
    facilitiesRes = await FacilitiesGET(new Request(facilitiesUrl.toString(), { headers: forwardedHeaders }))
  }

  // Bubble up rate-limit errors if any of the underlying endpoints signals 429
  if (nodesRes.status === 429 || liveRes.status === 429 || (facilitiesRes && facilitiesRes.status === 429)) {
    const retry = nodesRes.headers.get('Retry-After') || liveRes.headers.get('Retry-After') || (facilitiesRes?.headers.get('Retry-After') || '60')
    return new NextResponse(
      JSON.stringify({ error: { code: 'RATE_LIMITED', message: 'Too many requests', details: { retry_after_seconds: Number(retry) } } }),
      { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(retry), 'X-API-Version': 'v4.1-strict' } }
    )
  }

  // If any underlying endpoint returned a 400, reflect a 400 with its error
  if (nodesRes.status === 400 || liveRes.status === 400 || (facilitiesRes && facilitiesRes.status === 400)) {
    const errBody = await (nodesRes.status === 400 ? nodesRes.text() : liveRes.status === 400 ? liveRes.text() : (facilitiesRes as Response).text())
    return new NextResponse(errBody, { status: 400, headers: { 'Content-Type': 'application/json', 'X-API-Version': 'v4.1-strict' } })
  }

  // Otherwise aggregate JSON payloads
  const [nodesJsonText, liveJsonText] = await Promise.all([
    nodesRes.text(),
    liveRes.text(),
  ])
  const facilitiesJsonText = facilitiesRes ? await facilitiesRes.text() : JSON.stringify({ items: [] })

  let nodesJson: unknown
  let liveJson: unknown
  let facilitiesJson: unknown
  try { nodesJson = JSON.parse(nodesJsonText) } catch { nodesJson = { type: 'FeatureCollection', features: [] } }
  try { 
    liveJson = JSON.parse(liveJsonText) 
    // Ensure liveJson has the expected structure even if the underlying API returns partial data
    if (liveJson && typeof liveJson === 'object') {
      const lj = liveJson as { transit?: unknown }
      if (!lj.transit) {
        lj.transit = { status: 'normal', events: [] }
      }
    }
  } catch { 
    liveJson = { 
      mobility: { stations: [] }, 
      transit: { status: 'normal', events: [] }, 
      updated_at: new Date().toISOString() 
    } 
  }
  try { facilitiesJson = JSON.parse(facilitiesJsonText) } catch { facilitiesJson = { items: [] } }

  const payload: AggregatedResponse = {
    nodes: nodesJson,
    live: liveJson,
    facilities: facilitiesJson,
    updated_at: new Date().toISOString(),
  }

  return new NextResponse(JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=10, stale-while-revalidate=60',
      'X-API-Version': 'v4.1-strict',
    },
  })
}

export const GET = withMonitor(handler, 'AggregatorAPI')
