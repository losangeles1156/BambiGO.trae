import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { L1Tag, L3ServiceFacility, L1Category, L3Category } from '@/types/tagging';
import { L3CategorySchema } from '@/lib/validators/tagging';

// Define categories to distinguish L1 vs L3
const L1_CATEGORIES = new Set([
  'dining', 'shopping', 'medical', 'leisure', 'education', 'finance',
  'accommodation', 'business', 'religion', 'nature', 'transport', 'public', 'residential'
]);

const L3_TYPE_MAP: Record<string, L3Category> = {
  toilet: 'toilet',
  restroom: 'toilet',
  wc: 'toilet',
  charging: 'charging',
  power_outlet: 'charging',
  wifi: 'wifi',
  locker: 'locker',
  coin_locker: 'locker',
  accessibility: 'accessibility',
  elevator: 'accessibility',
  escalator: 'accessibility',
  ramp: 'accessibility',
  rest_area: 'rest_area',
  bench: 'rest_area',
  smoking_area: 'rest_area',
  shelter: 'shelter',
  medical_aid: 'medical_aid',
};

function requireAdminWrite(req: NextRequest): Response | null {
  if (process.env.NODE_ENV !== 'production') return null
  const expected = (process.env.ADMIN_WRITE_KEY || '').trim()
  if (!expected) {
    return NextResponse.json(
      { error: { code: 'ADMIN_WRITE_NOT_CONFIGURED', message: 'Admin write is not configured' } },
      { status: 503 }
    )
  }
  const provided = (req.headers.get('x-admin-key') || '').trim()
  if (provided !== expected) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
      { status: 401 }
    )
  }
  return null
}

function parseWKBPoint(hex: string): [number, number] | null {
  try {
    const buffer = Buffer.from(hex, 'hex');
    if (buffer.length < 21) return null;
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const littleEndian = view.getUint8(0) === 1;
    const type = view.getUint32(1, littleEndian);
    let offset = 5;
    if ((type & 0x20000000) !== 0) offset += 4;
    if (offset + 16 > buffer.length) return null;
    const x = view.getFloat64(offset, littleEndian);
    const y = view.getFloat64(offset + 8, littleEndian);
    return [x, y];
  } catch {
    return null;
  }
}

function normalizeL3Category(rawType: string | null | undefined): { category: L3Category; normalizedType: string } {
  const normalizedType = String(rawType || 'other').trim().toLowerCase();
  const mapped = L3_TYPE_MAP[normalizedType];
  if (mapped) return { category: mapped, normalizedType };
  const direct = L3CategorySchema.safeParse(normalizedType);
  if (direct.success) return { category: normalizedType as L3Category, normalizedType };
  return { category: 'other', normalizedType };
}

