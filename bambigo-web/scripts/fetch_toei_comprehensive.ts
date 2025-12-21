
import fs from 'fs'
import path from 'path'
import * as cheerio from 'cheerio'

const BASE_URL = 'https://www.kotsu.metro.tokyo.jp/subway/stations'

// Combined list of Taito and Chuo ward stations
const STATIONS = [
  // Taito Ward (Already done)
  // { id: 'asakusa', name: 'Asakusa', ward: 'Taito', line: 'Asakusa', url: 'asakusa.html' },
  // { id: 'kuramae', name: 'Kuramae', ward: 'Taito', line: 'Asakusa/Oedo', url: 'kuramae.html' },
  // { id: 'asakusabashi', name: 'Asakusabashi', ward: 'Taito', line: 'Asakusa', url: 'asakusabashi.html' },
  // { id: 'ueno-okachimachi', name: 'Ueno-okachimachi', ward: 'Taito', line: 'Oedo', url: 'ueno-okachimachi.html' },
  // { id: 'shin-okachimachi', name: 'Shin-okachimachi', ward: 'Taito', line: 'Oedo', url: 'shin-okachimachi.html' },
  
  // Chiyoda Ward (Already done)
  // { id: 'uchisaiwaicho', name: 'Uchisaiwaicho', ward: 'Chiyoda', line: 'Mita', url: 'uchisaiwaicho.html' },
  // { id: 'hibiya', name: 'Hibiya', ward: 'Chiyoda', line: 'Mita', url: 'hibiya.html' },
  // { id: 'otemachi', name: 'Otemachi', ward: 'Chiyoda', line: 'Mita', url: 'otemachi.html' },
  // { id: 'jimbocho', name: 'Jimbocho', ward: 'Chiyoda', line: 'Mita/Shinjuku', url: 'jimbocho.html' },
  // { id: 'suidobashi', name: 'Suidobashi', ward: 'Chiyoda', line: 'Mita', url: 'suidobashi.html' },
  // { id: 'ichigaya', name: 'Ichigaya', ward: 'Chiyoda', line: 'Shinjuku', url: 'ichigaya.html' },
  // { id: 'kudanshita', name: 'Kudanshita', ward: 'Chiyoda', line: 'Shinjuku', url: 'kudanshita.html' },
  // { id: 'ogawamachi', name: 'Ogawamachi', ward: 'Chiyoda', line: 'Shinjuku', url: 'ogawamachi.html' },
  // { id: 'iwamotocho', name: 'Iwamotocho', ward: 'Chiyoda', line: 'Shinjuku', url: 'iwamotocho.html' },

  // Chuo Ward
  { id: 'higashiginza', name: 'Higashi-ginza', ward: 'Chuo', line: 'Asakusa', url: 'higashi-ginza.html' },
  { id: 'takaracho', name: 'Takaracho', ward: 'Chuo', line: 'Asakusa', url: 'takaracho.html' },
  { id: 'nihombashi', name: 'Nihombashi', ward: 'Chuo', line: 'Asakusa', url: 'nihombashi.html' },
  { id: 'ningyocho', name: 'Ningyocho', ward: 'Chuo', line: 'Asakusa', url: 'ningyocho.html' },
  { id: 'higashi-nihombashi', name: 'Higashi-nihombashi', ward: 'Chuo', line: 'Asakusa', url: 'higashi-nihombashi.html' },
  { id: 'bakuro-yokoyama', name: 'Bakuro-yokoyama', ward: 'Chuo', line: 'Shinjuku', url: 'bakuro-yokoyama.html' },
  { id: 'hamacho', name: 'Hamacho', ward: 'Chuo', line: 'Shinjuku', url: 'hamacho.html' },
  { id: 'tsukishima', name: 'Tsukishima', ward: 'Chuo', line: 'Oedo', url: 'tsukishima.html' },
  { id: 'kachidoki', name: 'Kachidoki', ward: 'Chuo', line: 'Oedo', url: 'kachidoki.html' },
  { id: 'tsukijishijo', name: 'Tsukijishijo', ward: 'Chuo', line: 'Oedo', url: 'tsukijishijo.html' }
]

