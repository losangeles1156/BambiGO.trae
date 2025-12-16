# BambiGO 技術選型說明 (Tech Stack)
# 版本：v2.0
# 原則：簡單、模組化、可擴展

---

## 🎯 本文件的使用方式

> **重要提醒給 AI 開發代理：**
> 
> 技術選型的目的是「解決問題」，不是「用最新技術」。
> 
> 每個選擇都有「為什麼」，你應該：
> 1. 理解選擇的原因
> 2. 遇到新需求時，用同樣的思維做決策
> 3. 如果有更好的選擇，可以建議（但要說明原因）

---

## 1. 技術選型總覽

| 層級 | 選擇 | 為什麼 |
|------|------|--------|
| **前端** | Next.js 14 (App Router) | PWA 支援、SSR、API Routes 整合 |
| **樣式** | Tailwind CSS | AI 工具熟悉、快速迭代 |
| **地圖** | Leaflet + OSM | 免費、簡潔、易自訂 |
| **資料庫** | Supabase | 免費額度、PostGIS、即時訂閱 |
| **自動化** | n8n | 視覺化流程、可自建 |
| **AI** | Dify + Gemini | 知識庫管理、成本可控 |
| **部署** | Zeabur | 支援 n8n、一鍵部署 |

---

## 2. 前端：Next.js 14

### 為什麼選 Next.js？

| 需求 | Next.js 如何滿足 |
|------|-----------------|
| PWA | `next-pwa` 套件一鍵配置 |
| SEO | SSR/SSG 支援 |
| API | API Routes 不需要額外後端 |
| 效能 | 自動優化、Code Splitting |

### Design Rationale
```
為什麼不用純 React？
- PWA 配置複雜
- 需要另外建 API 伺服器
- 部署設定麻煩

為什麼不用 Vue/Svelte？
- AI 開發工具對 React 最熟悉
- 生態系最完整
- 找資源最容易
```

### 專案結構（模組化設計）

```
src/
├── app/                      # Next.js App Router
│   ├── layout.tsx
│   ├── page.tsx
│   └── api/
│       ├── chat/route.ts
│       └── nodes/route.ts
│
├── components/               # UI 組件
│   ├── map/                  # 地圖相關
│   │   ├── MapContainer.tsx
│   │   ├── NodeMarker.tsx
│   │   └── ZoneOverlay.tsx   # 圈層視覺化
│   ├── ui/                   # 通用 UI
│   │   ├── BottomSheet.tsx
│   │   ├── ActionCard.tsx
│   │   └── StatusPill.tsx
│   └── chat/                 # 對話相關
│       ├── ChatWindow.tsx
│       └── Message.tsx
│
├── lib/                      # 核心邏輯（模組化）
│   ├── adapters/             # City Adapter
│   │   ├── types.ts          # 介面定義
│   │   ├── tokyo.ts          # 東京設定
│   │   └── index.ts          # Adapter Registry
│   ├── zones/                # 圈層邏輯
│   │   ├── detector.ts       # 圈層判定
│   │   └── fallback.ts       # 降級處理
│   ├── nodes/                # 節點邏輯
│   │   ├── types.ts
│   │   └── inheritance.ts    # Hub/Spoke 繼承
│   ├── supabase.ts           # DB Client
│   └── i18n.ts               # 多語系
│
├── stores/                   # 狀態管理
│   └── appStore.ts
│
└── types/                    # TypeScript 型別
    ├── database.ts           # Supabase 生成
    └── api.ts
```

### 模組化原則

```typescript
// 每個模組都是獨立的，透過介面溝通

// lib/adapters/types.ts - 定義介面
export interface CityAdapter {
  id: string;
  name: LocalizedText;
  bounds: BoundingBox;
  features: FeatureFlags;
  dataSources: DataSourceConfig;
}

// lib/adapters/tokyo.ts - 實作
export const tokyoAdapter: CityAdapter = {
  id: 'tokyo_core',
  // ...
};

// lib/adapters/index.ts - 註冊表
const adapters: Record<string, CityAdapter> = {
  tokyo_core: tokyoAdapter,
  // 未來：osaka, kyoto, taipei...
};

export function getAdapter(cityId: string): CityAdapter | null {
  return adapters[cityId] || null;
}
```

### Design Rationale
```
為什麼要模組化？
- 新增城市 = 新增一個 adapter 檔案
- 新增功能 = 新增一個模組
- 不需要修改現有程式碼

模組的判斷標準：
- 這個功能會不會「重複」？
- 這個功能會不會「擴展」？
- 如果是，就應該模組化
```

