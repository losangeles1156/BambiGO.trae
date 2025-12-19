import { describe, it, expect } from 'vitest'

// Mock types based on generate_personas.ts
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

// Transformation logic (extracted from generate_personas.ts for testing)
function derivePersona(name: string, group: ODPTStation[]): NodePersona {
  const operators = Array.from(new Set(group.map(s => s['odpt:operator'])))
  const lineCount = group.length
  
  let complexity = lineCount * 2
  if (name === 'Tokyo') complexity += 50
  if (name === 'Otemachi') complexity += 30
  if (name === 'Shinjuku') complexity += 100

  let archetype = 'The Reliable Guide'
  if (complexity > 40) archetype = 'The Master of the Maze'
  if (name === 'Asakusa') archetype = 'The Cultural Ambassador'
  if (name === 'Ginza') archetype = 'The Elegant Concierge'

  const traps: string[] = []
  const allRailways = group.map(s => s['odpt:railway']).join(',')
  
  if (name === 'Tokyo' && operators.includes('JR-East')) {
    traps.push('Keiyo Line Transfer (20 min walk)')
    traps.push('Marunouchi vs Yaesu Side Separation')
  }
  if (allRailways.includes('Oedo')) {
    traps.push('Deep Underground (Long escalator ride)')
  }

  const prompt = `[ROLE] You are ${name} Station, ${archetype}. [CONTEXT] Complexity: ${complexity}/100.`

  return {
    node_id: `node_${name.toLowerCase()}`,
    name,
    wards: [],
    operators,
    complexity_score: complexity,
    archetype,
    trap_warnings: traps,
    system_prompt: prompt
  }
}

describe('Data Transformation & AI Knowledge Formatting', () => {
  const mockStations: ODPTStation[] = [
    {
      'owl:sameAs': 'odpt.Station:TokyoMetro.Marunouchi.Tokyo',
      'odpt:stationTitle': { en: 'Tokyo', ja: '東京' },
      'odpt:operator': 'TokyoMetro',
      'odpt:railway': 'odpt.Railway:TokyoMetro.Marunouchi',
      'geo:lat': 35.681382,
      'geo:long': 139.766084
    },
    {
      'owl:sameAs': 'odpt.Station:JR-East.Chuo.Tokyo',
      'odpt:stationTitle': { en: 'Tokyo', ja: '東京' },
      'odpt:operator': 'JR-East',
      'odpt:railway': 'odpt.Railway:JR-East.Chuo',
      'geo:lat': 35.681382,
      'geo:long': 139.766084
    }
  ]

  it('should transform ODPT station group into a structured NodePersona', () => {
    const persona = derivePersona('Tokyo', mockStations)
    
    expect(persona.name).toBe('Tokyo')
    expect(persona.operators).toContain('TokyoMetro')
    expect(persona.operators).toContain('JR-East')
    expect(persona.complexity_score).toBeGreaterThan(50) // Tokyo base bonus
    expect(persona.archetype).toBe('The Master of the Maze')
    expect(persona.trap_warnings).toContain('Keiyo Line Transfer (20 min walk)')
  })

  it('should maintain semantic integrity in system prompt', () => {
    const persona = derivePersona('Tokyo', mockStations)
    expect(persona.system_prompt).toContain('Tokyo Station')
    expect(persona.system_prompt).toContain('The Master of the Maze')
    expect(persona.system_prompt).toContain('Complexity')
  })

  it('should handle anomaly values (e.g. empty group)', () => {
    const persona = derivePersona('Empty', [])
    expect(persona.operators.length).toBe(0)
    expect(persona.complexity_score).toBe(0)
    expect(persona.archetype).toBe('The Reliable Guide')
  })
})
