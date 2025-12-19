import 'dotenv/config'
import { XMLParser } from 'fast-xml-parser'
import fs from 'node:fs'
import path from 'node:path'

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export type OdptClientOptions = {
  token?: string
  baseUrl?: string
  userAgent?: string
  cacheDir?: string
  cacheTtlSec?: number
  maxRetries?: number
  throttleMs?: number
  fetchImpl?: FetchLike
}

export class OdptClient {
  private token: string
  private baseUrl: string
  private userAgent: string
  private cacheDir: string
  private cacheTtlSec: number
  private maxRetries: number
  private throttleMs: number
  private xml: XMLParser
  private fetchFn: FetchLike

  constructor(opts: OdptClientOptions = {}) {
    this.token = (opts.token || process.env.ODPT_API_TOKEN || '').trim()
    if (!this.token) throw new Error('ODPT_API_TOKEN is required')
    this.baseUrl = (opts.baseUrl || 'https://api.odpt.org/api/v4').replace(/\/$/, '')
    this.userAgent = opts.userAgent || 'BambiGO/odpt-client'
    this.cacheDir = opts.cacheDir || path.join(process.cwd(), '.cache', 'odpt')
    this.cacheTtlSec = opts.cacheTtlSec ?? 300
    this.maxRetries = Math.max(0, opts.maxRetries ?? 5)
    this.throttleMs = Math.max(0, opts.throttleMs ?? 100)
    this.xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' })
    this.fetchFn = opts.fetchImpl || (globalThis.fetch as FetchLike)
    if (!fs.existsSync(this.cacheDir)) fs.mkdirSync(this.cacheDir, { recursive: true })
  }

  private maskToken(s: string) {
    return s.replace(this.token, '***')
  }

  private cachePath(key: string) {
    const safe = key.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 200)
    return path.join(this.cacheDir, safe)
  }

  private async readCache(key: string): Promise<unknown | null> {
    const p = this.cachePath(key)
    try {
      const st = fs.statSync(p)
      const ageSec = (Date.now() - st.mtimeMs) / 1000
      if (ageSec > this.cacheTtlSec) return null
      const txt = fs.readFileSync(p, 'utf8')
      return JSON.parse(txt)
    } catch {
      return null
    }
  }

  private writeCache(key: string, data: unknown) {
    const p = this.cachePath(key)
    try {
      fs.writeFileSync(p, JSON.stringify(data))
    } catch {}
  }

  private async sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms))
  }

  private async request(pathname: string, params: Record<string, string | number | boolean> = {}) {
    const url = new URL(this.baseUrl + '/' + pathname.replace(/^\//, ''))
    // auth
    url.searchParams.set('acl:consumerKey', this.token)
    // params
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, String(v))
    }

    const cacheKey = url.toString()
    const cached = await this.readCache(cacheKey)
    if (cached) return cached

    let attempt = 0
    let delay = 300
    while (true) {
      try {
        const res = await this.fetchFn(url, {
          headers: {
            'Accept': 'application/json, application/xml;q=0.9,*/*;q=0.8',
            'User-Agent': this.userAgent,
          },
        })
        const ctype = res.headers.get('content-type') || ''
        if (!res.ok) {
          if ((res.status === 429 || res.status === 503) && attempt < this.maxRetries) {
            attempt++
            await this.sleep(delay + Math.floor(Math.random() * 150))
            delay = Math.min(5000, delay * 2)
            continue
          }
          // Non-retryable HTTP error
          const err = new Error(`ODPT HTTP ${res.status}`)
          ;(err as any).status = res.status
          throw err
        }
        let data: unknown
        if (ctype.includes('application/json')) {
          data = await res.json()
        } else if (ctype.includes('xml')) {
          const txt = await res.text()
          data = this.xml.parse(txt)
        } else {
          // try json first
          try {
            data = await res.json()
          } catch {
            const txt = await res.text()
            data = { content: txt }
          }
        }
        this.writeCache(cacheKey, data)
        await this.sleep(this.throttleMs)
        return data
      } catch (e: unknown) {
        // If it's a non-retryable ODPT HTTP error, throw it immediately
        if (e instanceof Error && (e as any).status && !([429, 503].includes((e as any).status))) {
          throw e
        }

        if (attempt < this.maxRetries) {
          attempt++
          await this.sleep(delay + Math.floor(Math.random() * 150))
          delay = Math.min(5000, delay * 2)
          continue
        }
        console.error('[ODPT] request failed:', this.maskToken(cacheKey), (e instanceof Error ? e.message : String(e)))
        throw e
      }
    }
  }

  // High-level resources
  async stationsByOperator(operators: string[]) {
    const out: unknown[] = []
    for (const op of operators) {
      const data = await this.request('odpt:Station', { 'odpt:operator': op })
      if (Array.isArray(data)) out.push(...data)
    }
    return out
  }

  async busstopPolesByOperator(operators: string[]) {
    const out: unknown[] = []
    for (const op of operators) {
      const data = await this.request('odpt:BusstopPole', { 'odpt:operator': op })
      if (Array.isArray(data)) out.push(...data)
    }
    return out
  }

  async barrierFreeByOperator(operators: string[]) {
    const out: unknown[] = []
    for (const op of operators) {
      try {
        const bf = await this.request('odpt:BarrierFreeFacility', { 'odpt:operator': op })
        if (Array.isArray(bf)) out.push(...bf)
        continue
      } catch {}
      try {
        const fac = await this.request('odpt:StationFacility', { 'odpt:operator': op })
        if (Array.isArray(fac)) out.push(...fac)
      } catch {}
    }
    return out
  }

  async trainsByOperator(operators: string[]) {
    const out: unknown[] = []
    for (const op of operators) {
      const data = await this.request('odpt:Train', { 'odpt:operator': op })
      if (Array.isArray(data)) out.push(...data)
    }
    return out
  }

  async trainInformationAll() {
    const data = await this.request('odpt:TrainInformation')
    return Array.isArray(data) ? data : []
  }
}

export default OdptClient
