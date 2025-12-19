import 'dotenv/config'
import { Client } from 'pg'
import path from 'node:path'
import fs from 'node:fs'

// Helper to parse .env.local manually if dotenv/config doesn't pick it up
function parseEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return
  const txt = fs.readFileSync(filePath, 'utf8')
  for (const line of txt.split(/\r?\n/)) {
    const mEq = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    const mColon = line.match(/^\s*([A-Z0-9_]+)\s*:\s*(.*)\s*$/)
    const m = mEq || mColon
    if (m) {
      const k = m[1]
      let v = m[2]
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
      if (v.startsWith('\'') && v.endsWith('\'')) v = v.slice(1, -1)
      if (!(k in process.env) || !process.env[k]) process.env[k] = v
    }
  }
}

// Ensure env vars are loaded
if (!process.env.DATABASE_URL) {
  parseEnvFile(path.resolve(process.cwd(), '.env.local'))
  parseEnvFile(path.resolve(process.cwd(), '..', '.env.local'))
}

const conn = process.env.DATABASE_URL
  || process.env.SUPABASE_DB_URL
  || process.env.SUPABASE_POSTGRES_URL
  || process.env.SUPABASE_DATABASE_URL

if (!conn) {
  console.error('DATABASE_URL missing')
  process.exit(1)
}

const client = new Client({
  connectionString: conn,
})

const sql = `
drop function if exists get_nodes_in_bbox;
create or replace function get_nodes_in_bbox(
  min_lon float,
  min_lat float,
  max_lon float,
  max_lat float,
  p_type text default null,
  p_limit int default 1000
) 
returns jsonb as $$
select coalesce(jsonb_agg(
  jsonb_build_object(
    'type', 'Feature',
    'id', id, 
    'geometry', st_asgeojson(location)::jsonb,
    'properties', jsonb_build_object(
      'id', id,
      'name', name,
      'type', type,
      'vibe', vibe,
      'is_hub', is_hub,
      'metadata', metadata,
      'external_links', external_links
    )
  )
), '[]'::jsonb)
from nodes
where location && ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326)
and (p_type is null or type = p_type)
limit p_limit;
$$ language sql;
`

async function run() {
  try {
    await client.connect()
    console.log('Connected to DB')
    await client.query(sql)
    console.log('RPC function get_nodes_in_bbox created successfully')
  } catch (e) {
    console.error('Error creating RPC:', e)
  } finally {
    await client.end()
  }
}

run()
