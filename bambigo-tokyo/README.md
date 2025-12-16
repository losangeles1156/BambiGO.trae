# 🦌 BambiGO - 城市感性導航服務

> 將冷冰冰的開放數據轉譯為具備同理心的行動建議

---

## 這是什麼？

**BambiGO** 是一個基於 PWA 的城市導航服務，專為解決旅客在陌生城市中的「移動焦慮」而設計。

我們不只提供導航，而是成為**「焦慮解法的中介 (Broker of Anxiety Relief)」**：

| 焦慮情境 | BambiGO 的解法 |
|---------|---------------|
| 電車延誤了，怎麼辦？ | 一鍵叫車 (GO Taxi) 或騎共享單車 (LUUP) |
| 找不到置物櫃放行李 | 導引至 Ecbo Cloak 寄存服務 |
| 觀光景點人擠人 | AI 推薦附近的隱藏秘境 |
| 不知道該搭什麼車 | 單一最佳建議，消除決策癱瘓 |

---

## 東京 MVP 範圍

### 驗證場域（Phase 1 鎖定）

| 區域 | 範圍 | 核心節點 |
|------|------|---------|
| **台東區** | 上野、淺草 | 上野站、淺草站、御徒町站 |
| **千代田區** | 東京車站、皇居 | 東京站、秋葉原站、神田站 |
| **中央區** | 銀座、日本橋 | 銀座站、日本橋站 |

### 地理圍欄 (Bounding Box)

```
西南角：[139.73, 35.65]
東北角：[139.82, 35.74]
```

### 數據來源優先順序

1. **ODPT API**（優先）：JR東日本、東京Metro、都營地鐵/巴士
2. **OSM Overpass API**（次要）：廁所、置物櫃、觀光景點
3. **GBFS API**（Phase 3）：Docomo Cycle、LUUP 共享運具

---

## 開發階段 (Three Phases)

### 🔷 Phase 1：骨幹建置（目前重點）

**目標：** 建立資料庫與地圖基礎

| 任務 | 說明 | 狀態 |
|------|------|------|
| Supabase Migration | 執行 `db_schema.md` 中的 8 張表 | ⬜ 待開發 |
| City Adapter | `lib/adapters/tokyo.ts` 東京設定 | ⬜ 待開發 |
| Hub 節點定義 | 10-15 個核心樞紐 + Persona Prompt | ⬜ 待開發 |
| 地圖渲染 | Next.js + Mapbox/Leaflet 分層顯示 | ⬜ 待開發 |
| ODPT 數據匯入 | n8n Workflow 自動抓取站點 | ⬜ 待開發 |

**產出：** 可顯示東京核心三區車站的基礎地圖

---

### 🔷 Phase 2：感知與細節

**目標：** 接入即時數據與 L3 設施

| 任務 | 說明 |
|------|------|
| L2 即時狀態 | GTFS-RT 運行異常、巴士位置 |
| L3 設施抓取 | OSM 廁所、置物櫃、便利商店 |
| 供給/適用標籤 | `has_locker`, `good_for_waiting` 雙層結構 |
| 無障礙資訊 | 整合車站 Barrier-Free Map |

**產出：** 點擊車站可顯示即時狀態與周邊設施

---

### 🔷 Phase 3：決策與神經

**目標：** AI 建議與商業導流

| 任務 | 說明 |
|------|------|
| Dify RAG | 觀光知識庫對接 |
| L4 Action Cards | 三張卡片 UI（大眾運輸/計程車/共享運具）|
| Deep Links | GO Taxi, LUUP, Ecbo Cloak 導流 |
| Trip Guard | LINE 推播異常通知 |
| PWA Manifest | 可安裝至手機主畫面 |

**產出：** 完整的 MVP 可演示版本

---

## 📌 給 Trae SOLO 的指令

### 請先執行 Phase 1

```
請根據以下文件執行 Phase 1 骨幹建置：

1. 讀取 `.trae/rules/project_rules.md` 了解專案規範
2. 讀取 `.trae/rules/db_schema.md` 生成 Supabase Migration
3. 建立 Next.js PWA 專案結構
4. 實作 City Adapter 介面 (lib/adapters/tokyo.ts)
5. 建立 Hub/Spoke 節點的繼承邏輯

技術要求：
- 資料庫：Supabase (PostgreSQL + PostGIS)
- 前端：Next.js 14+ App Router
- 語系：預設繁體中文，支援日文/英文切換
- 所有多語系欄位使用 JSONB 結構

請先生成任務計畫，確認後再執行。
```

---

## 專案結構

```
bambigo-tokyo/
├── .trae/
│   └── rules/
│       ├── project_rules.md      # 專案規範（Prime Directive）
│       └── db_schema.md          # 資料庫規格
├── data/
│   └── odpt_data_sources.csv     # ODPT 數據源清單
├── docs/
│   ├── ARCHITECTURE.md           # 技術架構文件
│   └── API_REFERENCE.md          # API 文件
├── lib/
│   ├── adapters/
│   │   └── tokyo.ts              # City Adapter
│   ├── db/
│   │   └── queries.ts            # 資料庫查詢函數
│   └── utils/
│       └── i18n.ts               # 多語系工具
├── supabase/
│   └── migrations/               # 資料庫遷移檔
├── src/
│   ├── app/                      # Next.js App Router
│   ├── components/               # React 組件
│   └── hooks/                    # Custom Hooks
├── public/
│   └── manifest.json             # PWA Manifest
├── README.md                     # 本文件
└── package.json
```

---

## 核心概念

### 四層標籤化數據模型

| 層級 | 名稱 | 內容 | 更新頻率 |
|------|------|------|---------|
| **L1** | 地點基因 (Location DNA) | 站點、景點、Hub/Spoke 繼承 | 靜態 |
| **L2** | 即時狀態 (Live Status) | 運行異常、擁擠度 | TTL 20 分鐘 |
| **L3** | 環境機能 (Micro-Facilities) | 廁所、置物櫃、適用標籤 | 每日更新 |
| **L4** | 行動策略 (Mobility Strategy) | AI 生成的 Action Cards | 即時 |

### Hub/Spoke 繼承架構

- **Hub（母節點）**：10-15 個核心樞紐，手工撰寫 Persona Prompt
- **Spoke（子節點）**：數百個普通站點，自動繼承最近 Hub 的人格

### 一個建議原則 (One Recommendation)

AI 輸出收斂為：
1. **Primary Card**：系統推薦的最佳選項
2. **Secondary Cards**：最多 2 張替代方案

---

## 環境變數

```env
# ODPT API
ODPT_API_KEY=your_odpt_api_key

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Dify (Phase 3)
DIFY_API_KEY=your_dify_api_key
DIFY_BASE_URL=https://api.dify.ai/v1

# LINE (Phase 3)
LINE_CHANNEL_ACCESS_TOKEN=your_line_token
LINE_CHANNEL_SECRET=your_line_secret
```

---

## 參考資料

- [ODPT 開發者網站](https://developer.odpt.org/)
- [日本公共交通開放數據挑戰賽 2025](https://challenge.odpt.org/)
- [GBFS 規格](https://gbfs.org/)
- [Supabase 文件](https://supabase.com/docs)
- [Dify 文件](https://docs.dify.ai/)

---

## 授權

本專案為 [日本公共交通開放數據挑戰賽 2025](https://challenge.odpt.org/) 參賽作品。

數據使用遵循 ODPT 公共交通開放數據基本授權條款。

---

*最後更新：2025-12-14*
