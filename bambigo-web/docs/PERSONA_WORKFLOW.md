# 🧠 Node Persona Generation Workflow (NPGW)

> **Responsible Agent:** Matrix (CTO)
> **Target Scope:** Chiyoda, Chuo, Taito Wards
> **Objective:** Systematically generate "Soul" (Persona) for each major transit node.

## 1. 🔄 Workflow Overview

This workflow transforms raw static data (Facilities, Timetables) into a "Human-Like Persona" capable of guiding users through complex transit scenarios.

### Phases
1.  **Data Aggregation (The Body)**: Collect raw facts.
    -   Inputs: ODPT Station Data, L3 Facility Tags, Physical Layout (Depth/Exits).
2.  **Identity Clustering (The Soul Container)**: Group co-located stations.
    -   Rule: Stations within 200m or sharing exact names are merged (e.g., Tokyo Metro Tokyo Sta. + JR Tokyo Sta.).
3.  **Persona Synthesis (The Brain)**: AI-driven generation.
    -   Input: Aggregated context + "Trap" Knowledge.
    -   Output: System Prompt & Personality Traits.
4.  **Deployment (The Birth)**: Update `nodes` table in Supabase.

---

## 2. 🗓 Execution Sequence

We process stations in concentric priority layers:

### Batch 1: The Veins (Subway Network)
*Focus: Underground connectivity, exits, and weather resilience.*
-   **Tokyo Metro**: Ginza Line, Hibiya Line, Tozai Line, Chiyoda Line, Hanzomon Line.
-   **Toei Subway**: Asakusa Line, Shinjuku Line, Oedo Line.

### Batch 2: The Arteries (JR Network)
*Focus: Inter-city transit, huge terminals, complexity management.*
-   **Lines**: Yamanote, Keihin-Tohoku, Chuo, Sobu, Keiyo (Special Alert).

### Batch 3: The Capillaries (Private/Other)
*Focus: Last mile, specific integration.*
-   **Operators**: Tsukuba Express (Akihabara), Yurikamome (Shimbashi/Toyosu).

---

## 3. 🧬 Persona Architecture

Each Node Persona consists of:

### A. Core Identity (Character)
-   **Archetype**: e.g., "The Busy Executive" (Otemachi), "The Traditionalist" (Asakusa), "The Maze Master" (Shinjuku/Tokyo).
-   **Tone**: Formal, Friendly, Urgent, Relaxed.

### B. Spatial Awareness (The "Trap" Database)
*Critical for "Matrix" compliance.*
-   **Vertical Friction**: "Deep underground" (Oedo Line) vs "Elevated" (Ginza Line Shibuya).
-   **Transfer Resistance**: Distance, crowd density, required buffer time.

### C. Capability Tags (L3 Integration)
-   `has_wifi`, `has_work_space`, `has_accessible_toilet`, `is_weather_safe`.

---

## 4. 🛠 Tooling Specification

### Script: `scripts/generate_personas.ts`

**Usage:**
```bash
# Process specific batch
npm run persona:gen -- --ward=chiyoda --type=subway
npm run persona:gen -- --ward=taito --type=jr
npm run persona:gen -- --node="Tokyo Station"
```

**Logic:**
1.  **Fetch**: Query ODPT API for stations in target wards.
2.  **Cluster**: Merge `odpt:Station` entries by name/geo.
3.  **Contextualize**:
    -   Calculate "Complexity Score" (number of lines * number of exits).
    -   Identify "Traps" (keyword matching: "Keiyo", "Oedo", "Transfer").
4.  **Prompt Engineering**:
    -   Construct a structured prompt for the LLM.
5.  **Output**: Generate JSON for review.

---

## 5. 📝 Example Persona Prompt (Output)

```text
[System]
You are the "Spirit of Tokyo Station" (The Grand Central Hub).
Personality: Authoritative, Precise, but Protective.
Context:
- You manage the most complex intersection in Japan.
- Key Risk: The Keiyo Line is 500m away (20 min walk).
- Key Risk: The Marunouchi and Yaesu sides are separated; crossing is hard without a ticket.

User Scenario: "I have 10 minutes to catch the Disney train."
Your Response: "IMPOSSIBLE. Stop immediately. The Keiyo Line platform requires 20 minutes from the central gate. You will miss it. Look for the next train."
```

---

## 6. 🚀 Phase 5: Synthesis & Deployment (New)

### Step 1: Identity Synthesis
Merge disparate operator nodes (e.g., JR + Metro) into single "Cluster Personas".

```bash
# Merges personas_subway.json, personas_jr.json, etc. into personas_master.json
npx tsx scripts/merge_personas.ts
```

### Step 2: Database Injection (Seeding)
Injects the synthesized personas into the live `nodes` table in Supabase/Postgres.

**Prerequisites:**
- `nodes` table must exist (via `scripts/setup_v4_1_schema.ts`).
- `DATABASE_URL` environment variable must be set.

**Command:**
```bash
npx tsx scripts/seed_personas.ts
```

**What it does:**
1.  Checks if `nodes` table has `persona_prompt` column; adds it if missing.
2.  Updates `nodes` where `name->>'en'` matches the Persona name.
3.  Injects `system_prompt` into `persona_prompt`.
4.  Injects `archetype`, `complexity_score`, `trap_warnings` into `metadata`.

### Step 3: Validation
Verify the injection by querying a sample node:

```bash
# (Optional) Verify via SQL
psql $DATABASE_URL -c "SELECT name->>'en', persona_prompt FROM nodes WHERE name->>'en' = 'Tokyo';"
```

## 7. 🛡 Maintenance & Monitoring

-   **Logs**: Seeding process logs to stdout. Capture these in CI/CD pipelines.
-   **Drift Detection**: If ODPT adds new stations, run `generate_personas.ts` -> `merge_personas.ts` -> `seed_personas.ts`.
-   **Security**: The seed script uses parameterized queries to prevent SQL injection.
