import 'dotenv/config'
import { Client } from 'pg'
import path from 'node:path'
import fs from 'node:fs'

const hubNames = [
  '上野', '浅草', '御徒町',
  '東京', '秋葉原', '神田',
  '銀座', '日本橋'
]

async function main() {
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
        if (v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1)
        if (!(k in process.env) || !process.env[k]) process.env[k] = v
      }
    }
  }
  parseEnvFile(path.resolve(process.cwd(), '.env.local'))
  parseEnvFile(path.resolve(process.cwd(), '..', '.env.local'))
  
  const conn = process.env.DATABASE_URL
    || process.env.SUPABASE_DB_URL
    || process.env.SUPABASE_POSTGRES_URL
    || process.env.SUPABASE_DATABASE_URL

  if (!conn) throw new Error('DATABASE_URL missing')
  
  const client = new Client({ connectionString: conn })
  await client.connect()

  try {
    // 1. Reset hubs
    await client.query("update nodes set is_hub = false, parent_hub_id = null")

    // 2. Mark Hubs
    console.log('Marking hubs...')
    for (const name of hubNames) {
      const res = await client.query(`
        update nodes 
        set is_hub = true 
        where type = 'station' 
          and (name->>'ja' = $1 or name->>'zh' = $1 or name->>'en' = $1)
        returning id, name
      `, [name])
      console.log(`Marked ${name}: ${res.rowCount} nodes`)
    }
    
    // 3. Assign Spokes to nearest Hub
    console.log('Assigning spokes...')
    // We use a subquery to find nearest hub
    // Note: this might be slow for millions of rows but for ~1500 it's instant
    await client.query(`
      update nodes n
      set parent_hub_id = (
        select h.id
        from nodes h
        where h.is_hub = true
        order by n.location <-> h.location
        limit 1
      )
      where n.is_hub = false
        and n.location is not null
    `)
    
    // 4. Report
    const report = await client.query(`
      select 
        h.name->>'ja' as hub_name,
        count(s.id) as spoke_count
      from nodes h
      left join nodes s on s.parent_hub_id = h.id
      where h.is_hub = true
      group by h.id, h.name
      order by spoke_count desc
    `)
    console.table(report.rows)

  } catch (e) {
    console.error(e)
  } finally {
    await client.end()
  }
}
main()
