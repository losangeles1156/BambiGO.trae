# ODPT Data Dictionary

This dictionary documents the ODPT storage layer used by this project.

## Naming

- `same_as`: ODPT identifier, usually from `owl:sameAs` (fallback to `@id`)
- `dc_date`: ODPT source timestamp, from `dc:date`
- `raw/payload`: full ODPT JSON object as returned by the API

## Tables

### `odpt_entities`

| Field | Meaning | Example |
|---|---|---|
| `entity_type` | ODPT entity class | `odpt:Station` |
| `same_as` | Stable ODPT ID | `odpt.Station:TokyoMetro.Ginza.Asakusa` |
| `operator` | Transport operator | `odpt.Operator:TokyoMetro` |
| `railway` | Line/railway ID | `odpt.Railway:TokyoMetro.Ginza` |
| `dc_date` | Source update time | `2025-12-20T01:23:45+09:00` |
| `fetched_at` | Ingestion time | `2025-12-20T02:00:00Z` |
| `payload` | Full ODPT JSON | `{ ... }` |
| `source_url` | Endpoint base | `https://api.odpt.org/api/v4/odpt:Station` |

Usage:

- Provides forward compatibility when ODPT adds new fields/types.
- Enables reprocessing without re-fetching.

### `odpt_stations`

| Field | Meaning | Notes |
|---|---|---|
| `same_as` | Station ID | Primary key |
| `operator` | Operator ID | From `odpt:operator` |
| `railway` | Railway/line ID | From `odpt:railway` |
| `station_code` | Station code | From `odpt:stationCode` (if present) |
| `title` | Station title | Stored as JSON object (usually `{ "ja": "..." }`) |
| `location` | Point geometry | Derived from ODPT coordinates when available |
| `dc_date` | Source update time | From `dc:date` |
| `raw` | Full ODPT JSON | For debugging and traceability |

### `odpt_busstop_poles`

| Field | Meaning | Notes |
|---|---|---|
| `same_as` | Bus stop pole ID | Primary key |
| `operator` | Operator ID | Typically `odpt.Operator:Toei` |
| `busroute_pattern` | Route pattern ID | From `odpt:busroutePattern` |
| `title` | Pole title | JSON object or null |
| `location` | Point geometry | When coordinates exist |
| `dc_date` | Source update time | From `dc:date` |
| `raw` | Full ODPT JSON | Traceability |

### `odpt_station_facilities`

| Field | Meaning | Notes |
|---|---|---|
| `same_as` | Facility ID | Primary key |
| `operator` | Operator ID | From `odpt:operator` |
| `station` | Station ID | From `odpt:station` |
| `facility_type` | Facility classification | From `odpt:facilityType` / `odpt:classification` |
| `title` | Facility title | JSON object or null |
| `location` | Point geometry | When coordinates exist |
| `dc_date` | Source update time | From `dc:date` |
| `raw` | Full ODPT JSON | Traceability |

### `odpt_train_information`

| Field | Meaning | Notes |
|---|---|---|
| `content_hash` | Dedup key | `sha256(JSON.stringify(raw))` |
| `operator` | Operator ID | Required |
| `railway` | Railway ID | Optional |
| `status` | Status code/text | From `odpt:trainInformationStatus*` |
| `information_text` | Human message | JSON object |
| `dc_date` | Source update time | From `dc:date` |
| `fetched_at` | Ingestion time | Default `now()` |
| `raw` | Full ODPT JSON | Traceability |
| `source_url` | Endpoint base | `https://api.odpt.org/api/v4/odpt:TrainInformation` |

## Frontend Compatibility Notes

The frontend reads curated app tables:

- `nodes` and `facilities` are the primary UI contract.
- ODPT tables are additive; they do not change the UI contract.

