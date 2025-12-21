
import fs from 'fs'
import path from 'path'
import * as cheerio from 'cheerio'

const BASE_URL = 'https://www.kotsu.metro.tokyo.jp/subway/stations'

const stations = [
  { id: 'asakusa', name: 'Asakusa', url: 'asakusa.html' },
  { id: 'kuramae', name: 'Kuramae', url: 'kuramae.html' },
  { id: 'asakusabashi', name: 'Asakusabashi', url: 'asakusabashi.html' },
  { id: 'ueno-okachimachi', name: 'Ueno-okachimachi', url: 'ueno-okachimachi.html' },
  { id: 'shin-okachimachi', name: 'Shin-okachimachi', url: 'shin-okachimachi.html' }
]

// Fallback for guessed URLs
async function fetchWithFallback(stationId: string, primaryUrl: string) {
  const variants = [
    primaryUrl,
    primaryUrl.replace('-', '_'),
    primaryUrl.replace('_', '-')
  ]
  
  for (const url of variants) {
    try {
      const fullUrl = `${BASE_URL}/${url}`
      console.log(`Fetching ${fullUrl}...`)
      const res = await fetch(fullUrl)
      if (res.ok) return await res.text()
    } catch {
      console.warn(`Failed to fetch ${url}`)
    }
  }
  return null
}

async function main() {
  const results: Array<{
    stationId: string
    name: string
    counts: { escalator: number; elevator: number }
    hasAccessibleToilet: boolean
    facilities: string[]
  }> = []

  for (const station of stations) {
    const html = await fetchWithFallback(station.id, station.url)
    if (!html) {
      console.error(`Could not fetch data for ${station.name}`)
      continue
    }

    const $ = cheerio.load(html)
    
    // Extract Facility Counts from the text summary
    const barrierFreeText = $('#barrierfree').text()
    const escalatorCount = barrierFreeText.match(/エスカレーター\s*:\s*(\d+)台/)?.[1] || '0'
    const elevatorCount = barrierFreeText.match(/エレベーター\s*:\s*(\d+)台/)?.[1] || '0'
    const hasAccessibleToilet = barrierFreeText.includes('バリアフリートイレ') && barrierFreeText.includes('あり')

    // Extract specific icons
    const facilities: string[] = []
    
    $('.facilityList__item img').each((_, img) => {
      const alt = $(img).attr('alt') || ''
      facilities.push(alt)
    })

    const stationData = {
      stationId: station.id,
      name: station.name,
      counts: {
        escalator: parseInt(escalatorCount),
        elevator: parseInt(elevatorCount),
      },
      hasAccessibleToilet,
      facilities
    }
    
    results.push(stationData)
    console.log(`Processed ${station.name}: ${JSON.stringify(stationData.counts)}`)
  }

  const outputPath = path.resolve(process.cwd(), 'data/toei_taito_raw.json')
  // Ensure data dir exists
  if (!fs.existsSync(path.dirname(outputPath))) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  }
  
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2))
  console.log(`Saved raw data to ${outputPath}`)
}

main()
