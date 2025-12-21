import fs from 'fs'
import path from 'path'

async function main() {
  console.log('🔄 Consolidating L3 Data from Taito, Chiyoda, and Chuo wards...')
  
  const files = [
    'toei_taito_l3_ready.json',
    'toei_chiyoda_l3.json',
    'toei_chuo_l3.json'
  ]
  
  let masterData: any[] = []
  
  for (const file of files) {
    const filePath = path.resolve(process.cwd(), 'data', file)
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8')
      const data = JSON.parse(content)
      console.log(`✅ Loaded ${data.length} records from ${file}`)
      masterData = [...masterData, ...data]
    } else {
      console.warn(`⚠️ Warning: ${file} not found`)
    }
  }
  
  // Deduplicate based on node_id + type + subCategory
  const uniqueMap = new Map()
  masterData.forEach(item => {
    const key = `${item.node_id}-${item.type}-${item.attributes.subCategory}`
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, item)
    }
  })
  
  const consolidated = Array.from(uniqueMap.values())
  
  console.log(`\n📊 Consolidation Complete:`)
  console.log(`- Total Records: ${masterData.length}`)
  console.log(`- Unique Records: ${consolidated.length}`)
  console.log(`- Duplicates Removed: ${masterData.length - consolidated.length}`)
  
  const outputPath = path.resolve(process.cwd(), 'data/master_l3_facilities.json')
  fs.writeFileSync(outputPath, JSON.stringify(consolidated, null, 2))
  console.log(`\n💾 Saved Master Dataset to: ${outputPath}`)
}

main()