function normalizeSource(sourceDataset: string | null | undefined): 'manual' | 'osm' | 'official' {
  const s = (sourceDataset || '').toLowerCase();
  if (s.includes('osm')) return 'osm';
  if (s.includes('official') || s.includes('odpt') || s.includes('jr') || s.includes('tokyometro') || s.includes('keisei')) return 'official';
  return 'manual';
}

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ nodeId: string }> }
) {
  const params = await props.params;
  const nodeId = params.nodeId;

  if (nodeId === 'mock-ueno' || nodeId === 'mock-ueno-station') {
    const l1: L1Tag[] = [];
    const l3: L3ServiceFacility[] = [
      {
        id: 'mock-ueno-toilet-metro-ginza',
        nodeId,
        category: 'toilet',
        subCategory: 'station_toilet',
        location: { floor: 'B1', direction: 'Tokyo Metro Ginza Line concourse' },
        provider: { type: 'station', name: 'Tokyo Metro' },
        attributes: {
          has_wheelchair_access: true,
          has_baby_care: true,
          gender: 'unisex',
          reference_urls: [
            'https://www.tokyometro.jp/station/ueno/accessibility/index.html',
          ],
        },
        source: 'official',
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'mock-ueno-toilet-metro-hibiya',
        nodeId,
        category: 'toilet',
        subCategory: 'station_toilet',
        location: { floor: 'B1', direction: 'Tokyo Metro Hibiya Line concourse' },
        provider: { type: 'station', name: 'Tokyo Metro' },
        attributes: {
          has_wheelchair_access: true,
          has_baby_care: true,
          gender: 'unisex',
          reference_urls: [
            'https://www.tokyometro.jp/station/ueno/accessibility/index.html',
          ],
        },
        source: 'official',
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'mock-ueno-toilet-jr-1f-central',
        nodeId,
        category: 'toilet',
        subCategory: 'station_toilet',
        location: { floor: '1F', direction: 'JR Central Gate area' },
        provider: { type: 'station', name: 'JR East' },
        attributes: {
          has_wheelchair_access: true,
          has_baby_care: false,
          gender: 'unisex',
          reference_urls: [
            'https://www.jreast.co.jp/en/estation/stations/204.html',
          ],
        },
        source: 'official',
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'mock-ueno-toilet-jr-3f-park',
        nodeId,
        category: 'toilet',
        subCategory: 'station_toilet',
        location: { floor: '3F', direction: 'JR Park Gate / Iriya Gate area' },
        provider: { type: 'station', name: 'JR East' },
        attributes: {
          has_wheelchair_access: true,
          has_baby_care: false,
          gender: 'unisex',
          reference_urls: [
            'https://www.jreast.co.jp/en/estation/stations/204.html',
          ],
        },
        source: 'official',
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'mock-ueno-locker-jr-1f-central',
        nodeId,
        category: 'locker',
        subCategory: 'coin_locker',
        location: { floor: '1F', direction: 'JR Central Gate area' },
        provider: { type: 'station', name: 'JR East' },
        attributes: {
          locker_bank_count: 4,
          payment: ['Cash', 'IC Card'],
          size: ['SS', 'S', 'M', 'L', 'LL'],
          reference_urls: [
            'https://media.jreast.co.jp/articles/1010',
          ],
        },
        source: 'official',
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'mock-ueno-locker-jr-m2-shinobazu',
        nodeId,
        category: 'locker',
        subCategory: 'coin_locker',
        location: { floor: 'M2', direction: 'JR Shinobazu Gate area' },
        provider: { type: 'station', name: 'JR East' },
        attributes: {
          locker_bank_count: 3,
          payment: ['Cash', 'IC Card'],
          size: ['SS', 'S', 'M', 'L', 'LL'],
          reference_urls: [
            'https://media.jreast.co.jp/articles/1010',
          ],
        },
        source: 'official',
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'mock-ueno-locker-jr-3f-iriya-park',
        nodeId,
        category: 'locker',
        subCategory: 'coin_locker',
        location: { floor: '3F', direction: 'JR Iriya Gate / Park Gate area' },
        provider: { type: 'station', name: 'JR East' },
        attributes: {
          locker_bank_count: 3,
          payment: ['Cash', 'IC Card'],
          size: ['SS', 'S', 'M', 'L', 'LL'],
          reference_urls: [
            'https://media.jreast.co.jp/articles/1010',
          ],
        },
        source: 'official',
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'mock-ueno-locker-jr-2f-higashi',
        nodeId,
        category: 'locker',
        subCategory: 'coin_locker',
        location: { floor: '2F', direction: 'JR Higashi-Ueno Exit area' },
        provider: { type: 'station', name: 'JR East' },
        attributes: {
          locker_bank_count: 1,
          payment: ['Cash', 'IC Card'],
          size: ['S', 'M', 'L'],
          reference_urls: [
            'https://media.jreast.co.jp/articles/1010',
          ],
        },
        source: 'official',
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'mock-ueno-locker-metro-summary',
        nodeId,
        category: 'locker',
        subCategory: 'coin_locker',
        location: { floor: 'B1', direction: 'Tokyo Metro Ueno Station (summary)' },
        provider: { type: 'station', name: 'Tokyo Metro' },
        attributes: {
          locker_bank_count: 5,
          payment: ['Cash', 'IC Card'],
          size: ['SS', 'S', 'M', 'L', 'LL'],
          reference_urls: [
            'https://media.jreast.co.jp/articles/1010',
            'https://www.tokyometro.jp/station/ueno/yardmap/index_print.html',
          ],
        },
        source: 'official',
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'mock-ueno-locker-keisei-summary',
        nodeId,
        category: 'locker',
        subCategory: 'coin_locker',
        location: { floor: 'B1', direction: 'Keisei Ueno Station (summary)' },
        provider: { type: 'station', name: 'Keisei' },
        attributes: {
          locker_bank_count: 3,
          payment: ['Cash', 'IC Card'],
          size: ['SS', 'S', 'M', 'L', 'LL'],
          reference_urls: [
            'https://media.jreast.co.jp/articles/1010',
          ],
        },
        source: 'official',
        updatedAt: new Date().toISOString(),
      },
    ];
    return NextResponse.json({ l1, l3 });
  }

  const { data: facilities, error } = await supabase
    .from('facilities')
    .select('*')
    .eq('node_id', nodeId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const l1Tags: L1Tag[] = [];
  const l3Facilities: L3ServiceFacility[] = [];

  type Row = {
    id: string
    node_id: string
    type: string
    attributes?: Record<string, unknown>
    name?: Record<string, unknown>
    distance_meters?: number
    direction?: string
    floor?: string
    location?: string | null
    source_dataset?: string
    updated_at?: string
  }
  ;(facilities || []).forEach((row: Row) => {
    // Determine if L1 or L3 based on type/category
    // Note: The DB column is 'type'
    
    if (L1_CATEGORIES.has(row.type)) {
      // Map to L1Tag
      l1Tags.push({
        id: row.id,
        nodeId: row.node_id,
        mainCategory: row.type as L1Category,
        subCategory: String((row.attributes as { subCategory?: unknown } | undefined)?.subCategory || 'unknown'),
        detailCategory: (row.attributes as { detailCategory?: string } | undefined)?.detailCategory,
        brand: (row.attributes as { brand?: string } | undefined)?.brand,
        name: row.name || {}, // Assuming JSONB name
        distanceMeters: row.distance_meters,
        direction: row.direction
      });
    } else {
      const { category, normalizedType } = normalizeL3Category(row.type);
      const attrs = (row.attributes || {}) as Record<string, unknown>;
      const locationCoords = typeof row.location === 'string' ? parseWKBPoint(row.location) : null;

      const subCategory = (() => {
        const s1 = (attrs as { subCategory?: unknown } | undefined)?.subCategory;
        if (typeof s1 === 'string' && s1.trim()) return s1;
        const s2 = (attrs as { sub_type?: unknown } | undefined)?.sub_type;
        if (typeof s2 === 'string' && s2.trim()) return s2;
        return normalizedType;
      })();

      l3Facilities.push({
        id: row.id,
        nodeId: row.node_id,
        category,
        subCategory,
        location: {
          floor: row.floor,
          direction: row.direction,
          coordinates: locationCoords || undefined,
        },
        provider: (() => {
          const p = (attrs as { provider?: { type?: string; name?: string; requiresPurchase?: boolean } } | undefined)?.provider
          const type: 'public' | 'station' | 'shop' = p?.type === 'station' ? 'station' : p?.type === 'shop' ? 'shop' : 'public'
          return { type, name: p?.name, requiresPurchase: p?.requiresPurchase }
        })(),
        attributes: attrs,
        openingHours: ((): string | undefined => {
          const oh = (attrs as { openingHours?: unknown } | undefined)?.openingHours
          return typeof oh === 'string' && oh.trim() ? oh : undefined
        })(),
        source: normalizeSource(row.source_dataset),
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
  const guard = requireAdminWrite(request)
  if (guard) return guard
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: { code: 'ADMIN_DB_NOT_CONFIGURED', message: 'Supabase admin client is not configured' } },
      { status: 503 }
    )
  }
  const params = await props.params;
  const nodeId = params.nodeId;
  let body: Record<string, unknown> | null = null
  try {
    const parsed: unknown = await request.json()
    body = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } },
      { status: 400 }
    )
  }
  const layer = body?.layer
  const data = body?.data

  if (!layer || !data) {
    return NextResponse.json({ error: 'Missing layer or data' }, { status: 400 });
  }

  let dbRow: Record<string, unknown> = {};

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

export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ nodeId: string }> }
) {
  const guard = requireAdminWrite(request)
  if (guard) return guard
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: { code: 'ADMIN_DB_NOT_CONFIGURED', message: 'Supabase admin client is not configured' } },
      { status: 503 }
    )
  }
  const params = await props.params;
  const nodeId = params.nodeId;
  const { searchParams } = new URL(request.url);
  const tagId = searchParams.get('id');
  let body: Record<string, unknown> | null = null
  try {
    const parsed: unknown = await request.json()
    body = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } },
      { status: 400 }
    )
  }
  const layer = body?.layer
  const data = body?.data

  if (!tagId) {
    return NextResponse.json({ error: 'Missing tag ID' }, { status: 400 });
  }
  if (!layer || !data) {
    return NextResponse.json({ error: 'Missing layer or data' }, { status: 400 });
  }

  let dbRow: Record<string, unknown> = {};

  if (layer === 'L1') {
    const tag = data as L1Tag;
    dbRow = {
      type: tag.mainCategory,
      name: tag.name,
      distance_meters: tag.distanceMeters,
      direction: tag.direction,
      attributes: {
        subCategory: tag.subCategory,
        detailCategory: tag.detailCategory,
        brand: tag.brand
      },
      updated_at: new Date().toISOString()
    };
  } else if (layer === 'L3') {
    const facility = data as L3ServiceFacility;
    dbRow = {
      type: facility.category,
      name: facility.provider?.name ? { en: facility.provider.name } : null,
      floor: facility.location?.floor,
      direction: facility.location?.direction,
      attributes: {
        ...facility.attributes,
        subCategory: facility.subCategory,
        provider: facility.provider,
        openingHours: facility.openingHours
      },
      updated_at: new Date().toISOString()
    };
  } else {
    return NextResponse.json({ error: 'Invalid layer' }, { status: 400 });
  }

  const { data: updated, error } = await supabaseAdmin
    .from('facilities')
    .update(dbRow)
    .eq('id', tagId)
    .eq('node_id', nodeId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ nodeId: string }> }
) {
  const guard = requireAdminWrite(request)
  if (guard) return guard
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: { code: 'ADMIN_DB_NOT_CONFIGURED', message: 'Supabase admin client is not configured' } },
      { status: 503 }
    )
  }
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
