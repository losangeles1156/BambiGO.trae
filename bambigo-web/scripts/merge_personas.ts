
import fs from 'fs'
import path from 'path'

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

const DATA_DIR = path.join(process.cwd(), 'data')

function loadPersonas(filename: string): NodePersona[] {
  const p = path.join(DATA_DIR, filename)
  if (!fs.existsSync(p)) return []
  return JSON.parse(fs.readFileSync(p, 'utf-8'))
}

function mergePersonas() {
  console.log('🔄 Starting Persona Synthesis (Merging operators)...')

  const subway = loadPersonas('personas_subway.json')
  const jr = loadPersonas('personas_jr.json')
  const privateRail = loadPersonas('personas_private.json')

  const all = [...subway, ...jr, ...privateRail]
  const mergedMap = new Map<string, NodePersona>()

  all.forEach(p => {
    // Normalize name (e.g. remove <...>) if needed, but ODPT names are usually clean-ish.
    // However, some might be "Tokyo" vs "Tokyo Station".
    // Our script uses odpt:stationTitle.en which is usually just "Tokyo".
    const key = p.name

    if (!mergedMap.has(key)) {
      mergedMap.set(key, { ...p })
    } else {
      const existing = mergedMap.get(key)!
      
      // Merge Operators
      const combinedOps = Array.from(new Set([...existing.operators, ...p.operators]))
      
      // Merge Traps
      const combinedTraps = Array.from(new Set([...existing.trap_warnings, ...p.trap_warnings]))
      
      // Update Complexity (Simple addition? Or Max? Let's take Max + bonus)
      // If a station has multiple operators, it's inherently more complex.
      let newComplexity = Math.max(existing.complexity_score, p.complexity_score)
      if (existing.operators.length !== combinedOps.length) {
        newComplexity += 10 // Bonus for connecting lines
      }

      // Re-evaluate Archetype
      let newArchetype = existing.archetype
      if (newComplexity > 60) newArchetype = 'The Master of the Maze'
      
      // Update
      existing.operators = combinedOps
      existing.trap_warnings = combinedTraps
      existing.complexity_score = newComplexity
      existing.archetype = newArchetype
      
      // Re-generate Prompt
      existing.system_prompt = `
[ROLE]
You are ${existing.name} Station, ${existing.archetype}.
Operators: ${combinedOps.join(', ')}.

[CONTEXT]
Complexity Level: ${newComplexity}/100.
Known Traps:
${combinedTraps.length > 0 ? combinedTraps.map(t => `- ${t}`).join('\n') : '(None)'}

[INSTRUCTION]
- Always verify the user's intended line.
- If they ask about transfers, warn them about the traps above.
- Speak with a tone fitting your archetype.
`.trim()

      mergedMap.set(key, existing)
    }
  })

  const mergedList = Array.from(mergedMap.values())
  const outPath = path.join(DATA_DIR, 'personas_master.json')
  fs.writeFileSync(outPath, JSON.stringify(mergedList, null, 2))
  
  console.log(`✅ Synthesis Complete. Merged ${all.length} raw records into ${mergedList.length} unique personas.`)
  console.log(`📂 Output: ${outPath}`)
}

mergePersonas()
