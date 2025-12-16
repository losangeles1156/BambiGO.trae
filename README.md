# BambiGO / TAG City

BambiGO is a PWA designed for urban exploration, combining a map interface with an AI assistant to help users discover facilities and navigate the city.

## 🚀 Project Overview

- **Core Functionality**: Interactive Map (MapLibre), AI Assistant (Dify), Real-time Facility Data (Supabase/ODPT).
- **Target Area**: Tokyo (with concentric zone strategy: Core, Buffer, Outer).

## 🛠 Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19
- **Styling**: Tailwind CSS 4
- **Map**: MapLibre GL JS
- **Backend/Database**: Supabase (PostgreSQL)
- **AI Integration**: Dify API
- **Language**: TypeScript

## 🏁 Getting Started

### 1. Installation

Navigate to the web application directory and install dependencies:

```bash
cd bambigo-web
npm install
```

### 2. Environment Setup

Create a `.env.local` file in the `bambigo-web` directory (or root depending on your setup) based on the provided `.env.example`.

**Required Keys:**
- `DIFY_API_URL`: URL for the Dify AI Agent API.
- `DIFY_API_KEY`: API Key for Dify.
- `SUPABASE_URL`: Supabase project URL.
- `SUPABASE_ANON_KEY`: Supabase anonymous public key.

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 📂 Project Structure

- `bambigo-web/`: Main Next.js application.
  - `src/app/`: App router pages and API routes.
  - `src/components/`: Reusable UI components.
  - `src/lib/`: Utilities, adapters, and schema definitions.
- `bambigo-tokyo/`: Tokyo specific data and rules.
- `bambigo-v2.1/`: Version 2.1 specific documentation and assets.

## 📜 Scripts

- `npm run dev`: Start dev server.
- `npm run lint`: Run ESLint.
- `npm run typecheck`: Run TypeScript compiler check.
- `npm run test`: Run Vitest tests.
