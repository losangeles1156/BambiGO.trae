import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { StrategyEngine } from '@/lib/ai/strategy';
import { derivePersonaFromFacilities } from '@/lib/tagging';

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
    .select('metadata, persona_prompt')
    .eq('id', nodeId)
    .maybeSingle();

  const personaLabels = derivePersonaFromFacilities(
    (facilities || []).map((f: any) => ({
      type: String(f.type || f.subCategory || f.attributes?.subCategory || ''),
      has_wheelchair_access: !!(f.attributes?.has_wheelchair_access),
      has_baby_care: !!(f.attributes?.has_baby_care)
    })),
    undefined
  );

  const personaArchetype = (nodeRow?.metadata as any)?.persona_archetype as string | undefined;

  const strategies = StrategyEngine.generate(facilities || [], {
    ...context,
    now: new Date(),
    personaArchetype,
    personaLabels
  });

  return NextResponse.json(strategies);
}
