import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client for server-side
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
  const nodeId = (searchParams.get('node_id') || '').trim()

  if (!q) {
    return new NextResponse(
      JSON.stringify({ error: { code: 'INVALID_PARAMETER', message: 'q is required' } }),
      { status: 400, headers: { 'Content-Type': 'application/json', 'X-API-Version': 'v1' } }
    )
  }

  function routeMode(query: string): 'rule' | 'tool' | 'llm' {
    const s = query.toLowerCase()
    const isTool = (
      s.includes('附近') ||
      s.includes('交通') ||
      s.includes('共享單車') ||
      s.includes('站點') ||
      s.includes('廁所') ||
      s.includes('wifi') ||
      s.includes('充電') ||
      s.includes('雨備') ||
      s.includes('天氣') ||
      s.includes('導航')
    )
    if (isTool) return 'tool'
    const isRule = (
      /\b(幾點|幾時|延誤|塞車|封閉)\b/i.test(query) ||
      /\b(轉乘|走多久|會不會很遠)\b/i.test(query)
    )
    if (isRule) return 'rule'
    return 'llm'
  }

  async function buildToolFallback(nodeIdParam: string | null, query: string) {
    try {
      const origin = new URL(req.url).origin
      const params = new URLSearchParams()
      if (nodeIdParam) params.set('node_id', nodeIdParam)
      params.set('limit_facilities', '12')
      params.set('limit_mobility', '50')
      const r = await fetch(`${origin}/api/nodes/live/facilities?${params.toString()}`, { headers: { 'x-real-ip': getIP(req) } })
      type Station = { id: string; name?: string; bikesAvailable?: number; bikes_available?: number; docksAvailable?: number; docks_available?: number }
      type Live = { transit?: { status?: 'normal' | 'delayed' | 'suspended' }; mobility?: { stations?: Station[] } }
      type FacilitiesItem = { id: string; type: string }
      type Facilities = { items?: FacilitiesItem[] }
      type Agg = { live?: Live; facilities?: Facilities }
      const j: Agg = await r.json().catch(() => ({} as Agg))
      const cards: Array<{ title: string; desc?: string; primary?: string }> = []
      const live: Live = j?.live || {}
      const transit = live?.transit?.status
      if (transit === 'suspended' || transit === 'delayed') {
        cards.push({ title: '大眾運輸', desc: transit === 'suspended' ? '目前暫停，建議改用替代方案' : '目前延誤，請預留緩衝時間', primary: '查看替代路線' })
      } else {
        cards.push({ title: '大眾運輸', desc: '目前營運正常', primary: '查看時刻表' })
      }
      const stations: Station[] = Array.isArray(live?.mobility?.stations) ? (live.mobility!.stations as Station[]) : []
      const bikes = stations.reduce((sum: number, s: Station) => sum + (Number(s?.bikesAvailable ?? s?.bikes_available ?? 0)), 0)
      if (bikes > 0) cards.push({ title: '共享單車', desc: `附近 ${stations.length} 個站點，共 ${bikes} 台可用`, primary: '預約' })
      const items: any[] = Array.isArray(j?.facilities?.items) ? j.facilities!.items : []
      
      // L3 Priority Logic (v4.2-beta Compliance)
      const hasWifi = items.some((f) => f.l3?.category === 'wifi' || String(f.type).includes('wifi'))
      const hasToilet = items.some((f) => f.l3?.category === 'toilet' || String(f.type).includes('toilet'))
      const hasCharging = items.some((f) => f.l3?.category === 'charging' || /charge|outlet/i.test(String(f.type)))
      if (hasWifi) cards.push({ title: '連線點', desc: '可用 Wi-Fi 熱點', primary: '查看詳情' })
      if (hasToilet) cards.push({ title: '廁所', desc: '附近可使用的公共廁所', primary: '導航' })
      if (hasCharging) cards.push({ title: '充電', desc: '可使用電源或充電座', primary: '前往' })
      
      const isWeather = /天氣|下雨|雨備/i.test(query)
      if (isWeather) {
        cards.unshift({ title: '天氣提醒', desc: '目前無即時天氣資訊，建議攜帶雨具', primary: '查看預報' })
      }
      
      const isNav = /導航|路線|怎麼走/i.test(query)
      if (isNav) {
        cards.unshift({ title: '導航指引', desc: '詳細導航功能即將推出，請參考地圖路徑', primary: '開啟地圖' })
      }

      if (!cards.length) cards.push({ title: '探索附近', desc: '暫無明確建議，可探索周邊', primary: '開始探索' })
      return new NextResponse(
        JSON.stringify({ fallback: { primary: cards[0], secondary: cards.slice(1) }, echo: { q: query } }),
        { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-API-Version': 'v1' } }
      )
    } catch {
      return new NextResponse(
        JSON.stringify({ fallback: { cards: [{ title: '暫無資料', desc: '服務暫不可用，請稍後重試' }] }, echo: { q: query } }),
        { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-API-Version': 'v1' } }
      )
    }
  }

  // Fetch Node Context if nodeId is present
  let systemContext = ''
  let trapAlertsGlobal: string[] = []
  if (nodeId) {
    try {
      const { data } = await supabase
        .from('nodes')
        .select('name, persona_prompt, metadata')
        .eq('id', nodeId)
        .single()
      
      if (data) {
        const nameObj = (data.name as Record<string, string> | null) || null
        const name = nameObj?.['zh-TW'] || nameObj?.zh || nameObj?.en || '此地點'
        const prompt = data.persona_prompt || ''
        // Construct a rich context
        systemContext = `
[目前所在位置] ${name}
[在地嚮導提示] ${prompt}
[重要規則]
1. 你是 BambiGO 的在地嚮導，必須展現對該地點「結構與空間」的深刻理解。
2. 回答轉乘或移動問題時，禁止只給出「時間」，必須描述「過程中的阻力」（如：手扶梯數量、樓層落差、通道長度、心理感受）。
3. 若遇到東京車站京葉線、上野新幹線等複雜場景，請明確告知「心理建設」，例如「這段路很遠，請預留從容的時間」。
4. 請基於以上[在地嚮導提示]與你的知識庫回答。
`

        const trapAlerts: string[] = []
        const nameEn = (nameObj?.en || '').toLowerCase()
        const qLower = q.toLowerCase()
        type TrapMeta = { transfer_friction?: Record<string, { minutes?: number; difficulty?: string; notes?: string }>; time_buffer_required_minutes?: number }
        const meta: TrapMeta = (data.metadata as TrapMeta) || {}
        const timeMatch = (() => {
          const m1 = qLower.match(/(\d{1,2})\s*[:：]\s*(\d{2})/)
          if (m1) return `${m1[1]}:${m1[2]}`
          const m2 = qLower.match(/(\d{1,2})\s*(點|時)/)
          if (m2) return `${m2[1]}:00`
          return null
        })()

        const hasWord = (t: string) => q.includes(t) || qLower.includes(t.toLowerCase())
        const includesAny = (arr: string[]) => arr.some((w) => hasWord(w))
        type Trap = { id: string; keywords?: string[]; regex?: string; severity?: 'extreme' | 'high' | 'medium'; buffer_minutes?: number; message: string }
        const dedup = new Set<string>()

        const traps = (meta as { traps?: Trap[] }).traps || []
        for (const t of traps) {
          let matched = false
          if (t.keywords && t.keywords.length) {
            if (includesAny(t.keywords)) matched = true
          }
          if (!matched && t.regex) {
            try {
              const re = new RegExp(t.regex, 'i')
              if (re.test(q)) matched = true
            } catch {}
          }
          if (matched) {
            const extra = t.buffer_minutes && timeMatch ? ` 若您搭乘 ${timeMatch}，請至少提前 ${t.buffer_minutes} 分鐘完成關鍵步驟。` : ''
            const msg = `${t.message}${extra}`
            if (!dedup.has(msg)) {
              trapAlerts.push(msg)
              dedup.add(msg)
            }
          }
        }

        if (nameEn.includes('tokyo')) {
          const hit = includesAny(['京葉線', 'Keiyo', 'ディズニー']) || includesAny(['disney'])
          if (hit) {
            const min = Number(meta?.transfer_friction?.Keiyo_Line?.minutes) || 20
            trapAlerts.push(`東京站京葉線月台位於深層且距離遠，請預留至少 ${min} 分鐘步行時間，避免發車前 5 分鐘才抵達入口。`)
          }
        }

        if (nameEn.includes('ueno')) {
          const hit = includesAny(['新幹線', 'Shinkansen'])
          if (hit) {
            const min = Number(meta?.time_buffer_required_minutes) || Number(meta?.transfer_friction?.Shinkansen?.minutes) || 15
            const hint = timeMatch ? `若您搭乘 ${timeMatch} 的新幹線，請在發車前至少 ${min} 分鐘通過專用改札。` : `請預留至少 ${min} 分鐘，避免臨發車才到入口。`
            trapAlerts.push(`上野站新幹線月台位於地下深處，從進站到月台需長距離移動。${hint}`)
          }
        }

        if (nameEn.includes('kuramae')) {
          const hit = includesAny(['大江戸線', 'Oedo']) && includesAny(['浅草線', 'Asakusa'])
          if (hit) {
            trapAlerts.push('藏前站大江戶線與淺草線為獨立站體，需出站步行轉乘，雨天需準備雨具並預留室外移動時間。')
          }
        }

        if (nameEn.includes('akihabara')) {
          const hit = includesAny(['筑波快線', 'TX', 'Tsukuba'])
          if (hit) {
            const min = Number(meta?.transfer_friction?.Tsukuba_Express?.minutes) || 12
            trapAlerts.push(`秋葉原站筑波快線月台極深，手扶梯很長，請預留至少 ${min} 分鐘的垂直移動時間。`)
          }
        }

        if (nameEn.includes('otemachi')) {
          const hit = includesAny(['轉乘', 'transfer']) || includesAny(['半蔵門線', 'Z', '千代田線', 'C', '丸ノ内線', 'M'])
          if (hit) {
            trapAlerts.push('大手町站地下連絡網極為龐大，跨線移動距離長，人潮密集，請預留 8–12 分鐘並優先選擇電梯動線。')
          }
        }

        if (nameEn.includes('nihombashi') || nameEn.includes('nihonbashi')) {
          const hit = includesAny(['東西線', 'Tozai']) || includesAny(['銀座線', 'Ginza', '浅草線', 'Asakusa'])
          if (hit) {
            trapAlerts.push('日本橋站跨線通道冗長且導引複雜，東西線至銀座/淺草線轉乘建議預留 10 分鐘，避免尖峰逆流。')
          }
        }

        if (trapAlerts.length) {
          systemContext += `\n[即時提醒]\n${trapAlerts.map((t) => `- ${t}`).join('\n')}\n`
        }
        trapAlertsGlobal = trapAlerts
      }
    } catch (err) {
      console.warn('Failed to fetch node context:', err)
    }
  }

  const provider = (process.env.AI_PROVIDER || 'mock').toLowerCase()
  const mode = routeMode(q)

  if (mode === 'tool') {
    return await buildToolFallback(nodeId || null, q)
  }

  if (mode === 'rule' && systemContext) {
    const alertCards = trapAlertsGlobal.map((msg) => ({ title: '即時提醒', desc: msg, primary: '了解' }))
    const ctxCard = { title: '在地嚮導', desc: '已套用節點脈絡提示', primary: '繼續' }
    return new NextResponse(
      JSON.stringify({ fallback: { primary: ctxCard, secondary: alertCards }, echo: { q } }),
      { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-API-Version': 'v1' } }
    )
  }
  
  if (provider === 'dify') {
    const apiKey = process.env.DIFY_API_KEY
    const apiUrl = process.env.DIFY_API_URL
    if (!apiKey || !apiUrl) {
      return new NextResponse(
        JSON.stringify({ error: { code: 'CONFIG_ERROR', message: 'Dify credentials missing' } }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    try {
      const difyRes = await fetch(`${apiUrl}/chat-messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: {
            // Inject context into Dify variables if configured, or prepend to query
            context: systemContext
          },
          query: systemContext ? `${systemContext}\n\n用戶問題: ${q}` : q,
          response_mode: 'streaming',
          user: 'bambigo-user', 
          auto_generate_name: false
        }),
      })

      if (!difyRes.ok) {
        const errText = await difyRes.text()
        console.error('Dify API error:', difyRes.status, errText)
        throw new Error(`Dify API error: ${difyRes.status}`)
      }

      if (!difyRes.body) throw new Error('No response body from Dify')

      const encoder = new TextEncoder()
      const decoder = new TextDecoder()
      const reader = difyRes.body.getReader()

      const stream = new ReadableStream({
        async start(controller) {
          const write = (data: string) => controller.enqueue(encoder.encode(`data: ${data}\n\n`))
          if (trapAlertsGlobal.length) {
            write(JSON.stringify({ role: 'ai', type: 'alerts', content: trapAlertsGlobal }))
          }
          
          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) {
                write(JSON.stringify({ role: 'ai', type: 'done' }))
                controller.close()
                break
              }
              
              const chunk = decoder.decode(value, { stream: true })
              const lines = chunk.split('\n').filter(line => line.trim().startsWith('data: '))
              
              for (const line of lines) {
                try {
                  const jsonStr = line.replace('data: ', '').trim()
                  const data = JSON.parse(jsonStr)
                  
                  // 處理 Dify 的不同事件類型
                  if (data.event === 'message' || data.event === 'agent_message') {
                    const content = data.answer || ''
                    if (content) {
                      write(JSON.stringify({ role: 'ai', type: 'text', content }))
                    }
                  } else if (data.event === 'workflow_finished' || data.event === 'message_end') {
                    // 結束信號將在循環結束時發送
                  } else if (data.event === 'error') {
                     console.error('Dify stream error:', data)
                  }
                } catch {
                  // 忽略解析錯誤（可能是部分 chunk）
                }
              }
            }
          } catch (e) {
            console.error('Stream processing error:', e)
            controller.error(e)
          }
        },
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-API-Version': 'v1',
        },
      })

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      console.error('Dify integration error:', errorMsg)
      return new NextResponse(
        JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: errorMsg } }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }

  if (provider === 'mock') {
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        const write = (data: string) => controller.enqueue(encoder.encode(`data: ${data}\n\n`))
        if (trapAlertsGlobal.length) {
          write(JSON.stringify({ role: 'ai', type: 'alerts', content: trapAlertsGlobal }))
        }
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
