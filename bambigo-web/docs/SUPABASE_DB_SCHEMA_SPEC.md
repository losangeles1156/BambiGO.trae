# Supabase Database Schema Spec (V4.1 + ODPT)

## Overview

This project uses a dual-layer data model:

- **Curated app layer**: `cities`, `nodes`, `facilities`, ... (what the frontend reads)
- **ODPT ingestion layer**: `odpt_*` tables for raw and curated ODPT objects

The design goal is to keep the frontend contract stable while allowing ODPT expansion without breaking changes.

## Core Tables (Frontend-Compatible)

### `cities`

| Column | Type | Notes |
|---|---|---|
| `id` | `text` PK | City key (e.g. `tokyo_taito`) |
| `name` | `jsonb` | I18n names (`zh-TW`, `ja`, `en`) |
| `bounds` | `geography(polygon,4326)` | Optional polygon |
| `config` | `jsonb` | Feature flags and operators |
| `enabled` | `boolean` | Default `true` |
| `created_at` | `timestamptz` | Default `now()` |

### `nodes`

| Column | Type | Notes |
|---|---|---|
| `id` | `text` PK | Uses ODPT `owl:sameAs` for ODPT nodes |
| `city_id` | `text` FK | References `cities(id)` |
| `name` | `jsonb` | I18n (`ja`, `en`, `zh`) |
| `type` | `text` | `station`, `bus_stop`, ... |
| `location` | `geography(point,4326)` | Nullable for 2-step ETL |
| `geohash` | `text` | Trigger-generated from `location` |
| `metadata` | `jsonb` | Raw+derived attributes |
| `created_at` | `timestamptz` | Default `now()` |
| `updated_at` | `timestamptz` | Default `now()` |

Indexes:

- `idx_nodes_location` (GiST), `idx_nodes_lines` (GIN), `idx_nodes_city`, `idx_nodes_type`, ...

### `facilities`

Stores facility objects attached to `nodes`.

## ODPT Layer (Extensible)

### `odpt_entities` (Raw Canonical Store)

Canonical raw storage for ODPT entities (future-proof).

| Column | Type | Notes |
|---|---|---|
| `entity_type` | `text` | e.g. `odpt:Station`, `odpt:TrainInformation` |
| `same_as` | `text` | ODPT identifier (`owl:sameAs` / `@id`) |
| `operator` | `text` | `odpt:operator` |
| `railway` | `text` | `odpt:railway` |
| `dc_date` | `timestamptz` | Source timestamp (`dc:date`) |
| `fetched_at` | `timestamptz` | Default `now()` |
| `payload` | `jsonb` | Raw ODPT JSON object |
| `source_url` | `text` | ODPT endpoint base URL |

Primary key:

- `(entity_type, same_as)`

Indexes:

- `(entity_type, dc_date desc)`
- `operator`, `railway`
- `payload` (GIN)

### Curated ODPT Tables

These are optional “query-friendly” tables. They are not required for the frontend, but help analytics and debugging.

#### `odpt_stations`

- PK: `same_as`
- `title` (`jsonb`) + `location` (`geography(point,4326)`) + `raw` (`jsonb`)

#### `odpt_busstop_poles`

- PK: `same_as`
- `busroute_pattern`, `location`, `raw`

#### `odpt_station_facilities`

- PK: `same_as`
- `station`, `facility_type`, `location`, `raw`

#### `odpt_train_information`

- PK: `content_hash` (sha256 of the raw JSON)
- `operator`, `railway`, `status`, `information_text`, `raw`

## Data Validation & Constraints

- All `raw/payload` columns enforce `jsonb_typeof(...) = 'object'`.
- ODPT identifiers enforce `same_as ~ '^odpt\.'`.
- I18n fields (`title`, `information_text`) enforce object type (not key completeness).

## Security Model (RLS)

Policy convention:

- Public read: `<table>_select_public` with `using (true)`
- Service role write: `<table>_all_service_role` grants insert/update/delete to service role only

All ODPT tables (`odpt_*`) have RLS enabled and follow the same convention.

## Provisioning

### Automated

Run:

- `npm run schema:v4.1`

This executes `bambigo-web/scripts/setup_v4_1_schema.ts`.

### Manual Fallback

If direct Postgres connectivity is blocked, copy the SQL string from `bambigo-web/scripts/setup_v4_1_schema.ts` into Supabase SQL Editor and execute.

## Backup

Enable backups in Supabase Dashboard:

- Project Settings → Database → Backups / PITR (depending on plan)

