import 'dotenv/config'
import { Client } from 'pg'
import path from 'node:path'
import fs from 'node:fs'

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

const client = new Client({ connectionString: conn })

const FACILITY_TYPES = [
  { 
    type: 'toilet', 
    names: { en: 'Public Toilet', zh: '公共廁所', ja: '公衆トイレ' },
    attrs: () => ({ has_wheelchair_access: Math.random() > 0.5, has_baby_care: Math.random() > 0.7 }) 
  },
  { 
    type: 'taxi_stand', 
    names: { en: 'Taxi Stand', zh: '計程車招呼站', ja: 'タクシー乗り場' },
    attrs: () => ({}) 
  },
  { 
    type: 'convenience_store', 
    names: { en: 'Convenience Store', zh: '便利商店', ja: 'コンビニ' },
    attrs: () => ({ is_24h: true }) 
  }
]

async function run() {
  try {
    await client.connect()
    console.log('Connected to DB')

    // Get nodes
    const res = await client.query('select id, city_id from nodes limit 100')
    const nodes = res.rows
    console.log(`Found ${nodes.length} nodes`)

    if (nodes.length === 0) {
      console.log('No nodes found. Skipping facility seeding.')
      return
    }

    let insertedCount = 0

    for (const node of nodes) {
      // Check if facilities already exist
      const check = await client.query('select count(*) from facilities where node_id = $1', [node.id])
      if (parseInt(check.rows[0].count) > 0) {
        continue
      }

      // Generate random facilities
      const numFacilities = Math.floor(Math.random() * 3) + 1 // 1 to 3 facilities
      for (let i = 0; i < numFacilities; i++) {
        const template = FACILITY_TYPES[Math.floor(Math.random() * FACILITY_TYPES.length)]
        const dist = Math.floor(Math.random() * 300) + 10 // 10m to 310m

        await client.query(
          `insert into facilities (
            node_id, city_id, type, name, distance_meters, attributes, source_dataset
          ) values ($1, $2, $3, $4, $5, $6, $7)`,
          [
            node.id,
            node.city_id,
            template.type,
            JSON.stringify(template.names),
            dist,
            JSON.stringify(template.attrs()),
            'synthetic_seed'
          ]
        )
        insertedCount++
      }
    }

    console.log(`Seeded ${insertedCount} facilities across ${nodes.length} nodes.`)

  } catch (e) {
    console.error('Error seeding facilities:', e)
  } finally {
    await client.end()
  }
}

run()
