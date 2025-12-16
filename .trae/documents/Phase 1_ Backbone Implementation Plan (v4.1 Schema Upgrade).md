I have analyzed the `project_rules.md` and `db_schema.md`. The current `nodes` table is a simplified version (v4.0-ish) and needs to be upgraded to the full v4.1 schema to support the Guest-First features and Hub/Spoke architecture.

Here is the execution plan for Phase 1:

## 1. Database Schema Upgrade (v4.1)
- **Action**: Create and run `scripts/setup_v4_1_schema.ts`.
- **Details**: 
  - Drop existing `nodes` table (resetting data).
  - Create all 8 tables defined in `db_schema.md`: `cities`, `nodes`, `facilities`, `facility_suitability`, `shared_mobility_stations`, `users`, `trip_subscriptions`, `nudge_logs`.
  - Implement RLS policies and Indexes as specified.
  - Insert initial data for `cities` (Taito, Chiyoda, Chuo).

## 2. Project Structure & Core Logic
- **Action**: Create core library files.
- **Files**:
  - `lib/adapters/tokyo.ts`: Implement the Tokyo City Adapter with config.
  - `lib/utils/i18n.ts`: Implement `getLocalizedName` helper.
  - `lib/db/queries.ts`: Common database access patterns.

## 3. Update ETL Pipeline
- **Action**: Refactor `scripts/fetch_tokyo_odpt.ts`.
- **Details**:
  - Map ODPT data to the new `nodes` schema (e.g., `odpt_id` -> `id`, `category` -> `type`).
  - Ensure `city_id` is assigned correctly based on location.
  - Populate `geohash` and `source_dataset` fields.

## 4. Hub/Spoke Logic
- **Action**: Implement inheritance logic.
- **Details**:
  - Create a function/script to identify Hubs (e.g., Ueno, Tokyo, Ginza) and assign `is_hub=true`.
  - Calculate and update `parent_hub_id` for all Spoke nodes based on proximity.

## 5. Verification
- **Action**: Re-run ETL and Verify Map.
- **Details**:
  - Execute the new schema script.
  - Run the updated ODPT fetch script.
  - Verify the map component still works (updating query to use new schema fields).

Do you confirm this plan to upgrade the database and implement the Phase 1 backbone?