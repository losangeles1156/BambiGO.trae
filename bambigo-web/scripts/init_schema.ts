import 'dotenv/config'
import { Client } from 'pg'
import path from 'node:path'
import fs from 'node:fs'
import dotenv from 'dotenv'

const sql = `
create extension if not exists pgcrypto;
create extension if not exists postgis;
create table if not exists public.nodes (
  id uuid primary key default gen_random_uuid(),
  name jsonb not null,
  supply_tags jsonb not null default '[]'::jsonb,
  suitability_tags jsonb not null default '[]'::jsonb,
  external_links jsonb not null default '[]'::jsonb,
  parent_hub_id uuid references public.nodes(id) on delete set null,
  odpt_id text unique,
  category text,
  geom geography(Point, 4326),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint name_structure_chk check (
    jsonb_typeof(name) = 'object'
    and name ? 'ja' and name ? 'en' and name ? 'zh'
  )
);
create index if not exists nodes_geom_idx on public.nodes using gist (geom);
create index if not exists nodes_name_gin on public.nodes using gin (name);
create index if not exists nodes_supply_tags_gin on public.nodes using gin (supply_tags);
create index if not exists nodes_suitability_tags_gin on public.nodes using gin (suitability_tags);
alter table public.nodes enable row level security;
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;$$ language plpgsql;
alter function set_updated_at() set search_path = pg_catalog, public;
create trigger set_nodes_updated_at before update on public.nodes
for each row execute function set_updated_at();

create or replace function set_node_geom(p_odpt_id text, p_lon double precision, p_lat double precision)
returns void as $$
begin
  update public.nodes
  set geom = ST_SetSRID(ST_Point(p_lon, p_lat), 4326)
  where odpt_id = p_odpt_id;
end;$$ language plpgsql;
alter function set_node_geom(text, double precision, double precision) set search_path = pg_catalog, public;

create or replace function set_nodes_geom_bulk(p_items jsonb)
returns void as $$
begin
  update public.nodes n
  set geom = ST_SetSRID(ST_Point(x.lon, x.lat), 4326)
  from jsonb_to_recordset(p_items) as x(odpt_id text, lon double precision, lat double precision)
  where n.odpt_id = x.odpt_id;
end;$$ language plpgsql;
alter function set_nodes_geom_bulk(jsonb) set search_path = pg_catalog, public;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'nodes' and policyname = 'nodes_select_public'
  ) then
    execute 'create policy nodes_select_public on public.nodes for select using (true)';
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'nodes' and policyname = 'nodes_insert_service_role'
  ) then
    execute 'create policy nodes_insert_service_role on public.nodes for insert with check ((current_setting(''request.jwt.claims'', true)::jsonb ->> ''role'') = ''service_role'')';
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'nodes' and policyname = 'nodes_update_service_role'
  ) then
    execute 'create policy nodes_update_service_role on public.nodes for update using ((current_setting(''request.jwt.claims'', true)::jsonb ->> ''role'') = ''service_role'') with check ((current_setting(''request.jwt.claims'', true)::jsonb ->> ''role'') = ''service_role'')';
  end if;
  -- Harden legacy/public tables if present
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='node_intelligence') then
    execute 'alter table public.node_intelligence enable row level security';
    if not exists (select 1 from pg_policies where schemaname='public' and tablename='node_intelligence' and policyname='node_intelligence_select_public') then
      execute 'create policy node_intelligence_select_public on public.node_intelligence for select using (true)';
    end if;
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='node_facility_profiles') then
    execute 'alter table public.node_facility_profiles enable row level security';
    if not exists (select 1 from pg_policies where schemaname='public' and tablename='node_facility_profiles' and policyname='node_facility_profiles_select_public') then
      execute 'create policy node_facility_profiles_select_public on public.node_facility_profiles for select using (true)';
    end if;
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='spatial_ref_sys') then
    execute 'alter table public.spatial_ref_sys enable row level security';
    if not exists (select 1 from pg_policies where schemaname='public' and tablename='spatial_ref_sys' and policyname='spatial_ref_sys_select_public') then
      execute 'create policy spatial_ref_sys_select_public on public.spatial_ref_sys for select using (true)';
    end if;
  end if;
end$$;
`

async function main() {
  // Fallback: manually parse .env.local if needed
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
    const nodes = await client.query("select to_regclass('public.nodes') as exists")
    const f1 = await client.query("select to_regprocedure('set_node_geom(text,double precision,double precision)') as f")
    const f2 = await client.query("select to_regprocedure('set_nodes_geom_bulk(jsonb)') as f")
    const pol = await client.query<{ policyname: string }>("select policyname from pg_policies where schemaname='public' and tablename='nodes' order by policyname")
    console.log(JSON.stringify({
      nodes_table: !!nodes.rows[0]?.exists,
      rpc_set_node_geom: !!f1.rows[0]?.f,
      rpc_set_nodes_geom_bulk: !!f2.rows[0]?.f,
      rls_policies: pol.rows.map((r) => r.policyname),
    }))
  } finally {
    await client.end()
  }
}

main().catch(err => { console.error(err); process.exit(1) })

