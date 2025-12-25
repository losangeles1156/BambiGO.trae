import { NextResponse } from 'next/server'

type CrowdChoice = 'very_comfort' | 'comfort' | 'ok' | 'crowded' | 'very_crowded'

const choices: CrowdChoice[] = ['very_comfort', 'comfort', 'ok', 'crowded', 'very_crowded']

type CrowdState = {
  counts: Record<CrowdChoice, number>
  updatedAt: number
}

const globalForCrowd = globalThis as unknown as { __bambigoCrowdStore?: Map<string, CrowdState> }
const store = globalForCrowd.__bambigoCrowdStore || (globalForCrowd.__bambigoCrowdStore = new Map())

function emptyState(): CrowdState {
  return {
    counts: {
      very_comfort: 0,
      comfort: 0,
      ok: 0,
      crowded: 0,
      very_crowded: 0,
    },
    updatedAt: Date.now(),
  }
}

function normalize(state: CrowdState | undefined): CrowdState {
  const base = emptyState()
  if (!state) return base
  for (const k of choices) base.counts[k] = Math.max(0, Number(state.counts?.[k] ?? 0) || 0)
  base.updatedAt = Math.max(0, Number(state.updatedAt ?? 0) || 0)
  return base
}

function totalOf(counts: Record<CrowdChoice, number>): number {
  return choices.reduce((sum, k) => sum + (Number(counts[k]) || 0), 0)
}

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, props: { params: Promise<{ nodeId: string }> }) {
  const params = await props.params
  const nodeId = String(params.nodeId || '').trim()
  if (!nodeId) {
    return NextResponse.json({ error: { code: 'MISSING_NODE_ID', message: 'Missing nodeId' } }, { status: 400 })
  }

  const now = Date.now()
  for (const [k, v] of store.entries()) {
    if (now - (v.updatedAt || 0) > 1000 * 60 * 60 * 12) store.delete(k)
  }

  const state = normalize(store.get(nodeId))
  const total = totalOf(state.counts)
  return NextResponse.json(
    { node_id: nodeId, counts: state.counts, total, updated_at: new Date(state.updatedAt || now).toISOString() },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

export async function POST(req: Request, props: { params: Promise<{ nodeId: string }> }) {
  const params = await props.params
  const nodeId = String(params.nodeId || '').trim()
  if (!nodeId) {
    return NextResponse.json({ error: { code: 'MISSING_NODE_ID', message: 'Missing nodeId' } }, { status: 400 })
  }

  let body: unknown = null
  try {
    body = await req.json()
  } catch {
    body = null
  }

  const choice = String((body as { choice?: unknown } | null)?.choice || '').trim() as CrowdChoice
  if (!choices.includes(choice)) {
    return NextResponse.json({ error: { code: 'INVALID_CHOICE', message: 'Invalid choice' } }, { status: 400 })
  }

  const prev = normalize(store.get(nodeId))
  const next: CrowdState = {
    counts: { ...prev.counts, [choice]: (prev.counts[choice] || 0) + 1 },
    updatedAt: Date.now(),
  }
  store.set(nodeId, next)
  const total = totalOf(next.counts)
  return NextResponse.json(
    { node_id: nodeId, counts: next.counts, total, updated_at: new Date(next.updatedAt).toISOString() },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
