import { NextResponse } from 'next/server'

const rateBuckets = new Map<string, { count: number; resetAt: number }>()

function getIP(req: Request): string {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
    || req.headers.get('x-real-ip')
    || 'local'
  return ip
}

function checkRate(req: Request): { ok: true } | { ok: false; retry: number } {
  const cfg = process.env.ASSISTANT_RATE_LIMIT
  if (!cfg || /^\s*(off|false|0)\s*$/i.test(cfg)) return { ok: true }
  let max = 20
  let win = 60
  const m = cfg.match(/^(\d+)\s*[,/]\s*(\d+)$/)
  if (m) {
    max = Math.max(1, parseInt(m[1], 10))
    win = Math.max(1, parseInt(m[2], 10))
  }
  const ip = getIP(req)
  const now = Date.now()
  const b = rateBuckets.get(ip) || { count: 0, resetAt: now + win * 1000 }
  if (now >= b.resetAt) {
    b.count = 0
    b.resetAt = now + win * 1000
  }
  b.count += 1
  rateBuckets.set(ip, b)
  if (b.count > max) {
    const retry = Math.max(1, Math.ceil((b.resetAt - now) / 1000))
    return { ok: false, retry }
  }
  return { ok: true }
}

export async function GET(req: Request) {
  const rate = checkRate(req)
  if (!rate.ok) {
    return new NextResponse(
      JSON.stringify({ error: { code: 'RATE_LIMITED', message: 'Too many requests', details: { retry_after_seconds: rate.retry } } }),
      { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(rate.retry), 'X-API-Version': 'v1' } }
    )
  }
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim()
  if (!q) {
    return new NextResponse(
      JSON.stringify({ error: { code: 'INVALID_PARAMETER', message: 'q is required' } }),
      { status: 400, headers: { 'Content-Type': 'application/json', 'X-API-Version': 'v1' } }
    )
  }
  const provider = (process.env.AI_PROVIDER || 'mock').toLowerCase()
  if (provider === 'mock') {
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        const write = (data: string) => controller.enqueue(encoder.encode(`data: ${data}\n\n`))
        const tokens = [
          '正在分析路線…',
          '建議避開人潮較多的入口，',
          '改往松智路方向。',
          '可選擇共享單車作為替代方案。',
        ]
        let i = 0
        const timer = setInterval(() => {
          if (i < tokens.length) {
            write(JSON.stringify({ role: 'ai', type: 'text', content: tokens[i] }))
            i += 1
          } else {
            write(JSON.stringify({ role: 'ai', type: 'done' }))
            clearInterval(timer)
            controller.close()
          }
        }, 300)
      },
    })
    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-API-Version': 'v1',
      },
    })
  }
  return new NextResponse(
    JSON.stringify({
      error: { code: 'NOT_CONFIGURED', message: 'AI provider not configured', details: { provider } },
      fallback: {
        primary: { title: '避開人潮：改往松智路入口', desc: '信義廣場目前人潮擁擠，可改往較少人潮的入口。', primary: '執行' },
        secondary: [
          { title: '替代方案：共享單車', desc: '距離 120m，可直達目的地，約 15 分鐘。' },
        ],
        cards: [
          { title: '避開人潮：改往松智路入口', desc: '信義廣場目前人潮擁擠，可改往較少人潮的入口。', primary: '執行' },
          { title: '替代方案：共享單車', desc: '距離 120m，可直達目的地，約 15 分鐘。' },
        ],
      },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-API-Version': 'v1' } }
  )
}
