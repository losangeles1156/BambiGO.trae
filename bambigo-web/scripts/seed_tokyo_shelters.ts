import { config } from 'dotenv'
import { Client } from 'pg'
import path from 'node:path'
import fs from 'node:fs'

// Load environment variables explicitly
config({ path: path.resolve(process.cwd(), '.env.local'), override: true })
config({ path: path.resolve(process.cwd(), '..', '.env.local'), override: true })

// Re-using the env parser from seed_facilities.ts
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

console.log('Connecting to:', conn.replace(/:([^@]+)@/, ':****@'))

const client = new Client({ connectionString: conn })

const CSV_URL = 'https://www.opendata.metro.tokyo.lg.jp/soumu/130001_evacuation_center.csv'

async function run() {
  try {
    await client.connect()
    console.log('Connected to DB')

    console.log('Fetching shelter data...')
    const response = await fetch(CSV_URL)
    const buffer = await response.arrayBuffer()
    const decoder = new TextDecoder('shift-jis')
    const text = decoder.decode(buffer)
    const lines = text.split(/\r?\n/)

    console.log(`Total lines: ${lines.length}`)

    // Headers are on line 2 (index 1) after some empty lines/commas
    // Re-check headers from the text
    const headers = lines[1].split(',')
    console.log('Headers:', headers)

    // Expected headers: 
    // 0: 施設・場所名称
    // 3: 市区町村名
    // 4: 所在地住所
    // 5: 緯度
    // 6: 経度

    let insertedCount = 0
    let skippedCount = 0

    // Only process Taito-ku (台東区) for Phase 2 focus
    const TARGET_CITY = '台東区'
    const CITY_ID = 'tokyo_taito'

    for (let i = 2; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      // Simple CSV split (handles quotes roughly)
      const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim())
      
      const name = cols[0]
      const city = cols[3]
      const address = cols[4]
      const lat = parseFloat(cols[5])
      const lon = parseFloat(cols[6])

      if (!name || isNaN(lat) || isNaN(lon)) {
        skippedCount++
        continue
      }

      if (city !== TARGET_CITY) {
        continue
      }

      // Helper for simple translation mapping
      const translateName = (ja: string) => {
        const mapping: Record<string, { en: string; zh: string }> = {
          '旧下谷小学校': { en: 'Old Shitaya Elementary School', zh: '舊下谷小學校' },
          '台東区役所': { en: 'Taito City Hall', zh: '台東區役所' },
          '生涯学習センター': { en: 'Lifelong Learning Center', zh: '生涯學習中心' },
          '台東病院': { en: 'Taito Hospital', zh: '台東醫院' },
          '浅草小学校': { en: 'Asakusa Elementary School', zh: '淺草小學校' },
        }
        
        // Fallback for schools/centers
        let en = ja
        let zh = ja
        
        if (mapping[ja]) {
          en = mapping[ja].en
          zh = mapping[ja].zh
        } else {
          // Generic suffix replacement for demo
          en = ja.replace('小学校', ' Elementary School')
                 .replace('中学校', ' Junior High School')
                 .replace('高等学校', ' High School')
                 .replace('センター', ' Center')
                 .replace('公園', ' Park')
          
          zh = ja.replace('小学校', '小學校')
                 .replace('中学校', '中學校')
                 .replace('高等学校', '高等學校')
                 .replace('公園', '公園')
        }
        
        return { en, zh }
      }

      const translations = translateName(name)
      const nodeId = `shelter:${CITY_ID}:${name}`

      // 1. Insert into nodes
      await client.query(
        `insert into nodes (
          id, city_id, type, name, location, source_dataset, source_id
        ) values ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326), $7, $8)
        on conflict (id) do update set
          name = excluded.name,
          location = excluded.location,
          updated_at = now()`,
        [
          nodeId,
          CITY_ID,
          'shelter_site',
          JSON.stringify({ ja: name, en: translations.en, zh: translations.zh, address }),
          lon,
          lat,
          'tokyo_bousai',
          name
        ]
      )

      // 2. Insert into facilities
      await client.query(
        `insert into facilities (
          node_id, city_id, type, name, attributes, source_dataset
        ) values ($1, $2, $3, $4, $5, $6)
        on conflict do nothing`, // UUID primary key, so conflict is unlikely but handled by schema
        [
          nodeId,
          CITY_ID,
          'shelter',
          JSON.stringify({ ja: name, en: translations.en, zh: translations.zh }),
          JSON.stringify({ address, source: 'tokyo_bousai_opendata' }),
          'tokyo_bousai'
        ]
      )

      insertedCount++
      if (insertedCount % 50 === 0) {
        console.log(`Processed ${insertedCount} shelters...`)
      }
    }

    console.log(`Finished seeding. Inserted/Updated: ${insertedCount}, Skipped: ${skippedCount}`)

  } catch (e) {
    console.error('Error seeding shelters:', e)
  } finally {
    await client.end()
  }
}

run()
