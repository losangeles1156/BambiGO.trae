import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { StrategyEngine } from '@/lib/ai/strategy';
import { fetchTransportKnowledge } from '@/lib/ai/knowledge';
import { derivePersonaFromFacilities } from '@/lib/tagging';
import type { L1Category } from '@/types/tagging';

const L1_CATEGORIES = new Set<L1Category>([
  'dining',
  'shopping',
  'medical',
  'leisure',
  'education',
  'finance',
  'accommodation',
  'business',
  'religion',
  'public',
  'transport',
  'nature',
  'residential'
]);

function deriveL1Context(
  nodeType: string | undefined,
  facilities: Array<{ type?: string; attributes?: Record<string, unknown> }>
): { l1MainCategory?: string; l1SubCategory?: string } {
  const counts = new Map<L1Category, number>();
  const subCounts = new Map<string, number>();

  for (const f of facilities) {
    const rawType = String(f.type || '').toLowerCase() as L1Category
    if (!L1_CATEGORIES.has(rawType)) continue
    counts.set(rawType, (counts.get(rawType) || 0) + 1)

    const attrs = (f.attributes || {}) as Record<string, unknown>
    const sub = typeof attrs.subCategory === 'string' ? attrs.subCategory : ''
    if (sub) subCounts.set(sub, (subCounts.get(sub) || 0) + 1)
  }

  let main: string | undefined
  let top = 0
  for (const [k, v] of counts.entries()) {
    if (v > top) {
      top = v
      main = k
    }
  }

  let sub: string | undefined
  let subTop = 0
  for (const [k, v] of subCounts.entries()) {
    if (v > subTop) {
      subTop = v
      sub = k
    }
  }

  const normalizedNodeType = typeof nodeType === 'string' ? nodeType.toLowerCase() : ''
  if (!main) {
    if (normalizedNodeType === 'station') main = 'transport'
    else if (L1_CATEGORIES.has(normalizedNodeType as L1Category)) main = normalizedNodeType
  }
  if (!sub) {
    if (normalizedNodeType) sub = normalizedNodeType
  }

  return { l1MainCategory: main, l1SubCategory: sub }
}

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ nodeId: string }> }
) {
  const params = await props.params;
  const nodeId = params.nodeId;
  let context: Record<string, unknown> = {}
  try {
    const parsed: unknown = await request.json()
    if (parsed && typeof parsed === 'object') context = parsed as Record<string, unknown>
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } },
      { status: 400 }
    )
  }

  // 1. Fetch tags for this node
  const { data: facilities, error } = await supabase
    .from('facilities')
    .select('*')
    .eq('node_id', nodeId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: nodeRows, error: nodeError } = await supabase
    .from('nodes')
    .select('metadata, persona_prompt, type')
    .eq('id', nodeId)
    .limit(1)

  if (nodeError) {
    return NextResponse.json({ error: nodeError.message }, { status: 500 })
  }

  const nodeRow = Array.isArray(nodeRows) ? nodeRows[0] : nodeRows

  // 1.5 Fetch Knowledge
  const userStates = Array.isArray(context.userStates) ? context.userStates : [];
  const knowledgeMap = await fetchTransportKnowledge({
    nodeId,
    userStates
  });

  type FacilityRow = { type?: string; subCategory?: string; attributes?: Record<string, unknown> }
  const l1Context = deriveL1Context(
    typeof (nodeRow as unknown as { type?: string } | null | undefined)?.type === 'string'
      ? ((nodeRow as unknown as { type?: string }).type as string)
      : undefined,
    (facilities || []) as Array<{ type?: string; attributes?: Record<string, unknown> }>
  )
  const personaLabels = derivePersonaFromFacilities(
    (facilities || []).map((f: FacilityRow) => ({
      type: String(f.type || f.subCategory || (f.attributes && (f.attributes as Record<string, unknown>).subCategory) || ''),
      has_wheelchair_access: !!(f.attributes && (f.attributes as Record<string, unknown>).has_wheelchair_access),
      has_baby_care: !!(f.attributes && (f.attributes as Record<string, unknown>).has_baby_care)
    })),
    {
      ...l1Context
    }
  );

  const normalizedFacilities = (facilities || []).map((f: FacilityRow) => ({
    type: String(f.type || f.subCategory || (f.attributes && (f.attributes as Record<string, unknown>).subCategory) || ''),
    attributes: (f.attributes || {}) as Record<string, unknown>,
  }))

  const meta = nodeRow?.metadata as Record<string, unknown> | null | undefined
  const personaArchetype = typeof meta?.persona_archetype === 'string' ? (meta.persona_archetype as string) : undefined

  const odptStation = (() => {
    const raw = context.odptStation
    if (!raw || typeof raw !== 'object') return undefined
    const r = raw as Record<string, unknown>
    const connectingRailways = Array.isArray(r.connecting_railways) && r.connecting_railways.every((v) => typeof v === 'string')
      ? (r.connecting_railways as string[])
      : undefined
    const exits = Array.isArray(r.exits) && r.exits.every((v) => typeof v === 'string')
      ? (r.exits as string[])
      : undefined
    return {
      station_code: typeof r.station_code === 'string' ? r.station_code : undefined,
      railway: typeof r.railway === 'string' ? r.railway : undefined,
      operator: typeof r.operator === 'string' ? r.operator : undefined,
      connecting_railways: connectingRailways,
      exits,
      raw: r,
    }
  })()

  const cards = StrategyEngine.generate(
    normalizedFacilities,
    {
      ...context,
      time: typeof context.time === 'string' ? context.time : undefined,
      now: typeof context.time === 'string' ? new Date(context.time) : new Date(),
      personaArchetype,
      personaLabels,
      odptStation,
      userStates,
      knowledgeMap
    }
  );

  return NextResponse.json(cards);
}
