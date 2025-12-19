# AI Architecture & Data Flow

## 1. Overview
The BambiGO AI Assistant utilizes a **Streaming-First Architecture** to provide low-latency, context-aware responses. The system has been refactored (v2.1) to strictly enforce real data sources, removing all legacy mock/dummy data paths.

## 2. Component Architecture

### Frontend (`FullScreenAssistant.tsx`)
- **State Management**: React `useState` & `useRef` for message history and stream lifecycle.
- **Protocol**: Server-Sent Events (SSE) via `EventSource`.
- **UI/UX**: 
  - Quick Action Chips (`QuickQuestions`) for one-tap intent (Home, Shop, Access).
  - Auto-scroll with `scrollIntoView`.
  - Graceful error handling for stream interruptions.

### Backend (`/api/assistant/route.ts`)
The Next.js Route Handler acts as an **Edge Gateway** between the Client and AI Providers.

**Flow:**
1.  **Request Validation**: Checks for `q` (query) and rate limits (IP-based).
2.  **Context Injection**: Fetches `nodeId` context from Supabase (Persona, Local Knowledge, Trap Alerts).
3.  **Provider Routing**:
    *   **Dify**: Direct SSE streaming proxy. Maintains `conversation_id`.
    *   **N8N**: Webhook trigger for complex workflows (Weather, Alerts).
    *   **Fallback**: Returns structured JSON for tool/rule-based responses (e.g., "Where is the toilet?").
4.  **Security**: 
    *   No mock data permitted.
    *   API Keys managed via server-side ENV.

## 3. Data Integration

### Dify Integration
- **Endpoint**: `/v1/chat-messages`
- **Mode**: `streaming`
- **Inputs**: `context` (System prompt + Node metadata).
- **Output**: Streamed chunks `data: { event: "message", answer: "..." }`.

### N8N Integration
- **Endpoint**: Webhook URL.
- **Payload**: `{ query, nodeId, context, trapAlerts, workflowId }`.
- **Response**: JSON structure compatible with UI Cards (L4 Strategy).

## 4. Configuration (Environment Variables)
The system requires the following keys in `.env` (not committed to repo):

```ini
# Core Provider Selection
AI_PROVIDER=dify  # Options: dify, n8n

# Dify Credentials
DIFY_API_KEY=sk-...
DIFY_BASE_URL=https://api.dify.ai/v1

# N8N Credentials
N8N_WEBHOOK_URL=https://...
N8N_API_KEY=...    # Optional: X-N8N-API-KEY header
N8N_WORKFLOW_ID=... # Optional: Passed in payload
```

## 5. Quality Assurance
- **Type Safety**: Full TypeScript coverage for all API responses and Component Props.
- **Testing**: 
  - **Unit**: Vitest coverage for Rate Limiting, Provider Configuration, and Stream Headers.
  - **E2E**: Playwright tests for UI flow (Open -> Quick Question -> Response).

---
*Last Updated: 2025-12-19 by Matrix (CTO)*
