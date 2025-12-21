import { Pool } from 'pg'

const globalForDb = global as unknown as { db: Pool }

export const db = globalForDb.db || new Pool({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: { rejectUnauthorized: false }
})

if (process.env.NODE_ENV !== 'production') globalForDb.db = db

export default db
