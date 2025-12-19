
import dotenv from 'dotenv'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase env vars')
  process.exit(1)
}

if (!process.env.DATABASE_URL) {
  console.warn('⚠️  DATABASE_URL is missing. PG client operations will fail.')
} else {
  console.log('✅ DATABASE_URL is present.')
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function inspect() {
  const { data, error } = await supabase.from('nodes').select('*').limit(1)
  if (error) {
    console.error('Error:', error)
  } else {
    const node = data[0]
    console.log('Sample Node:', JSON.stringify(node, null, 2))
    
    if (node.location) {
      const hex = node.location
      // EWKB Point parser (Little Endian assumed from 01 start)
      // Header: 1 byte (endian) + 4 bytes (type) + 4 bytes (srid) = 9 bytes = 18 hex chars
      // But type might be 01000020 for Point+SRID
      
      const buffer = Buffer.from(hex, 'hex')
      const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
      const littleEndian = view.getUint8(0) === 1
      const type = view.getUint32(1, littleEndian)
      const srid = view.getUint32(5, littleEndian)
      const x = view.getFloat64(9, littleEndian)
      const y = view.getFloat64(17, littleEndian)
      
      console.log('Parsed Geometry:')
      console.log('Endian:', littleEndian ? 'LE' : 'BE')
      console.log('Type:', type.toString(16))
      console.log('SRID:', srid)
      console.log('Coordinates:', [x, y])
    }
  }
}

inspect()
