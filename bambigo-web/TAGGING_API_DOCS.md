# BambiGO Tagging System - API & Architecture Documentation

## 1. System Architecture

The Tagging System follows a layered architecture integrating Frontend Components, Next.js API Routes, and a Supabase (PostgreSQL) backend.

```mermaid
graph TD
    Client[Client Browser]
    
    subgraph Frontend
        TS[TaggingService (src/lib/api/tagging.ts)]
        UI[UI Components]
    end
    
    subgraph Backend [Next.js API Routes]
        TagsAPI[GET/POST /api/nodes/:id/tags]
        StratAPI[POST /api/nodes/:id/strategy]
        Logic[StrategyEngine (src/lib/ai/strategy.ts)]
    end
    
    subgraph Database [Supabase PostgreSQL]
        DB[(facilities table)]
    end
    
    UI --> TS
    TS --> TagsAPI
    TS --> StratAPI
    
    TagsAPI --> DB
    StratAPI --> Logic
    Logic --> DB
```

## 2. Data Model Implementation

To simplify the schema while maintaining flexibility, we utilize the `facilities` table for both **L1 (Life Functions)** and **L3 (Service Facilities)**.

### Table: `facilities`

| Column | Type | Usage for L1 | Usage for L3 |
|Data Field| PostgreSQL Type | L1 Mapping | L3 Mapping |
|---|---|---|---|
| `id` | `uuid` | Unique Tag ID | Unique Facility ID |
| `node_id` | `text` | Associated Node | Associated Node |
| `type` | `text` | `mainCategory` (e.g. 'dining') | `category` (e.g. 'wifi') |
| `name` | `jsonb` | `name` (Localized) | `provider.name` |
| `attributes` | `jsonb` | Stores `subCategory`, `brand` | Stores `subCategory`, `provider`, etc. |
| `floor` | `text` | - | Location Floor |
| `direction` | `text` | Direction from Hub | Direction from Hub |

## 3. API Endpoints

### 3.1 Manage Tags
**Endpoint**: `/api/nodes/[nodeId]/tags`

- **GET**: Retrieve all L1 and L3 tags for a node.
  - Response: `{ l1: L1Tag[], l3: L3ServiceFacility[] }`
  
- **POST**: Add a new tag/facility.
  - Body: `{ layer: 'L1' | 'L3', data: TagData }`
  - Returns: Created Object (DB Row)

- **DELETE**: Remove a tag.
  - Query Param: `?id=[TagID]`
  - Returns: `{ success: true }`

### 3.2 Generate Strategy (L4)
**Endpoint**: `/api/nodes/[nodeId]/strategy`

- **POST**: Generate a context-aware action strategy.
  - Body: `{ weather: string, time: string }`
  - Logic: Uses `StrategyEngine` (Rule-based AI) to analyze existing tags + context.
  - Returns: `L4ActionCard`

## 4. Development & Testing

- **Unit Tests**: `tests/tagging_logic.spec.ts` covers the L4 Strategy Engine logic.
- **Compliance Tests**: `tests/tagging_compliance.spec.ts` ensures constants match design specs.
- **Integration**: The frontend `TaggingSystemDemo` page uses `TaggingService` which now connects to these live endpoints.

## 5. Future Optimizations

- **Caching**: Implement Redis or Vercel KV for Strategy Generation results.
- **Vector Search**: Move L4 Strategy from Rule-based to Vector-based (RAG) using `pgvector` on descriptions.
- **Batch Operations**: Add bulk import/export for tags.
