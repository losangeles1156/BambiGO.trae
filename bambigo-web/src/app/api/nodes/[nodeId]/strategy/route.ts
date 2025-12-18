import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { StrategyEngine } from '@/lib/ai/strategy';

export async function POST(
  request: NextRequest,
  { params }: { params: { nodeId: string } }
) {
  const nodeId = params.nodeId;
  const context = await request.json(); // { weather, time }

  // 1. Fetch tags for this node
  const { data: facilities, error } = await supabase
    .from('facilities')
    .select('*')
    .eq('node_id', nodeId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 2. Generate Strategy using Engine
  const strategies = StrategyEngine.generate(facilities, context);

  return NextResponse.json(strategies[0]);
}
