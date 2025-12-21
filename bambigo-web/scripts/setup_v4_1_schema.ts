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
drop table if exists saved_locations cascade;
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
alter function set_nodes_geohash() set search_path = pg_catalog, public;

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

-- 9. saved_locations
create table saved_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade not null,
  node_id text references nodes(id) on delete set null,
  facility_id text references facilities(id) on delete set null,
  title text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_saved_locations_user on saved_locations(user_id);
create index idx_saved_locations_created on saved_locations(created_at desc);

-- 10. ODPT raw/curated storage (extensible)
create table odpt_entities (
  entity_type text not null,
  same_as text not null,
  operator text,
  railway text,
  dc_date timestamptz,
  fetched_at timestamptz not null default now(),
  payload jsonb not null,
  source_url text,
  primary key (entity_type, same_as),
  constraint odpt_entities_same_as_format check (same_as ~ '^odpt\\.'),
  constraint odpt_entities_payload_object check (jsonb_typeof(payload) = 'object')
);

create index idx_odpt_entities_type_date on odpt_entities(entity_type, dc_date desc);
create index idx_odpt_entities_operator on odpt_entities(operator);
create index idx_odpt_entities_railway on odpt_entities(railway);
create index idx_odpt_entities_payload_gin on odpt_entities using gin(payload);

create table odpt_stations (
  same_as text primary key,
  operator text,
  railway text,
  station_code text,
  title jsonb not null,
  location geography(point, 4326),
  dc_date timestamptz,
  raw jsonb not null,
  constraint odpt_stations_same_as_format check (same_as ~ '^odpt\\.'),
  constraint odpt_stations_title_object check (jsonb_typeof(title) = 'object'),
  constraint odpt_stations_raw_object check (jsonb_typeof(raw) = 'object')
);

create index idx_odpt_stations_operator on odpt_stations(operator);
create index idx_odpt_stations_railway on odpt_stations(railway);
create index idx_odpt_stations_location on odpt_stations using gist(location);
create index idx_odpt_stations_title_gin on odpt_stations using gin(title);

create table odpt_busstop_poles (
  same_as text primary key,
  operator text,
  busroute_pattern text,
  title jsonb,
  location geography(point, 4326),
  dc_date timestamptz,
  raw jsonb not null,
  constraint odpt_busstop_poles_same_as_format check (same_as ~ '^odpt\\.'),
  constraint odpt_busstop_poles_title_object check (title is null or jsonb_typeof(title) = 'object'),
  constraint odpt_busstop_poles_raw_object check (jsonb_typeof(raw) = 'object')
);

create index idx_odpt_busstop_poles_operator on odpt_busstop_poles(operator);
create index idx_odpt_busstop_poles_pattern on odpt_busstop_poles(busroute_pattern);
create index idx_odpt_busstop_poles_location on odpt_busstop_poles using gist(location);

create table odpt_station_facilities (
  same_as text primary key,
  operator text,
  station text,
  facility_type text,
  title jsonb,
  location geography(point, 4326),
  dc_date timestamptz,
  raw jsonb not null,
  constraint odpt_station_facilities_same_as_format check (same_as ~ '^odpt\\.'),
  constraint odpt_station_facilities_title_object check (title is null or jsonb_typeof(title) = 'object'),
  constraint odpt_station_facilities_raw_object check (jsonb_typeof(raw) = 'object')
);

create index idx_odpt_station_facilities_operator on odpt_station_facilities(operator);
create index idx_odpt_station_facilities_station on odpt_station_facilities(station);
create index idx_odpt_station_facilities_type on odpt_station_facilities(facility_type);
create index idx_odpt_station_facilities_location on odpt_station_facilities using gist(location);

create table odpt_train_information (
  content_hash text primary key,
  operator text not null,
  railway text,
  status text,
  information_text jsonb not null,
  dc_date timestamptz,
  fetched_at timestamptz not null default now(),
  raw jsonb not null,
  source_url text,
  constraint odpt_train_information_text_object check (jsonb_typeof(information_text) = 'object'),
  constraint odpt_train_information_raw_object check (jsonb_typeof(raw) = 'object')
);

create index idx_odpt_train_information_operator_date on odpt_train_information(operator, fetched_at desc);
create index idx_odpt_train_information_railway_date on odpt_train_information(railway, fetched_at desc);
create index idx_odpt_train_information_text_gin on odpt_train_information using gin(information_text);

-- RLS Policies
alter table cities enable row level security;
alter table nodes enable row level security;
alter table facilities enable row level security;
alter table facility_suitability enable row level security;
alter table shared_mobility_stations enable row level security;
alter table users enable row level security;
alter table trip_subscriptions enable row level security;
alter table nudge_logs enable row level security;
alter table saved_locations enable row level security;
alter table odpt_entities enable row level security;
alter table odpt_stations enable row level security;
alter table odpt_busstop_poles enable row level security;
alter table odpt_station_facilities enable row level security;
alter table odpt_train_information enable row level security;

