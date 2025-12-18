import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'

// Load .env.local explicitly
const envLocalPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envLocalPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envLocalPath))
  for (const k in envConfig) {
    process.env[k] = envConfig[k]
  }
}
dotenv.config()

import { OdptClient } from '../src/lib/odptClient'

// Mock Interfaces for ODPT Data
interface ODPTStation {
  'owl:sameAs': string
  'odpt:stationTitle': { en: string; ja: string }
  'odpt:operator': string
  'odpt:railway': string
  'geo:lat': number
  'geo:long': number
  'odpt:connectingRailway'?: string[]
}

interface NodePersona {
  node_id: string
  name: string
  wards: string[]
  operators: string[]
  complexity_score: number
  archetype: string
  trap_warnings: string[]
  system_prompt: string
}

// Configuration
const TARGET_WARDS = ['Chiyoda', 'Chuo', 'Taito']

// Fallback list for stations without geo coordinates (mainly JR)
const TARGET_STATION_NAMES = new Set([
  'Tokyo', 'Yurakucho', 'Kanda', 'Akihabara', 'Ochanomizu', 
  'Suidobashi', 'Iidabashi', 'Ichigaya', 
  'Ueno', 'Okachimachi', 'Uguisudani', 'Asakusabashi', 
  'Bakurocho', 'Shin-Nihombashi', 'Hatchobori',
  'Nippori' // Border case, often relevant
])

const OPERATOR_PRIORITY = {
  'subway': ['TokyoMetro', 'Toei'],
  'jr': ['JR-East'],
  'private': ['TsukubaExpress', 'Yurikamome'] // Add others as needed
}

// 1. Station Fetcher (Real ODPT via Client)
async function fetchStations(type: 'subway' | 'jr' | 'private'): Promise<ODPTStation[]> {
  console.log(`[Fetcher] Retrieving ${type} stations via ODPT...`)
  const client = new OdptClient({ cacheTtlSec: 600, throttleMs: 120 })
  const ops = OPERATOR_PRIORITY[type]
  const raw = await client.stationsByOperator(
    ops.map((name) =>
      name === 'JR-East' ? 'odpt.Operator:JR-East'
      : name === 'TokyoMetro' ? 'odpt.Operator:TokyoMetro'
      : name === 'Toei' ? 'odpt.Operator:Toei'
      : name === 'TsukubaExpress' ? 'odpt.Operator:TsukubaExpress'
      : name === 'Yurikamome' ? 'odpt.Operator:Yurikamome'
      : name
    )
  )
  // Normalize shallowly to ODPTStation shape expected downstream
  const bbox = { minLon: 139.73, minLat: 35.65, maxLon: 139.82, maxLat: 35.74 }
  const mapped: ODPTStation[] = (raw as any[])
    .map((r) => ({
      'owl:sameAs': r['owl:sameAs'] || r['@id'] || '',
      'odpt:stationTitle': r['odpt:stationTitle'] || { en: r['dc:title'] || 'Unknown', ja: r['dc:title'] || '不明' },
      'odpt:operator': (r['odpt:operator'] || '').replace('odpt.Operator:', ''),
      'odpt:railway': r['odpt:railway'] || '',
      'geo:lat': Number(r['geo:lat'] || r['geo:latitude'] || r['latitude'] || 0),
      'geo:long': Number(r['geo:long'] || r['geo:longitude'] || r['longitude'] || 0),
      'odpt:connectingRailway': r['odpt:connectingRailway'] || r['connectingRailway'] || []
    }))
    .filter((s) => {
      // Check Geo BBox
      if (s['geo:lat'] !== 0 && s['geo:long'] !== 0) {
        return s['geo:lat'] >= bbox.minLat && s['geo:lat'] <= bbox.maxLat && 
               s['geo:long'] >= bbox.minLon && s['geo:long'] <= bbox.maxLon
      }
      // Fallback: Check Name Whitelist
      return TARGET_STATION_NAMES.has(s['odpt:stationTitle'].en)
    })
  
  return mapped
}

// 2. Cluster Logic
function clusterStations(stations: ODPTStation[]) {
  const clusters: Record<string, ODPTStation[]> = {}
  
  stations.forEach(s => {
    const name = s['odpt:stationTitle'].en
    if (!clusters[name]) clusters[name] = []
    clusters[name].push(s)
  })
  
  return clusters
}

// 3. Context Analysis & Persona Derivation
function derivePersona(name: string, group: ODPTStation[]): NodePersona {
  const operators = Array.from(new Set(group.map(s => s['odpt:operator'])))
  const lineCount = group.length // Rough proxy
  
  // Rule-based Complexity Score
  let complexity = lineCount * 2
  if (name === 'Tokyo') complexity += 50 // Special case
  if (name === 'Otemachi') complexity += 30
  if (name === 'Shinjuku') complexity += 100

  // Archetype Assignment
  let archetype = 'The Reliable Guide'
  if (complexity > 40) archetype = 'The Master of the Maze'
  if (name === 'Asakusa') archetype = 'The Cultural Ambassador'
  if (name === 'Ginza') archetype = 'The Elegant Concierge'

  // Trap Detection
  const traps: string[] = []
  const allRailways = group.map(s => s['odpt:railway']).join(',')
  
  if (name === 'Tokyo' && operators.includes('JR-East')) {
    traps.push('Keiyo Line Transfer (20 min walk)')
    traps.push('Marunouchi vs Yaesu Side Separation')
  }
  if (allRailways.includes('Oedo')) {
    traps.push('Deep Underground (Long escalator ride)')
  }
  if (name === 'Otemachi') {
    traps.push('Massive Spread (C1 to B10 exits are far apart)')
  }

  // System Prompt Synthesis
  const prompt = `
[ROLE]
You are ${name} Station, ${archetype}.
Operators: ${operators.join(', ')}.

[CONTEXT]
Complexity Level: ${complexity}/100.
Known Traps:
${traps.map(t => `- ${t}`).join('\n')}

[INSTRUCTION]
- Always verify the user's intended line.
- If they ask about transfers, warn them about the traps above.
- Speak with a tone fitting your archetype.
`.trim()

  return {
    node_id: `node_${name.toLowerCase()}`, // distinct ID generation needed in real app
    name,
    wards: [], // Would need geo-lookup
    operators,
    complexity_score: complexity,
    archetype,
    trap_warnings: traps,
    system_prompt: prompt
  }
}

// Main Execution
async function main() {
  const args = process.argv.slice(2)
  const typeArg = args.find(a => a.startsWith('--type='))?.split('=')[1] as 'subway' | 'jr' | 'private' | undefined
  
  if (!typeArg) {
    console.error('Please specify --type=subway|jr|private')
    process.exit(1)
  }

  console.log(`🚀 Starting Persona Generation for: ${typeArg.toUpperCase()}`)
  
  const stations = await fetchStations(typeArg)
  const clusters = clusterStations(stations)
  
  const personas: NodePersona[] = []
  
  for (const [name, group] of Object.entries(clusters)) {
    console.log(`Processing Cluster: ${name} (${group.length} nodes)...`)
    const persona = derivePersona(name, group)
    personas.push(persona)
  }

  // Output
  const outPath = path.join(process.cwd(), 'data', `personas_${typeArg}.json`)
  if (!fs.existsSync(path.dirname(outPath))) fs.mkdirSync(path.dirname(outPath), { recursive: true })
  
  fs.writeFileSync(outPath, JSON.stringify(personas, null, 2))
  console.log(`✅ Generated ${personas.length} personas. Saved to ${outPath}`)
}

main().catch(console.error)
