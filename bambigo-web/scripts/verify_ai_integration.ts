import { fsNodeRepo } from '../src/lib/services/node-repository'
import { AIContextBuilder } from '../src/lib/ai/context-builder'

async function main() {
  console.log('🧪 Starting End-to-End Verification for AI Integration...\n')

  // 1. Verify Repository Loading
  console.log('--- Step 1: Repository Verification ---')
  const nodes = await fsNodeRepo.getAllNodes()
  console.log(`✅ Repository loaded ${nodes.length} unique nodes.`)
  
  if (nodes.length === 0) {
    console.error('❌ No nodes found. Aborting.')
    process.exit(1)
  }

  // 2. Pick a Test Node (Asakusa)
  const testNodeId = 'odpt.Station:Toei.Asakusa.Asakusa'
  console.log(`\n--- Step 2: Testing Node "${testNodeId}" ---`)
  
  const facilities = await fsNodeRepo.getFacilities(testNodeId)
  console.log(`✅ Retrieved ${facilities.length} facility records.`)
  facilities.forEach(f => {
    const attrs = f.attributes as Record<string, unknown>
    const nameObj = attrs['name']
    const nameEn = nameObj && typeof nameObj === 'object' ? (nameObj as Record<string, unknown>)['en'] : undefined
    const name = typeof nameEn === 'string' && nameEn.trim() ? nameEn : 'Unknown'
    console.log(`   - [${f.category}] ${name} (${f.subCategory})`)
  })

  // 3. Verify AI Context Generation
  console.log(`\n--- Step 3: AI Context Generation ---`)
  const builder = new AIContextBuilder(fsNodeRepo)
  const context = await builder.buildContext(testNodeId)
  
  console.log('📄 Generated Context Output:')
  console.log('--------------------------------------------------')
  console.log(context)
  console.log('--------------------------------------------------')

  if (context.includes('Elevators: 3 units')) {
    console.log('✅ Context correctly identifies 3 elevators.')
  } else {
    console.warn('⚠️ Context verification failed for elevator count.')
  }

  if (context.includes('Accessible Toilet: Available')) {
    console.log('✅ Context correctly identifies accessible toilet.')
  } else {
    console.warn('⚠️ Context verification failed for toilet.')
  }

  console.log('\n🎉 Verification Complete!')
}

main()
