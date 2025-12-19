import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { L1Tag, L3ServiceFacility, L1Category, L3Category } from '@/types/tagging';

// Define categories to distinguish L1 vs L3
const L1_CATEGORIES = new Set([
  'dining', 'shopping', 'medical', 'leisure', 'education', 'finance',
  'accommodation', 'business', 'religion', 'nature', 'transport', 'public', 'residential'
]);

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ nodeId: string }> }
) {
  const params = await props.params;
  const nodeId = params.nodeId;

  const { data: facilities, error } = await supabase
    .from('facilities')
    .select('*')
    .eq('node_id', nodeId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const l1Tags: L1Tag[] = [];
  const l3Facilities: L3ServiceFacility[] = [];

  facilities.forEach((row: any) => {
    // Determine if L1 or L3 based on type/category
    // Note: The DB column is 'type'
    
    if (L1_CATEGORIES.has(row.type)) {
      // Map to L1Tag
      l1Tags.push({
        id: row.id,
        nodeId: row.node_id,
        mainCategory: row.type as L1Category,
        subCategory: row.attributes?.subCategory || 'unknown',
        detailCategory: row.attributes?.detailCategory,
        brand: row.attributes?.brand,
        name: row.name || {}, // Assuming JSONB name
        distanceMeters: row.distance_meters,
        direction: row.direction
      });
    } else {
      // Assume L3 for everything else (or check L3 categories)
      // Map to L3ServiceFacility
      l3Facilities.push({
        id: row.id,
        nodeId: row.node_id,
        category: row.type as L3Category,
        subCategory: row.attributes?.subCategory || 'unknown',
        location: {
          floor: row.floor,
          direction: row.direction,
          // coordinates: ... (if available in row)
        },
        provider: row.attributes?.provider || { type: 'public' },
        attributes: row.attributes || {},
        openingHours: row.attributes?.openingHours,
        source: row.source_dataset === 'osm' ? 'osm' : 'manual', // Simple mapping
        updatedAt: row.updated_at
      });
    }
  });

  return NextResponse.json({ l1: l1Tags, l3: l3Facilities });
}

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ nodeId: string }> }
) {
  const params = await props.params;
  const nodeId = params.nodeId;
  const body = await request.json();
  const { layer, data } = body; // Expecting { layer: 'L1' | 'L3', data: ... }

  if (!layer || !data) {
    return NextResponse.json({ error: 'Missing layer or data' }, { status: 400 });
  }

  let dbRow: any = {};

  if (layer === 'L1') {
    const tag = data as Omit<L1Tag, 'id' | 'nodeId'>;
    dbRow = {
      node_id: nodeId,
      type: tag.mainCategory,
      name: tag.name,
      distance_meters: tag.distanceMeters,
      direction: tag.direction,
      attributes: {
        subCategory: tag.subCategory,
        detailCategory: tag.detailCategory,
        brand: tag.brand
      },
      source_dataset: 'manual'
    };
  } else if (layer === 'L3') {
    const facility = data as Omit<L3ServiceFacility, 'id' | 'nodeId'>;
    dbRow = {
      node_id: nodeId,
      type: facility.category,
      // L3 might not have a 'name' in the same way, but let's store provider name if exists
      name: facility.provider?.name ? { en: facility.provider.name } : null,
      floor: facility.location?.floor,
      direction: facility.location?.direction,
      attributes: {
        ...facility.attributes,
        subCategory: facility.subCategory,
        provider: facility.provider,
        openingHours: facility.openingHours
      },
      source_dataset: 'manual'
    };
  } else {
    return NextResponse.json({ error: 'Invalid layer' }, { status: 400 });
  }

  const { data: inserted, error } = await supabaseAdmin
    .from('facilities')
    .insert(dbRow)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(inserted);
}

export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ nodeId: string }> }
) {
  const params = await props.params;
  const { searchParams } = new URL(request.url);
  const tagId = searchParams.get('id');

  if (!tagId) {
    return NextResponse.json({ error: 'Missing tag ID' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('facilities')
    .delete()
    .eq('id', tagId)
    .eq('node_id', params.nodeId); // Ensure we only delete tags belonging to this node

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
