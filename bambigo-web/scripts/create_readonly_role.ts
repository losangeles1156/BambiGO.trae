import 'dotenv/config'
import { Client } from 'pg'
import path from 'node:path'
import fs from 'node:fs'

async function main() {
  const envLocal = path.resolve(process.cwd(), '.env.local')
  if (fs.existsSync(envLocal)) {
    const txt = fs.readFileSync(envLocal, 'utf8')
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m) {
        const k = m[1]
        let v = m[2]
        if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
        if (v.startsWith('\'') && v.endsWith('\'')) v = v.slice(1, -1)
        if (!(k in process.env) || !process.env[k]) process.env[k] = v
      }
    }
  }

  const conn = process.env.DATABASE_URL || process.env.SUPABASE_POSTGRES_URL || process.env.SUPABASE_DATABASE_URL
  if (!conn) throw new Error('DATABASE_URL missing')
  const roUser = process.env.READONLY_DB_USER
  const roPass = process.env.READONLY_DB_PASS
  if (!roUser || !roPass) throw new Error('READONLY_DB_USER/READONLY_DB_PASS missing')

  const client = new Client({ connectionString: conn })
  await client.connect()
  try {
    await client.query(`
      do $$
      begin
        if not exists (select 1 from pg_roles where rolname = $1) then
          execute format('create role %I login password %L', $1, $2);
        end if;
      end$$;
    `, [roUser, roPass])

    const grantSql = `
      revoke all on all tables in schema public from ${roUser};
      grant select on public.cities to ${roUser};
      grant select on public.nodes to ${roUser};
      grant select on public.facilities to ${roUser};
      grant select on public.facility_suitability to ${roUser};
      grant select on public.shared_mobility_stations to ${roUser};
    `
    await client.query(grantSql)

    console.log(JSON.stringify({ readonly_role: roUser, granted: true }))
  } finally {
    await client.end()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