// Mapping for ODPT IDs (Best effort/Standard)
const STATION_NODE_MAP: Record<string, string> = {
  'uchisaiwaicho': 'odpt.Station:Toei.Mita.Uchisaiwaicho',
  'hibiya': 'odpt.Station:Toei.Mita.Hibiya',
  'otemachi': 'odpt.Station:Toei.Mita.Otemachi',
  'jimbocho': 'odpt.Station:Toei.Mita.Jimbocho',
  'suidobashi': 'odpt.Station:Toei.Mita.Suidobashi',
  'ichigaya': 'odpt.Station:Toei.Shinjuku.Ichigaya',
  'kudanshita': 'odpt.Station:Toei.Shinjuku.Kudanshita',
  'ogawamachi': 'odpt.Station:Toei.Shinjuku.Ogawamachi',
  'iwamotocho': 'odpt.Station:Toei.Shinjuku.Iwamotocho',
  'asakusa': 'odpt.Station:Toei.Asakusa.Asakusa',
  'kuramae': 'odpt.Station:Toei.Asakusa.Kuramae',
  'asakusabashi': 'odpt.Station:Toei.Asakusa.Asakusabashi',
  'ueno-okachimachi': 'odpt.Station:Toei.Oedo.UenoOkachimachi',
  'shin-okachimachi': 'odpt.Station:Toei.Oedo.ShinOkachimachi',
  'higashiginza': 'odpt.Station:Toei.Asakusa.Higashiginza',
  'takaracho': 'odpt.Station:Toei.Asakusa.Takaracho',
  'nihombashi': 'odpt.Station:Toei.Asakusa.Nihombashi',
  'ningyocho': 'odpt.Station:Toei.Asakusa.Ningyocho',
  'higashi-nihombashi': 'odpt.Station:Toei.Asakusa.Higashinihombashi',
  'bakuro-yokoyama': 'odpt.Station:Toei.Shinjuku.BakuroYokoyama',
  'hamacho': 'odpt.Station:Toei.Shinjuku.Hamacho',
  'tsukishima': 'odpt.Station:Toei.Oedo.Tsukishima',
  'kachidoki': 'odpt.Station:Toei.Oedo.Kachidoki',
  'tsukijishijo': 'odpt.Station:Toei.Oedo.Tsukijishijo'
}

async function fetchWithFallback(stationId: string, primaryUrl: string) {
  const variants = [
    primaryUrl,
    primaryUrl.replace('-', ''),
    primaryUrl.replace('-', '_'),
    primaryUrl.replace('_', '-')
  ]
  
  for (const url of variants) {
    try {
      const fullUrl = `${BASE_URL}/${url}`
      // console.log(`Fetching ${fullUrl}...`)
      const res = await fetch(fullUrl)
      if (res.ok) return await res.text()
    } catch (e) {
      // ignore
    }
  }
  return null
}

