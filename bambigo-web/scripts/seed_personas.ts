
import 'dotenv/config'
import { Client } from 'pg'
import path from 'path'
import fs from 'fs'

const DATA_PATH = path.join(process.cwd(), 'data', 'personas_master.json')

interface Persona {
  node_id: string
  name: string
  wards: string[]
  operators: string[]
  complexity_score: number
  archetype: string
  trap_warnings: string[]
  system_prompt: string
}

type CategoryCounts = {
  shopping: number
  dining: number
  medical: number
  education: number
  leisure: number
  finance: number
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function normalizeCategoryCounts(value: unknown): CategoryCounts | null {
  const v = (value ?? {}) as Record<string, unknown>
  const keys: Array<keyof CategoryCounts> = ['shopping', 'dining', 'medical', 'education', 'leisure', 'finance']
  const result: CategoryCounts = {
    shopping: 0,
    dining: 0,
    medical: 0,
    education: 0,
    leisure: 0,
    finance: 0
  }

  let hasAny = false
  for (const k of keys) {
    const n = Number(v[k])
    if (Number.isFinite(n)) {
      result[k] = n
      if (n !== 0) hasAny = true
    }
  }
  return hasAny ? result : null
}

function computeL1ComplexityBoost(counts: CategoryCounts | null): number {
  if (!counts) return 0
  const values = Object.values(counts)
  const total = values.reduce((sum, n) => sum + n, 0)
  const diversity = values.filter((n) => n >= 5).length
  const boost = Math.round(Math.sqrt(total) * 2 + diversity * 2)
  return clampNumber(boost, 0, 25)
}

function patchPromptComplexity(prompt: string, complexity: number): string {
  return prompt
    .replace(/Complexity Level:\s*\d+\/100\./g, `Complexity Level: ${complexity}/100.`)
    .replace(/Complexity:\s*\d+\/100\./g, `Complexity: ${complexity}/100.`)
}

export async function seedPersonas(customClient?: Client) {
  if (!fs.existsSync(DATA_PATH)) {
    console.error(`❌ Persona file not found at ${DATA_PATH}`)
    if (!customClient) process.exit(1)
    return
  }

  const personas: Persona[] = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'))
  console.log(`🚀 Starting Persona Seeding. Loaded ${personas.length} personas.`)

  let client: Client
  
  if (customClient) {
    client = customClient
  } else {
    const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL
    if (!connectionString) {
      console.error('❌ DATABASE_URL is missing')
      process.exit(1)
    }
    client = new Client({ connectionString })
    await client.connect()
  }

  try {
    // Check if nodes table exists and has persona_prompt column
    const checkTable = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='nodes' AND column_name='persona_prompt';
    `)
    
    if (checkTable.rowCount === 0) {
      console.warn('⚠️  Column persona_prompt not found in nodes table. Attempting to add it...')
      try {
        await client.query(`ALTER TABLE nodes ADD COLUMN IF NOT EXISTS persona_prompt text;`)
        console.log('✅ Added persona_prompt column.')
      } catch (e) {
        console.error('❌ Failed to alter table:', e)
        throw e
      }
    }

    const shouldCheckProfiles = personas.length > 0
    let hasFacilityProfiles = false
    if (shouldCheckProfiles) {
      try {
        const tableCheck = await client.query(
          `SELECT to_regclass('public.node_facility_profiles') AS regclass;`
        )
        hasFacilityProfiles = Boolean(tableCheck.rows?.[0]?.regclass)
      } catch {
        hasFacilityProfiles = false
      }
    }

    let updatedTotal = 0
    let skippedTotal = 0

    // Prepare statement for efficiency? 
    // Actually, distinct updates per persona, so simple loop is fine for <200 items.
    
    for (const p of personas) {
      // We update nodes where the English name matches the Persona name.
      // We also update the metadata to include archetype and complexity.
      // Note: We use jsonb_set or || operator to merge metadata.
      
      let adjustedComplexity = p.complexity_score
      if (hasFacilityProfiles) {
        try {
          const profileRes = await client.query(
            `
              SELECT p.category_counts
              FROM nodes n
              LEFT JOIN node_facility_profiles p ON p.node_id = n.id
              WHERE n.name->>'en' = $1
              LIMIT 1;
            `,
            [p.name]
          )
          const counts = normalizeCategoryCounts(profileRes.rows?.[0]?.category_counts)
          const boost = computeL1ComplexityBoost(counts)
          adjustedComplexity = clampNumber(p.complexity_score + boost, 0, 100)
        } catch {
          adjustedComplexity = p.complexity_score
        }
      }

      const metadataPatch = {
        persona_archetype: p.archetype,
        complexity_score: adjustedComplexity,
        trap_warnings: p.trap_warnings,
        operators: p.operators
      }

      const finalPrompt =
        adjustedComplexity === p.complexity_score
          ? p.system_prompt
          : patchPromptComplexity(p.system_prompt, adjustedComplexity)

      const query = `
        UPDATE nodes 
        SET 
          persona_prompt = $1,
          metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
          updated_at = now()
        WHERE 
          name->>'en' = $3
        RETURNING id;
      `

      const res = await client.query(query, [
        finalPrompt,
        JSON.stringify(metadataPatch),
        p.name
      ])

      if (res.rowCount && res.rowCount > 0) {
        // console.log(`✅ Linked '${p.name}' to ${res.rowCount} node(s).`)
        updatedTotal += res.rowCount
      } else {
        // console.log(`⚠️  No node found for '${p.name}'`)
        skippedTotal++
      }
    }

    console.log('---')
    console.log(`✅ Seeding Complete.`)
    console.log(`Updated Nodes: ${updatedTotal}`)
    console.log(`Personas with no matching nodes: ${skippedTotal}`)

  } catch (e) {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  } finally {
    if (!customClient) await client.end()
  }
}

// Execute if run directly
import { fileURLToPath } from 'url'
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedPersonas()
}
