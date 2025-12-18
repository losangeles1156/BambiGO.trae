import 'dotenv/config'
import { Client } from 'pg'
import path from 'node:path'
import fs from 'node:fs'
import dotenv from 'dotenv'

const sql = `
-- 9. saved_locations (New for Profile)
create table if not exists saved_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  node_id text references nodes(id) on delete set null,
  facility_id uuid references facilities(id) on delete set null,
  title text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_saved_locations_user on saved_locations(user_id);
create index if not exists idx_saved_locations_created on saved_locations(created_at desc);

-- RLS
alter table saved_locations enable row level security;

-- Helper to create service role policy
create or replace function create_service_role_write_policy(tbl text) returns void as $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename=tbl and policyname=tbl || '_all_service_role') then
    execute format('create policy %I_all_service_role on public.%I using ((current_setting(''request.jwt.claims'', true)::jsonb ->> ''role'') = ''service_role'') with check ((current_setting(''request.jwt.claims'', true)::jsonb ->> ''role'') = ''service_role'')', tbl, tbl);
  end if;
end;$$ language plpgsql;
alter function create_service_role_write_policy(text) set search_path = pg_catalog, public;

select create_service_role_write_policy('saved_locations');

-- User Policies
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='saved_locations' and policyname='saved_locations_own_select') then
    create policy saved_locations_own_select on saved_locations for select using (auth.uid() = user_id);
  end if;
  
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='saved_locations' and policyname='saved_locations_own_insert') then
    create policy saved_locations_own_insert on saved_locations for insert with check (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='saved_locations' and policyname='saved_locations_own_update') then
    create policy saved_locations_own_update on saved_locations for update using (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='saved_locations' and policyname='saved_locations_own_delete') then
    create policy saved_locations_own_delete on saved_locations for delete using (auth.uid() = user_id);
  end if;
end $$;
`

async function main() {
  function parseEnvFile(filePath: string) {
    if (!fs.existsSync(filePath)) return
    const txt = fs.readFileSync(filePath, 'utf8')
    for (const line of txt.split(/\r?\n/)) {
      const mEq = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      const mColon = line.match(/^\s*([A-Z0-9_]+)\s*:\s*(.*)\s*$/)
      const m = mEq || mColon
      if (m) {
        const k = m[1]
        let v = m[2]
        if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
        if (v.startsWith('\'') && v.endsWith('\'')) v = v.slice(1, -1)
        if (!(k in process.env) || !process.env[k]) process.env[k] = v
      }
    }
  }

  if (!process.env.DATABASE_URL) {
    parseEnvFile(path.resolve(process.cwd(), '.env.local'))
    parseEnvFile(path.resolve(process.cwd(), '..', '.env.local'))
  }

  let conn = process.env.DATABASE_URL
    || process.env.SUPABASE_DB_URL
    || process.env.SUPABASE_POSTGRES_URL
    || process.env.SUPABASE_DATABASE_URL
    
  if (!conn) {
     dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
     conn = process.env.DATABASE_URL
      || process.env.SUPABASE_DB_URL
      || process.env.SUPABASE_POSTGRES_URL
      || process.env.SUPABASE_DATABASE_URL
  }
  
  if (!conn) throw new Error('DATABASE_URL missing')
  
  const client = new Client({ connectionString: conn })
  await client.connect()
  try {
    await client.query(sql)
    console.log('Successfully added saved_locations table.')
  } catch (e) {
    console.error(e)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main()