async function main() {
  console.log('Phase 1: Data Collection (Taito & Chuo Wards)...')
  const results = []

  for (const station of STATIONS) {
    process.stdout.write(`Processing ${station.name}... `)
    const html = await fetchWithFallback(station.id, station.url)
    
    if (!html) {
      console.log('❌ Failed to fetch')
      continue
    }

    const $ = cheerio.load(html)
    
    // Extract Facility Counts
    const barrierFreeText = $('#barrierfree').text()
    const escalatorCount = parseInt(barrierFreeText.match(/エスカレーター\s*:\s*(\d+)台/)?.[1] || '0')
    const elevatorCount = parseInt(barrierFreeText.match(/エレベーター\s*:\s*(\d+)台/)?.[1] || '0')
    const hasAccessibleToilet = barrierFreeText.includes('バリアフリートイレ') && barrierFreeText.includes('あり')

    // Extract Facilities and Image URLs
    const facilities: any[] = []
    $('.facilityList__item img').each((_, img) => {
      const alt = $(img).attr('alt') || ''
      const src = $(img).attr('src') || ''
      facilities.push({ name: alt, iconUrl: `https://www.kotsu.metro.tokyo.jp${src}` })
    })

    const stationData = {
      stationId: station.id,
      name: station.name,
      ward: station.ward,
      line: station.line,
      nodeId: STATION_NODE_MAP[station.id] || `odpt.Station:Toei.${station.line}.${station.name}`,
      counts: {
        escalator: escalatorCount,
        elevator: elevatorCount,
      },
      hasAccessibleToilet,
      facilities,
      rawData: {
        barrierFreeText: barrierFreeText.trim().substring(0, 100) + '...'
      }
    }
    
    results.push(stationData)
    console.log('✅')
  }

  // Save Raw Data
  const rawPath = path.resolve(process.cwd(), 'data/toei_chuo_raw.json')
  fs.writeFileSync(rawPath, JSON.stringify(results, null, 2))
  console.log(`Saved raw data to ${rawPath}`)

  console.log('\nPhase 2: Data Organization & Normalization...')
  
  const l3Data = []
  const gapAnalysis = []

  for (const station of results) {
    const nodeId = station.nodeId
    
    // Normalize to L3
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
      const facNames = station.facilities.map(f => f.name)
      l3Data.push({
        node_id: nodeId,
        type: 'toilet',
        name: { en: 'Accessible Toilet', ja: 'だれでもトイレ' },
        attributes: {
          subCategory: 'accessible_toilet',
          has_wheelchair_access: true,
          has_ostomate: facNames.includes('オストメイト対応トイレ'),
          has_baby_chair: facNames.includes('ベビーチェア') || facNames.includes('ベビーシート'),
          source: 'official_scrape'
        },
        source_dataset: 'official'
      })
    }

    // 4. Gap Analysis / Improvement Plan
    const gaps = []
    if (station.counts.elevator === 0) gaps.push('Missing Elevator')
    if (station.counts.escalator === 0) gaps.push('Missing Escalator')
    if (!station.hasAccessibleToilet) gaps.push('Missing Accessible Toilet')
    
    gapAnalysis.push({
      station: station.name,
      ward: station.ward,
      line: station.line,
      status: gaps.length === 0 ? 'Good' : 'Needs Improvement',
      gaps: gaps,
      score: 100 - (gaps.length * 20)
    })
  }

  // Save L3 Data
  const l3Path = path.resolve(process.cwd(), 'data/toei_chuo_l3.json')
  fs.writeFileSync(l3Path, JSON.stringify(l3Data, null, 2))
  console.log(`Saved L3 import data to ${l3Path}`)

  // Generate Report
  console.log('\nPhase 3 & 4: Analysis & Reporting...')
  const reportPath = path.resolve(process.cwd(), 'reports/L3_Facility_Analysis.md')
  
  let markdown = '# Toei Subway L3 Facility Analysis Report\n\n'
  markdown += `**Scope**: Chuo Ward (${results.length} Stations)\n`
  markdown += `**Source**: [Toei Subway Official Website](https://www.kotsu.metro.tokyo.jp/subway/stations/)\n`
  markdown += `**Date**: ${new Date().toISOString().split('T')[0]}\n\n`
  
  markdown += '## 1. Facility Status Overview\n\n'
  markdown += '| Station | Ward | Line | Score | Gaps |\n'
  markdown += '|---|---|---|---|---|\n'
  
  for (const gap of gapAnalysis) {
    const gapText = gap.gaps.length > 0 ? gap.gaps.join(', ') : 'None'
    markdown += `| ${gap.station} | ${gap.ward} | ${gap.line} | ${gap.score} | ${gapText} |\n`
  }

  markdown += '\n## 2. Improvement Recommendations\n\n'
  const critical = gapAnalysis.filter(g => g.score < 80)
  if (critical.length > 0) {
    markdown += '### High Priority (Score < 80)\n'
    critical.forEach(c => {
      markdown += `- **${c.station}**: Install ${c.gaps.join(' and ')} to meet accessibility standards.\n`
    })
  } else {
    markdown += 'All surveyed stations meet basic accessibility standards (Elevator, Escalator, Accessible Toilet present).\n'
  }

  markdown += '\n## 3. Data Integrity\n'
  markdown += `- **Total Stations Scanned**: ${results.length}\n`
  markdown += `- **Total L3 Records Generated**: ${l3Data.length}\n`
  markdown += `- **Standard Used**: BambiGO L3 Facility Schema (Asakusa Spec)\n`

  // Ensure reports dir exists
  if (!fs.existsSync(path.dirname(reportPath))) {
    fs.mkdirSync(path.dirname(reportPath), { recursive: true })
  }
  
  fs.writeFileSync(reportPath, markdown)
  console.log(`Report generated at ${reportPath}`)
}

main()