---

## 3. 地圖：Leaflet + OpenStreetMap

### 為什麼不用 Mapbox？

| 比較 | Mapbox | Leaflet + OSM |
|------|--------|---------------|
| 費用 | 超過免費額度付費 | 完全免費 |
| 樣式 | 華麗但複雜 | 簡潔可控 |
| 學習曲線 | 陡峭 | 平緩 |
| 離線支援 | 需額外設定 | 容易實現 |

### 地圖樣式設定

```typescript
// lib/map/tileProviders.ts

export const TILE_PROVIDERS = {
  // 簡潔淺色（預設）- 適合疊加節點
  light: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OSM &copy; CARTO'
  },
  
  // 極簡版（無標籤）- 節點更突出
  minimal: {
    url: 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OSM &copy; CARTO'
  },
  
  // 深色模式
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OSM &copy; CARTO'
  }
};
```

### 節點標記樣式（根據圈層）

```typescript
// components/map/NodeMarker.tsx

export function createNodeIcon(
  node: Node,
  zone: 'core' | 'buffer'
): L.DivIcon {
  
  if (zone === 'core') {
    // 核心圈：大圖示、彩色、顯示狀態
    return L.divIcon({
      className: 'node-marker-core',
      html: `
        <div class="marker-icon ${node.is_hub ? 'hub' : 'spoke'}">
          ${NODE_ICONS[node.type]}
        </div>
        <div class="marker-label">${node.name[locale]}</div>
        ${node.status ? `<div class="marker-status">${node.status}</div>` : ''}
      `,
      iconSize: [48, 60]
    });
  }
  
  // 緩衝圈：小圓點、灰色
  return L.divIcon({
    className: 'node-marker-buffer',
    html: `<div class="marker-dot"></div>`,
    iconSize: [12, 12]
  });
}
```

---

## 4. 資料庫：Supabase

### 為什麼選 Supabase？

| 需求 | Supabase 如何滿足 |
|------|------------------|
| 地理查詢 | PostGIS 內建 |
| 即時更新 | Realtime Subscriptions |
| 認證 | Auth 整合（LINE 可用 Custom Provider）|
| 免費額度 | 500MB 儲存、2GB 傳輸 |

### Client 設定

```typescript
// lib/supabase.ts

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// 前端用（有 RLS 限制）
export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 後端用（繞過 RLS）
export const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);
```

### 地理查詢範例

```typescript
// 查詢用戶位置周邊 1km 的節點

async function getNearbyNodes(lat: number, lon: number, radiusKm: number = 1) {
  const { data, error } = await supabase
    .rpc('nearby_nodes', {
      user_lat: lat,
      user_lon: lon,
      radius_meters: radiusKm * 1000
    });
  
  return data;
}

// Supabase SQL Function
/*
CREATE OR REPLACE FUNCTION nearby_nodes(
  user_lat float,
  user_lon float,
  radius_meters int
)
RETURNS SETOF nodes AS $$
  SELECT *
  FROM nodes
  WHERE ST_DWithin(
    location::geography,
    ST_SetSRID(ST_MakePoint(user_lon, user_lat), 4326)::geography,
    radius_meters
  )
  ORDER BY location <-> ST_SetSRID(ST_MakePoint(user_lon, user_lat), 4326)
$$ LANGUAGE sql;
*/
```

---

## 5. 狀態管理：Zustand

### 為什麼選 Zustand？

| 比較 | Redux | Zustand |
|------|-------|---------|
| 程式碼量 | 多 | 少 |
| 學習曲線 | 陡 | 平 |
| TypeScript | 需要額外設定 | 原生支援 |
| AI 工具熟悉度 | 高 | 高 |

### Store 設計

