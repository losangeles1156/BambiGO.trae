
import dotenv from 'dotenv'
import path from 'path'
import { Client } from 'pg'

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  console.error('Missing DATABASE_URL')
  process.exit(1)
}

const client = new Client({
  connectionString,
  ssl: connectionString.includes('supabase.') ? { rejectUnauthorized: false } : undefined,
})

async function findStations() {
  try {
    await client.connect()
    console.log('Connected to Postgres')

    const targets = [
      { name: 'Asakusa', ja: '浅草', zh: '淺草' },
      { name: 'Kuramae', ja: '蔵前', zh: '藏前' },
      { name: 'Asakusabashi', ja: '浅草橋', zh: '淺草橋' },
      { name: 'Ueno-okachimachi', ja: '上野御徒町', zh: '上野御徒町' },
      { name: 'Shin-okachimachi', ja: '新御徒町', zh: '新御徒町' }
    ]

    for (const target of targets) {
      // Use SQL to query jsonb
      const query = `
        SELECT id, name, type 
        FROM nodes 
        WHERE type = 'station' 
          AND (
            name->>'en' ILIKE $1 
            OR name->>'ja' ILIKE $2 
            OR name->>'zh' ILIKE $3
          )
        LIMIT 5
      `
      const values = [`%${target.name}%`, `%${target.ja}%`, `%${target.zh}%`]
      
      const res = await client.query(query, values)
      
      if (res.rows.length > 0) {
        console.log(`\nFound matches for ${target.name}:`)
        res.rows.forEach(row => {
          console.log(`  - ${row.id} (${JSON.stringify(row.name)})`)
        })
      } else {
        console.log(`\n❌ Not found: ${target.name}`)
      }
    }

  } catch (err) {
    console.error('Database error:', err)
  } finally {
    await client.end()
  }
}

findStations()
