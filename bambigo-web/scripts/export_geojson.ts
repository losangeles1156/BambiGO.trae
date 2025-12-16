import 'dotenv/config'
import { Client } from 'pg'
import fs from 'node:fs'
import path from 'node:path'

async function main() {
  const conn = process.env.DATABASE_URL
  if (!conn) throw new Error('DATABASE_URL missing')
  const client = new Client({ connectionString: conn })
  await client.connect()
  try {
    const { rows } = await client.query<{
      lon: number
      lat: number
      name: unknown
      supply_tags: unknown
      suitability_tags: unknown
      external_links: unknown
      category: string | null
      odpt_id: string | null
    }>(`
      select
        ST_X(geom::geometry) as lon,
        ST_Y(geom::geometry) as lat,
        name,
        supply_tags,
        suitability_tags,
        external_links,
        category,
        odpt_id
      from public.nodes
      where geom is not null
    `)
    const features = rows.map((r) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lon, r.lat] },
      properties: {
        odpt_id: r.odpt_id,
        name: r.name as { ja?: string; en?: string; zh?: string },
        supply_tags: r.supply_tags as string[],
        suitability_tags: r.suitability_tags as string[],
        external_links: r.external_links,
        category: r.category,
      },
    }))
    const fc = { type: 'FeatureCollection', features }
    const out = path.resolve(process.cwd(), 'public', 'data')
    fs.mkdirSync(out, { recursive: true })
    fs.writeFileSync(path.join(out, 'nodes.json'), JSON.stringify(fc))
    console.log(`Exported ${features.length} features to public/data/nodes.json`)
  } finally {
    await client.end()
  }
}

main().catch(e => { console.error(e.message || e); process.exit(1) })
