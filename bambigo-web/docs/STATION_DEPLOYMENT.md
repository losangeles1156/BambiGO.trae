# Station Deployment & Standardization Workflow

## Overview
This document outlines the standard operating procedure (SOP) for deploying the BambiGO UI architecture to new station nodes, ensuring consistency with the **Ueno Station Benchmark (v1.0)**.

## Core Philosophy (Zero-One)
- **Immutable Core:** The UI architecture (`NodeDashboard`, `NodeDetailCard`, `L2StatusMarquee`) is a shared template. Do NOT modify these files for specific stations.
- **Config-Driven:** All visual differences (colors, logos, operators) must be defined in `src/config/station-identity.ts`.
- **Automated Validation:** Every deployment must pass the Station Validator check.

## 1. Standardization Workflow

### Step 1: Identity Configuration
Add a new entry to `src/config/station-identity.ts` for the target `nodeId`.

```typescript
// src/config/station-identity.ts
export const STATION_BRANDS: Record<string, StationIdentity> = {
  'node-id-here': {
    color: '#HexColor',      // Brand Color
    accentColor: '#HexColor', // Light Accent
    textColor: '#HexColor',   // Contrast Text
    lineCode: 'XX',           // e.g., JY, G, M
    operatorName: 'Operator', // e.g., Tokyo Metro
  }
}
```

### Step 2: Data Binding
Ensure the `nodeId` exists in the Supabase `nodes` table and has associated `node_facility_profiles`.
- The `NodeDashboard` automatically fetches data based on `nodeId`.
- No code changes required if the data exists.

### Step 3: Validation
Run the validation script to ensure compliance (Functionality pending CLI integration, currently accessible via `StationValidator.validate(nodeId)`).

## 2. Difference Configuration Check

To verify consistency, we check against the Ueno Station Benchmark.

### Station Version Matrix

| Station Name | Node ID | UI Version | Brand Color | Line Code | Status | Differences / Notes |
|--------------|---------|------------|-------------|-----------|--------|---------------------|
| **Ueno (Benchmark)** | `mock-ueno` | v1.0 | `#80C241` | JY | **Stable** | Reference Implementation |
| [Pending] | | | | | | |

### Verification Checklist
- [ ] **Basic Function:** Does the page load without crashing?
- [ ] **Identity:** Is the header color and line code correct?
- [ ] **L2 Marquee:** Does the status border color match the brand? (Currently inherits, check `NodeDetailCard`)
- [ ] **L3 Facilities:** Do the hover effects use the brand color?
- [ ] **Responsive:** Check on Mobile (375px) and Desktop (1440px).

## 3. Architecture Reference
- **L1 (Identity):** `NodeDetailCard` Header (Configurable via `StationIdentity`)
- **L2 (Live Status):** `L2StatusMarquee` & Status Bar (Data-driven)
- **L3 (Facilities):** Grid Layout (Japanese Station Style)
- **L4 (Strategy):** AI Agent & Action Cards (Centralized)
