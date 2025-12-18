# ODPT Integration & Persona Workflow Deployment Guide

> **Author:** Matrix (CTO)
> **Version:** 1.0.0
> **Last Updated:** 2025-12-18

This document outlines the deployment, monitoring, and maintenance procedures for the ODPT API integration and Persona Generation Workflow.

## 1. 🏗 System Architecture

The workflow connects to the Open Data Challenge for Public Transportation (ODPT) v4 API to fetch real-time and static data, processes it into standardized schemas, and generates AI Personas for transit nodes.

### Components
-   **OdptClient (`src/lib/odptClient.ts`)**: A robust, resilient HTTP client handling authentication, rate limiting (429/503), caching, and XML/JSON parsing.
-   **Persona Generator (`scripts/generate_personas.ts`)**: The orchestration script that uses OdptClient to fetch data, cluster stations, and derive persona prompts.
-   **Supabase**: The persistence layer for storing node metadata and generated personas.

---

## 2. 🚀 Deployment

### Prerequisites
-   Node.js 18+
-   `ODPT_API_TOKEN`: Valid access token from [ODPT Developer Center](https://developer.odpt.org/).
-   `NEXT_PUBLIC_SUPABASE_URL` & `SUPABASE_SERVICE_ROLE_KEY`: For database access.

### Environment Setup
Ensure your `.env.local` or CI secrets contain:
```bash
ODPT_API_TOKEN=your_token_here
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_key
```

### Execution

#### 1. Generate Personas (Manual / Cron)
Run the generator for specific transport modes:
```bash
# Subway (Tokyo Metro + Toei)
npx tsx scripts/generate_personas.ts --type=subway

# JR East
npx tsx scripts/generate_personas.ts --type=jr

# Private Railways (Tsukuba Express, Yurikamome)
npx tsx scripts/generate_personas.ts --type=private
```
*Output*: JSON files will be generated in `data/personas_*.json`.

#### 2. Verify Output
Check the generated JSON for:
-   `complexity_score`: Does it reflect reality? (e.g., Tokyo > 50)
-   `trap_warnings`: Are key risks identified? (e.g., Keiyo Line distance)

---

## 3. 📊 Monitoring & Logging

### Logs
The system uses standard stdout/stderr logging.
-   `[ODPT]`: API interaction logs (requests, retries, failures).
-   `[Fetcher]`: High-level workflow progress.

### Metrics to Watch
1.  **Rate Limit Hits**: Frequent 429 errors indicate we need to increase `throttleMs` in `OdptClient` or request a higher quota.
2.  **Cache Hit Rate**: The client caches responses in `.cache/odpt`. Ensure this directory persists across runs if possible to save quota.
3.  **Data Completeness**: If `odpt:stationTitle` is missing, the script falls back to "Unknown". Monitor for high counts of unknown stations.

---

## 4. 🛡 Maintenance & Troubleshooting

### Common Issues

#### `Error: ODPT HTTP 403`
-   **Cause**: Invalid or expired token.
-   **Fix**: Update `ODPT_API_TOKEN`.

#### `Error: ODPT HTTP 429` (Persistent)
-   **Cause**: Quota exceeded.
-   **Fix**: The client automatically retries. If it fails after max retries, wait until the quota resets (usually daily or hourly depending on plan).

#### `Error: Unknown file extension ".ts"`
-   **Cause**: Running with `node` instead of `tsx`.
-   **Fix**: Always use `npx tsx ...`.

### Adding New Operators
To support a new railway operator (e.g., Keio, Odakyu):
1.  Update `OPERATOR_PRIORITY` in `scripts/generate_personas.ts`.
2.  Add the operator ID (e.g., `odpt.Operator:Keio`) to the mapping logic in `fetchStations`.

---

## 5. 🧪 Testing Strategy

Run the integration tests to verify the client logic:
```bash
npm test tests/odpt_client.spec.ts
```
This tests:
-   Retry logic (simulates 429).
-   XML parsing (simulates XML response).
-   Caching behavior.

---

**End of Document**
