import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export async function GET() {
  try {
    const { count: nodesCount, error: nodesError } = await supabase.from('nodes').select('*', { count: 'exact', head: true });
    const { count: facilitiesCount, error: facilitiesError } = await supabase.from('facilities').select('*', { count: 'exact', head: true });
    
    const { data: sampleNode } = await supabase.from('nodes').select('*').limit(1).single();

    return NextResponse.json({ 
      success: true, 
      nodes: nodesCount, 
      facilities: facilitiesCount,
      sampleNode,
      errors: { nodes: nodesError, facilities: facilitiesError }
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
