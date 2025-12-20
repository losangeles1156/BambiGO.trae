import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { StrategyEngine } from '@/lib/ai/strategy';
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
  const context = await request.json();

  // 1. Fetch tags for this node
  const { data: facilities, error } = await supabase
    .from('facilities')
    .select('*')
    .eq('node_id', nodeId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: nodeRow } = await supabase
    .from('nodes')
    .select('metadata, persona_prompt, type')
    .eq('id', nodeId)
    .maybeSingle();

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

  const meta = nodeRow?.metadata as Record<string, unknown> | null | undefined
  const personaArchetype = typeof meta?.persona_archetype === 'string' ? (meta.persona_archetype as string) : undefined

  const strategies = StrategyEngine.generate(facilities || [], {
    ...context,
    now: new Date(),
    personaArchetype,
    personaLabels
  });

  return NextResponse.json(strategies);
}
