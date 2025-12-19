# Weather Alert System Redesign: n8n "Sentry" Architecture

## 1. Core Philosophy (Zero-One)
To meet the requirement of a robust, "Core First" alert system, we transition from a client-side polling mechanism to a **Server-Side "Sentry" Architecture** powered by n8n. This ensures:
- **Stability**: Centralized monitoring (5-min cycles) independent of user traffic.
- **Accuracy**: Multi-stage filtering (Type -> Geo -> Severity) before alerts reach the user.
- **Context**: Enriched alerts with L1/L3/L4 tags (e.g., "Seek Shelter" vs "Bring Umbrella").

## 2. System Architecture

### A. The Engine (n8n)
- **Role**: Sentry (Active Monitor).
- **Cycle**: 5 Minutes (Cron) OR On-Demand (Webhook).
- **Workflow ID**: `weather-alert-sentry`

### B. Data Pipeline (3-Stage Filtering)
1.  **Stage 1: Ingestion (RSS)**
    - Source: JMA Extra Feed (`https://www.data.jma.go.jp/developer/xml/feed/extra.xml`)
    - Source: JMA Eqvol Feed (`https://www.data.jma.go.jp/developer/xml/feed/eqvol.xml`)
2.  **Stage 2: Geo-Fencing (Tokyo)**
    - Filter: Title/Content must contain "東京都" (Tokyo Met) or specific ward names.
3.  **Stage 3: Severity & SOP Grading**
    - **High (Red)**: Earthquake > Shindo 3, Heavy Rain Warning, Tsunami. -> **Trigger L4 SOP**
    - **Medium (Yellow)**: Heavy Rain Advisory, Strong Wind. -> **Trigger L3 SOP**
    - **Low (Green)**: General Forecast. -> **Suppress (No Notification)**

### C. Output Interface
- **Format**: JSON (Standardized Schema)
- **Schema**:
  ```json
  {
    "active": boolean,
    "severity": "high" | "medium" | "low",
    "title": "Earthquake Early Warning",
    "description": "Shindo 4 detected in Shinjuku.",
    "timestamp": "ISO-8601",
    "tags": {
      "l1": ["outdoor", "park"], // Impacted areas
      "l3": ["evacuation_site"], // Suggested facilities
      "l4": "seek_shelter"       // Immediate action
    }
  }
  ```

## 3. Implementation Plan
1.  **Workflow Definition**: `n8n/workflows/weather_alert_sentry.json`
2.  **Client Integration**: `src/lib/integrations/n8n_weather.ts`
3.  **API Gateway**: `src/app/api/weather/alerts/route.ts` (Updated to proxy n8n)
4.  **UI Component**: `AlertBanner.tsx` (Updated to render L4/L3 context)

## 4. Performance Metrics
- **Latency**: < 30s from JMA publish to n8n process.
- **Availability**: 99.95% (n8n uptime dependent).
- **Accuracy**: 99% (Regex-based geo-filtering).