-- Helper to create public read policy
create or replace function create_public_read_policy(tbl text) returns void as $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename=tbl and policyname=tbl || '_select_public') then
    execute format('create policy %I_select_public on public.%I for select using (true)', tbl, tbl);
  end if;
end;$$ language plpgsql;
alter function create_public_read_policy(text) set search_path = pg_catalog, public;

select create_public_read_policy('cities');
select create_public_read_policy('nodes');
select create_public_read_policy('facilities');
select create_public_read_policy('facility_suitability');
select create_public_read_policy('shared_mobility_stations');
select create_public_read_policy('odpt_entities');
select create_public_read_policy('odpt_stations');
select create_public_read_policy('odpt_busstop_poles');
select create_public_read_policy('odpt_station_facilities');
select create_public_read_policy('odpt_train_information');

-- Service Role write access
create or replace function create_service_role_write_policy(tbl text) returns void as $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename=tbl and policyname=tbl || '_all_service_role') then
    execute format('create policy %I_all_service_role on public.%I using ((current_setting(''request.jwt.claims'', true)::jsonb ->> ''role'') = ''service_role'') with check ((current_setting(''request.jwt.claims'', true)::jsonb ->> ''role'') = ''service_role'')', tbl, tbl);
  end if;
end;$$ language plpgsql;
alter function create_service_role_write_policy(text) set search_path = pg_catalog, public;

select create_service_role_write_policy('cities');
select create_service_role_write_policy('nodes');
select create_service_role_write_policy('facilities');
select create_service_role_write_policy('facility_suitability');
select create_service_role_write_policy('shared_mobility_stations');
select create_service_role_write_policy('users');
select create_service_role_write_policy('trip_subscriptions');
select create_service_role_write_policy('nudge_logs');
select create_service_role_write_policy('saved_locations');
select create_service_role_write_policy('odpt_entities');
select create_service_role_write_policy('odpt_stations');
select create_service_role_write_policy('odpt_busstop_poles');
select create_service_role_write_policy('odpt_station_facilities');
select create_service_role_write_policy('odpt_train_information');

-- User Access Policies
create or replace function create_user_own_policy(tbl text) returns void as $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename=tbl and policyname=tbl || '_own_select') then
    execute format('create policy %I_own_select on public.%I for select using (auth.uid() = user_id)', tbl, tbl);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename=tbl and policyname=tbl || '_own_insert') then
    execute format('create policy %I_own_insert on public.%I for insert with check (auth.uid() = user_id)', tbl, tbl);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename=tbl and policyname=tbl || '_own_update') then
    execute format('create policy %I_own_update on public.%I for update using (auth.uid() = user_id)', tbl, tbl);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename=tbl and policyname=tbl || '_own_delete') then
    execute format('create policy %I_own_delete on public.%I for delete using (auth.uid() = user_id)', tbl, tbl);
  end if;
end;$$ language plpgsql;
alter function create_user_own_policy(text) set search_path = pg_catalog, public;

select create_user_own_policy('saved_locations');
select create_user_own_policy('trip_subscriptions');
select create_user_own_policy('nudge_logs');

-- Users table is special because the column is 'id', not 'user_id'
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='users' and policyname='users_own_select') then
    create policy users_own_select on users for select using (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='users' and policyname='users_own_insert') then
    create policy users_own_insert on users for insert with check (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='users' and policyname='users_own_update') then
    create policy users_own_update on users for update using (auth.uid() = id);
  end if;
end $$;

-- RPC for bulk location update
create or replace function set_node_location_bulk(p_items jsonb)
returns void as $$
begin
  update public.nodes n
  set location = ST_SetSRID(ST_Point(x.lon, x.lat), 4326)
  from jsonb_to_recordset(p_items) as x(id text, lon double precision, lat double precision)
  where n.id = x.id;
end;$$ language plpgsql;
alter function set_node_location_bulk(jsonb) set search_path = pg_catalog, public;

-- Harden legacy/public tables if present
do $$
begin
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
    begin
      execute 'alter table public.spatial_ref_sys enable row level security';
      if not exists (select 1 from pg_policies where schemaname='public' and tablename='spatial_ref_sys' and policyname='spatial_ref_sys_select_public') then
        execute 'create policy spatial_ref_sys_select_public on public.spatial_ref_sys for select using (true)';
      end if;
    exception when others then
      -- insufficient privileges for spatial_ref_sys; skip hardening for this table
      null;
    end;
  end if;
end$$;
`

async function main() {
  if (process.argv.includes('--print')) {
    process.stdout.write(sql)
    return
  }

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
        // .env.local should override .env
        process.env[k] = v
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
  
  const client = new Client({
    connectionString: conn,
    ssl: conn.includes('supabase.') || conn.includes('supabase.com') ? { rejectUnauthorized: false } : undefined,
  })
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
