
import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Mapping for Station Name -> Node ID (Hypothetical/ODPT standard)
// User needs to verify these IDs in their DB
const STATION_NODE_MAP: Record<string, string> = {
  'asakusa': 'odpt.Station:Toei.Asakusa.Asakusa',
  'kuramae': 'odpt.Station:Toei.Asakusa.Kuramae', // Note: Kuramae has Asakusa and Oedo lines, usually separate nodes in ODPT or same?
  'asakusabashi': 'odpt.Station:Toei.Asakusa.Asakusabashi',
  'ueno-okachimachi': 'odpt.Station:Toei.Oedo.UenoOkachimachi',
  'shin-okachimachi': 'odpt.Station:Toei.Oedo.ShinOkachimachi'
}

type RawStationData = {
  stationId: string
  name: string
  counts: { escalator: number, elevator: number }
  hasAccessibleToilet: boolean
  facilities: string[]
}

async function main() {
  const rawPath = path.resolve(process.cwd(), 'data/toei_taito_raw.json')
  if (!fs.existsSync(rawPath)) {
    console.error('Raw data file not found:', rawPath)
    process.exit(1)
  }

  const rawData: RawStationData[] = JSON.parse(fs.readFileSync(rawPath, 'utf8'))
  const l3Data = []

  for (const station of rawData) {
    const nodeId = STATION_NODE_MAP[station.stationId]
    if (!nodeId) {
      console.warn(`No Node ID mapped for ${station.name}`)
      continue
    }

    // 1. Elevators
    if (station.counts.elevator > 0) {
      l3Data.push({
        node_id: nodeId,
        type: 'accessibility',
        name: { en: 'Elevator', ja: 'エレベーター' },
        attributes: {
          subCategory: 'elevator',
          count: station.counts.elevator,
          source: 'official_scrape'
        },
        source_dataset: 'official'
      })
    }

    // 2. Escalators
    if (station.counts.escalator > 0) {
      l3Data.push({
        node_id: nodeId,
        type: 'accessibility',
        name: { en: 'Escalator', ja: 'エスカレーター' },
        attributes: {
          subCategory: 'escalator',
          count: station.counts.escalator,
          source: 'official_scrape'
        },
        source_dataset: 'official'
      })
    }

    // 3. Accessible Toilet
    if (station.hasAccessibleToilet) {
      l3Data.push({
        node_id: nodeId,
        type: 'toilet',
        name: { en: 'Accessible Toilet', ja: 'だれでもトイレ' },
        attributes: {
          subCategory: 'accessible_toilet',
          has_wheelchair_access: true,
          has_ostomate: station.facilities.includes('オストメイト対応トイレ'),
          has_baby_chair: station.facilities.includes('ベビーチェア') || station.facilities.includes('ベビーシート'),
          source: 'official_scrape'
        },
        source_dataset: 'official'
      })
    }

    // 4. Other Facilities (ATM, Locker)
    if (station.facilities.includes('コインロッカー')) {
      l3Data.push({
        node_id: nodeId,
        type: 'locker',
        name: { en: 'Coin Locker', ja: 'コインロッカー' },
        attributes: {
          subCategory: 'coin_locker',
          source: 'official_scrape'
        },
        source_dataset: 'official'
      })
    }

    if (station.facilities.includes('ATM')) {
      l3Data.push({
        node_id: nodeId,
        type: 'commercial', // assuming commercial or other
        name: { en: 'ATM', ja: 'ATM' },
        attributes: {
          subCategory: 'atm',
          source: 'official_scrape'
        },
        source_dataset: 'official'
      })
    }
  }

  // Save prepared L3 data
  const outPath = path.resolve(process.cwd(), 'data/toei_taito_l3_ready.json')
  fs.writeFileSync(outPath, JSON.stringify(l3Data, null, 2))
  console.log(`Saved ${l3Data.length} L3 facility records to ${outPath}`)

  // Attempt DB Import
  if (supabaseUrl && supabaseServiceKey && !supabaseServiceKey.includes('placeholder')) {
    console.log('Connecting to Supabase for import...')
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const { error } = await supabase.from('facilities').insert(l3Data)
    if (error) {
      console.error('Import failed:', error)
    } else {
      console.log('✅ Successfully imported facilities to DB')
    }
  } else {
    console.warn('⚠️  Supabase credentials missing or invalid. Skipping DB import.')
    console.warn('Please check .env.local or run this script in an environment with valid keys.')
  }
}

main()