```typescript
// stores/appStore.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  // 當前狀態
  currentNodeId: string | null;
  currentZone: 'core' | 'buffer' | 'outer';
  sheetState: 'collapsed' | 'half' | 'expanded';
  isChatOpen: boolean;
  
  // 用戶偏好（持久化）
  locale: 'zh-TW' | 'ja' | 'en';
  accessibilityMode: boolean;
  
  // Actions
  setCurrentNode: (id: string | null) => void;
  setZone: (zone: 'core' | 'buffer' | 'outer') => void;
  setSheetState: (state: 'collapsed' | 'half' | 'expanded') => void;
  toggleChat: () => void;
  setLocale: (locale: 'zh-TW' | 'ja' | 'en') => void;
  toggleAccessibility: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // 初始值
      currentNodeId: null,
      currentZone: 'core',
      sheetState: 'collapsed',
      isChatOpen: false,
      locale: 'zh-TW',
      accessibilityMode: false,
      
      // Actions
      setCurrentNode: (id) => set({ currentNodeId: id }),
      setZone: (zone) => set({ currentZone: zone }),
      setSheetState: (state) => set({ sheetState: state }),
      toggleChat: () => set((s) => ({ isChatOpen: !s.isChatOpen })),
      setLocale: (locale) => set({ locale }),
      toggleAccessibility: () => set((s) => ({ 
        accessibilityMode: !s.accessibilityMode 
      }))
    }),
    {
      name: 'bambigo-storage',
      partialize: (state) => ({ 
        locale: state.locale,
        accessibilityMode: state.accessibilityMode
      })
    }
  )
);
```

---

## 6. 圈層判定模組

### 核心邏輯

```typescript
// lib/zones/detector.ts

type Zone = 'core' | 'buffer' | 'outer';

interface ZoneConfig {
  coreBounds: BoundingBox;
  bufferRadius: number;  // 公里
}

export class ZoneDetector {
  private config: ZoneConfig;
  private nodeCache: Map<string, Node> = new Map();
  
  constructor(config: ZoneConfig) {
    this.config = config;
  }
  
  async detectZone(lat: number, lon: number): Promise<Zone> {
    // 1. 檢查是否在核心圈
    if (this.isInCoreBounds(lat, lon)) {
      return 'core';
    }
    
    // 2. 檢查是否有 ODPT 數據覆蓋
    const nearestStation = await this.findNearestOdptStation(lat, lon);
    if (nearestStation && nearestStation.distance < this.config.bufferRadius * 1000) {
      return 'buffer';
    }
    
    // 3. 其他都是外部圈
    return 'outer';
  }
  
  private isInCoreBounds(lat: number, lon: number): boolean {
    const { sw, ne } = this.config.coreBounds;
    return lat >= sw[0] && lat <= ne[0] && lon >= sw[1] && lon <= ne[1];
  }
  
  private async findNearestOdptStation(lat: number, lon: number) {
    // 查詢 Supabase
    const { data } = await supabase
      .rpc('nearest_station', { user_lat: lat, user_lon: lon });
    return data?.[0];
  }
}

// 使用
const detector = new ZoneDetector({
  coreBounds: { sw: [35.65, 139.73], ne: [35.74, 139.82] },
  bufferRadius: 5  // 5km
});

const zone = await detector.detectZone(userLat, userLon);
```

---

## 7. PWA 設定

### next-pwa 配置

```javascript
// next.config.js

const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      // 快取 OSM Tiles（離線地圖）
      urlPattern: /^https:\/\/.*\.basemaps\.cartocdn\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'map-tiles',
        expiration: {
          maxEntries: 500,
          maxAgeSeconds: 60 * 60 * 24 * 30 // 30 天
        }
      }
    }
  ]
});

module.exports = withPWA({
  // Next.js config
});
```

### Manifest

```json
// public/manifest.json
{
  "name": "BambiGO - 城市感性導航",
  "short_name": "BambiGO",
  "description": "將開放數據轉譯為具備同理心的行動建議",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#FFFFFF",
  "theme_color": "#6366F1",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

---

## 8. 環境變數

```env
# .env.local

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_KEY=xxx

# ODPT API
ODPT_API_KEY=xxx
ODPT_CHALLENGE_KEY=xxx

# Dify
DIFY_BASE_URL=https://api.dify.ai/v1
DIFY_API_KEY=xxx

# LINE (Phase 3)
LINE_CHANNEL_ACCESS_TOKEN=xxx
LINE_CHANNEL_SECRET=xxx
```

---

## 9. 開發指令

### 給 Trae 的初始化指令

```
請根據 TECH_STACK.md 初始化 BambiGO 專案：

1. 使用 create-next-app 建立 Next.js 14 專案 (App Router, TypeScript)
2. 安裝核心依賴：
   - tailwindcss
   - react-leaflet + leaflet + @types/leaflet
   - @supabase/supabase-js
   - zustand
   - next-pwa
   - next-intl
3. 建立模組化目錄結構（參考 TECH_STACK.md）
4. 設定 Tailwind CSS
5. 設定 PWA
6. 建立 Supabase Client
7. 建立 Zustand Store
8. 建立 ZoneDetector 模組

先完成初始化，確認 npm run dev 可正常啟動。
```

---

*本文件定義技術選型，應與其他規格文件配合使用。*
