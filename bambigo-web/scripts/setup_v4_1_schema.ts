import 'dotenv/config'
import { Client } from 'pg'
import path from 'node:path'
import fs from 'node:fs'

const sql = `
-- Extensions
create extension if not exists pgcrypto;
create extension if not exists postgis;

-- Drop tables if exist to ensure v4.1 schema compliance
drop table if exists nudge_logs cascade;
drop table if exists trip_subscriptions cascade;
drop table if exists users cascade;
drop table if exists shared_mobility_stations cascade;
drop table if exists facility_suitability cascade;
drop table if exists facilities cascade;
drop table if exists nodes cascade;
drop table if exists cities cascade;

-- 1. cities
create table cities (
  id text primary key,
  name jsonb not null,
  timezone text not null default 'Asia/Tokyo',
  bounds geography(polygon, 4326),
  config jsonb not null default '{}',
  enabled boolean default true,
  created_at timestamptz default now()
);

insert into cities (id, name, config) values
  ('tokyo_taito', 
   '{"zh-TW": "台東區", "ja": "台東区", "en": "Taito City"}',
   '{"has_subway": true, "has_shared_mobility": true, "has_bus": true, "odpt_operators": ["TokyoMetro", "Toei", "JR-East"], "default_language": "zh-TW"}'),
  ('tokyo_chiyoda', 
   '{"zh-TW": "千代田區", "ja": "千代田区", "en": "Chiyoda City"}',
   '{"has_subway": true, "has_shared_mobility": true, "has_bus": true, "odpt_operators": ["TokyoMetro", "Toei", "JR-East"], "default_language": "zh-TW"}'),
  ('tokyo_chuo', 
   '{"zh-TW": "中央區", "ja": "中央区", "en": "Chuo City"}',
   '{"has_subway": true, "has_shared_mobility": true, "has_bus": true, "odpt_operators": ["TokyoMetro", "Toei", "JR-East"], "default_language": "zh-TW"}');

-- 2. nodes
create table nodes (
  id text primary key,
  city_id text references cities(id),
  name jsonb not null,
  type text not null,
  location geography(point, 4326), -- Nullable to allow 2-step ETL (upsert -> set_location)
  geohash text, -- Auto-generated via trigger if null
  vibe text,
  accessibility text default 'unknown',
  is_hub boolean default false,
  parent_hub_id text references nodes(id),
  persona_prompt text,
  line_ids text[],
  source_dataset text not null,
  source_id text,
  metadata jsonb default '{}',
  external_links jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_nodes_city on nodes(city_id);
create index idx_nodes_type on nodes(type);
create index idx_nodes_geohash on nodes(geohash);
create index idx_nodes_vibe on nodes(vibe);
create index idx_nodes_hub on nodes(is_hub) where is_hub = true;
create index idx_nodes_parent on nodes(parent_hub_id);
create index idx_nodes_location on nodes using gist(location);
create index idx_nodes_lines on nodes using gin(line_ids);

-- Auto-generate geohash trigger
create or replace function set_nodes_geohash() returns trigger as $$
begin
  if new.location is not null then
    new.geohash := ST_GeoHash(new.location::geometry, 10);
  end if;
  return new;
end;$$ language plpgsql;

create trigger set_nodes_geohash_trigger before insert or update on nodes
for each row execute function set_nodes_geohash();

-- 3. facilities
create table facilities (
  id uuid primary key default gen_random_uuid(),
  node_id text references nodes(id) on delete cascade,
  city_id text references cities(id),
  type text not null,
  name jsonb,
  distance_meters int,
  direction text,
  floor text,
  has_wheelchair_access boolean default false,
  has_baby_care boolean default false,
  is_free boolean default true,
  is_24h boolean default false,
  current_status text default 'unknown',
  status_updated_at timestamptz,
  attributes jsonb default '{}',
  booking_url text,
  source_dataset text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_facilities_node on facilities(node_id);
create index idx_facilities_city on facilities(city_id);
create index idx_facilities_type on facilities(type);
create index idx_facilities_wheelchair on facilities(has_wheelchair_access) where has_wheelchair_access = true;
create index idx_facilities_status on facilities(current_status);

-- 4. facility_suitability
create table facility_suitability (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid references facilities(id) on delete cascade,
  tag text not null,
  confidence float default 1.0,
  source text default 'manual',
  created_at timestamptz default now()
);

create index idx_suitability_tag on facility_suitability(tag);
create index idx_suitability_facility on facility_suitability(facility_id);
create index idx_suitability_tag_confidence on facility_suitability(tag, confidence desc);

-- 5. shared_mobility_stations
create table shared_mobility_stations (
  id text primary key,
  node_id text references nodes(id),
  city_id text references cities(id),
  system_id text not null,
  system_name text,
  name text not null,
  location geography(point, 4326) not null,
  capacity int,
  vehicle_types text[] default array['bike'],
  bikes_available int default 0,
  docks_available int default 0,
  is_renting boolean default true,
  is_returning boolean default true,
  status_updated_at timestamptz,
  app_deeplink text,
  created_at timestamptz default now()
);

create index idx_mobility_city on shared_mobility_stations(city_id);
create index idx_mobility_system on shared_mobility_stations(system_id);
create index idx_mobility_location on shared_mobility_stations using gist(location);
create index idx_mobility_available on shared_mobility_stations(bikes_available) where bikes_available > 0;

-- 6. users
create table users (
  id uuid primary key references auth.users(id),
  display_name text,
  preferred_language text default 'zh-TW',
  line_user_id text unique,
  line_notify_token text,
  preferences jsonb default '{}',
  is_guest boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 7. trip_subscriptions
create table trip_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  route_ids text[] not null,
  origin_node_id text references nodes(id),
  destination_node_id text references nodes(id),
  active_days int[] default array[0,1,2,3,4,5,6],
  active_start_time time,
  active_end_time time,
  last_known_status jsonb,
  last_notified_at timestamptz,
  notification_cooldown_minutes int default 15,
  is_active boolean default true,
  created_at timestamptz default now()
);

create index idx_trip_user on trip_subscriptions(user_id);
create index idx_trip_active on trip_subscriptions(is_active) where is_active = true;
create index idx_trip_routes on trip_subscriptions using gin(route_ids);

-- 8. nudge_logs
create table nudge_logs (
  id uuid primary key default gen_random_uuid(),
  city_id text references cities(id),
  session_id text not null,
  user_id uuid references users(id),
  trigger_type text not null,
  trigger_node_id text references nodes(id),
  trigger_location geography(point, 4326),
  query_type text not null,
  intended_destination_id text,
  intended_destination_text text,
  query_raw text,
  response_type text,
  response_summary text,
  action_cards jsonb,
  card_selected int,
  deeplink_clicked boolean default false,
  clicked_provider text,
  potential_revenue_type text,
  created_at timestamptz default now()
);

create index idx_nudge_city on nudge_logs(city_id);
create index idx_nudge_session on nudge_logs(session_id);
create index idx_nudge_query_type on nudge_logs(query_type);
create index idx_nudge_created on nudge_logs(created_at);
create index idx_nudge_clicked on nudge_logs(deeplink_clicked) where deeplink_clicked = true;
create index idx_nudge_provider on nudge_logs(clicked_provider) where clicked_provider is not null;
create index idx_nudge_revenue on nudge_logs(city_id, potential_revenue_type, created_at);

-- RLS Policies
alter table cities enable row level security;
alter table nodes enable row level security;
alter table facilities enable row level security;
alter table facility_suitability enable row level security;
alter table shared_mobility_stations enable row level security;
alter table users enable row level security;
alter table trip_subscriptions enable row level security;
alter table nudge_logs enable row level security;

-- Helper to create public read policy
create or replace function create_public_read_policy(tbl text) returns void as $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename=tbl and policyname=tbl || '_select_public') then
    execute format('create policy %I_select_public on public.%I for select using (true)', tbl, tbl);
  end if;
end;$$ language plpgsql;

select create_public_read_policy('cities');
select create_public_read_policy('nodes');
select create_public_read_policy('facilities');
select create_public_read_policy('facility_suitability');
select create_public_read_policy('shared_mobility_stations');

-- Service Role write access
create or replace function create_service_role_write_policy(tbl text) returns void as $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename=tbl and policyname=tbl || '_all_service_role') then
    execute format('create policy %I_all_service_role on public.%I using ((current_setting(''request.jwt.claims'', true)::jsonb ->> ''role'') = ''service_role'') with check ((current_setting(''request.jwt.claims'', true)::jsonb ->> ''role'') = ''service_role'')', tbl, tbl);
  end if;
end;$$ language plpgsql;

select create_service_role_write_policy('cities');
select create_service_role_write_policy('nodes');
select create_service_role_write_policy('facilities');
select create_service_role_write_policy('facility_suitability');
select create_service_role_write_policy('shared_mobility_stations');
select create_service_role_write_policy('users');
select create_service_role_write_policy('trip_subscriptions');
select create_service_role_write_policy('nudge_logs');

-- RPC for bulk location update
create or replace function set_node_location_bulk(p_items jsonb)
returns void as $$
begin
  update public.nodes n
  set location = ST_SetSRID(ST_Point(x.lon, x.lat), 4326)
  from jsonb_to_recordset(p_items) as x(id text, lon double precision, lat double precision)
  where n.id = x.id;
end;$$ language plpgsql;
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
        if (v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1)
        if (!(k in process.env) || !process.env[k]) process.env[k] = v
      }
    }
  }
  parseEnvFile(path.resolve(process.cwd(), '.env.local'))
  parseEnvFile(path.resolve(process.cwd(), '..', '.env.local'))

  const conn = process.env.DATABASE_URL
    || process.env.SUPABASE_DB_URL
    || process.env.SUPABASE_POSTGRES_URL
    || process.env.SUPABASE_DATABASE_URL
  
  if (!conn) throw new Error('DATABASE_URL missing')
  
  const client = new Client({ connectionString: conn })
  await client.connect()
  try {
    console.log('Applying v4.1 Schema...')
    await client.query(sql)
    console.log('Schema v4.1 applied successfully.')
  } catch (e) {
    console.error('Migration failed:', e)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main()
