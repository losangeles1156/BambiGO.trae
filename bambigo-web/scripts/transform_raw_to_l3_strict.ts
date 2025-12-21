import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'
import { L3ServiceFacilitySchema } from '../src/lib/validators/tagging'

// Type definition for my intermediate format (what I have now)
type IntermediateRecord = {
  node_id: string
  type: string
  name: { en: string; ja: string }
  attributes: {
    subCategory: string
    count?: number
    has_wheelchair_access?: boolean
    has_ostomate?: boolean
    has_baby_chair?: boolean
    source?: string
  }
  source_dataset: string
}

async function main() {
  console.log('🔄 Transforming Master Data to Strict L3 Schema...')
  
  const inputPath = path.resolve(process.cwd(), 'data/master_l3_facilities.json')
  const outputPath = path.resolve(process.cwd(), 'data/nodes_l3_strict.json')
  
  if (!fs.existsSync(inputPath)) {
    console.error('❌ Master data not found. Run consolidate_l3_data.ts first.')
    process.exit(1)
  }

  const rawData: IntermediateRecord[] = JSON.parse(fs.readFileSync(inputPath, 'utf-8'))
  const validRecords: z.infer<typeof L3ServiceFacilitySchema>[] = []

  for (const item of rawData) {
    // Map 'accessibility' -> 'accessibility', 'toilet' -> 'toilet'
    // L3CategorySchema values: 'toilet', 'charging', 'wifi', 'locker', 'accessibility', 'rest_area', 'shelter', 'medical_aid', 'other'
    
    let category: any = item.type
    if (!['toilet', 'accessibility', 'locker'].includes(category)) {
      category = 'other'
    }

    const transform: z.infer<typeof L3ServiceFacilitySchema> = {
      id: uuidv4(),
      nodeId: item.node_id,
      category: category,
      subCategory: item.attributes.subCategory,
      
      location: {
        // We don't have floor info in scraping yet, defaulting to unknown
        floor: undefined, 
        direction: undefined
      },
      
      provider: {
        type: 'station',
        name: 'Toei Subway',
        requiresPurchase: false
      },
      
      attributes: {
        name: item.name,
        count: item.attributes.count,
        has_wheelchair_access: item.attributes.has_wheelchair_access,
        has_ostomate: item.attributes.has_ostomate,
        has_baby_chair: item.attributes.has_baby_chair,
        original_source: item.attributes.source
      },
      
      source: 'official',
      updatedAt: new Date().toISOString()
    }

    // Validate against schema
    const result = L3ServiceFacilitySchema.safeParse(transform)
    if (result.success) {
      validRecords.push(transform)
    } else {
      console.warn(`⚠️ Failed to validate record for ${item.node_id}:`, result.error)
    }
  }

  fs.writeFileSync(outputPath, JSON.stringify(validRecords, null, 2))
  console.log(`\n✅ Transformed and Saved ${validRecords.length} records to ${outputPath}`)
}

main()
