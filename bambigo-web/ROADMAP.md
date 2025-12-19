# Project Roadmap (Zero-One)

## Phase 1: Core Foundation (Completed)
- [x] **Project Analysis**: Verified Tech Stack (Next.js, Supabase, Tailwind).
- [x] **Weather Alert MVP**: Implemented JMA RSS Fetcher & AlertBanner.
- [x] **Refactoring**: Resolved ESLint warnings in key components.

## Phase 2: System Redesign (Current)
- [x] **n8n Sentry Architecture**: Defined "Push" model and 3-stage filtering (`N8N_ARCH.md`).
- [x] **Workflow Implementation**: Created `n8n/workflows/weather_alert_sentry.json` for Tokyo alerts.
- [x] **Hybrid API**: Updated `api/weather/alerts` to prioritize n8n webhook with local fallback.
- [x] **Context UI**: Enhanced `AlertBanner` to display L1 (Location) & L4 (Action) tags.

## Phase 3: SOP Integration & Navigation (In Progress)
- [x] Phase 1: SOP Integration Foundation (2025-12-19)
- [x] Phase 2: Real Data Integration (2025-12-19)
    - [x] Tokyo Evacuation Center data seeding (Taito-ku)
    - [x] Real-data nearest facility calculation validation
    - [x] PostGIS spatial integration verified
- [x] Phase 3: Adaptive Navigation Logic (2025-12-19)
    - [x] OSRM Real street-network routing integration
    - [x] Multilingual support for shelters (EN/ZH/JA)
    - [x] Performance baseline: < 1.5s route calculation
- [x] Phase 4: Production Readiness & Edge Cases (2025-12-19)
    - [x] Route caching (Dual-layer: Memory + LocalStorage)
    - [x] Disaster zone detection (Point-in-polygon avoidance)
    - [x] User-reported hazard mechanism
    - [x] Quality Assurance for production scenarios
