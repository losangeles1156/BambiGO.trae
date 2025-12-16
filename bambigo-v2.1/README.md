# 🦌 BambiGO - 城市感性導航服務

> 將冷冰冰的開放數據轉譯為具備同理心的行動建議

---

## 📦 開發文件 v2.1

本專案包含完整的開發規格，設計給 AI 開發工具（如 Trae SOLO）使用。

### ⚠️ 重要提醒

**這些文件是「指導原則」而非「完整規格」。**

文件中的範例（車站名稱、設施類型）僅用於說明概念，不是開發的全部內容。

AI 開發代理應該：
1. 理解每個設計背後的「為什麼」(Design Rationale)
2. 根據原則自行推演完整實作
3. 保留模組化擴展的彈性

---

## 📁 文件結構

```
bambigo-v2.1/
├── .trae/
│   └── rules/
│       ├── project_rules.md    # 核心規範、同心圓策略、設計原則
│       ├── db_schema.md        # 資料庫結構（含機能輪廓表）
│       ├── UI_SPEC.md          # 介面規格（含降級 UI）
│       ├── DATA_STRATEGY.md    # 數據策略（差異化更新）
│       ├── N8N_WORKFLOWS.md    # 自動化流程（合理頻率）
│       ├── TECH_STACK.md       # 技術選型（模組化設計）
│       └── L1_FACILITY_TAGS.md # L1 生活機能標籤系統 ← v2.1 新增
├── data/
│   └── odpt_data_sources.csv
└── README.md
```

---

## 🆕 v2.1 新增：L1 生活機能標籤

讓節點從「名稱 + 座標」升級為「生活圈畫像」：

```
傳統：上野站 = 名稱 + 座標 + 路線

BambiGO：上野站 = 名稱 + 座標 + 路線 + 
         🛒購物x23 🍜餐飲x18 🎭休閒x8 🏥醫療x5
         #購物天堂 #美食激戰區
```

### 主類別（6 個）

| ID | 名稱 | 圖示 | 說明 |
|----|------|------|------|
| shopping | 購物 | 🛒 | 各類商店 |
| dining | 餐飲 | 🍜 | 餐廳、咖啡廳 |
| medical | 醫療 | 🏥 | 醫院、診所、藥局 |
| education | 教育 | 🎓 | 學校 |
| leisure | 休閒 | 🎭 | 娛樂、觀光 |
| finance | 金融 | 🏦 | 銀行、ATM |

### 分階段實作

| 階段 | 範圍 | 深度 | 工作量 |
|------|------|------|--------|
| **MVP** | Hub 節點 (10-15) | 主類別計數 | 1.5 天 |
| Phase 2 | 全核心圈 (~100) | 主類別 + 次類別 | 3 天 |
| Phase 3 | 擴展區域 | 完整三層 | 數週 |

---

## 🎯 核心概念

### 同心圓數據策略 ⭐

| 圈層 | 範圍 | 數據深度 | 服務能力 |
|------|------|---------|---------|
| **核心圈** | 台東、千代田、中央區 | L1+L2+L3+L4 | 完整 AI 人格、設施搜尋、商業導流 |
| **緩衝圈** | ODPT 覆蓋區域 | L1+L2 | 基本路線查詢、運行狀態 |
| **外部圈** | 其他區域 | 無 | 優雅降級 → Google Maps |

**原則**：服務品質隨距離遞減，但永遠不能「變磚塊」。

### 更新頻率策略

| 類別 | 頻率 | 數據範例 |
|------|------|---------|
| 靜態 | 每季 | 車站位置、路線圖 |
| 半靜態 | 每月 | 設施清單、時刻表 |
| 動態 | 15 分鐘 | 運行狀態、擁擠度 |
| 事件驅動 | 即時 | 異常警報 |

**原則**：差異化更新，只處理「有變化」的數據。

---

## 🚀 開發階段

### Phase 1：骨幹建置

| 任務 | 參考文件 |
|------|---------|
| 初始化 Next.js + 模組化結構 | `TECH_STACK.md` |
| Supabase Migration（含 node_facility_profiles）| `db_schema.md` |
| 圈層判定模組 | `TECH_STACK.md` |
| 地圖 + Bottom Sheet | `UI_SPEC.md` |
| 靜態數據抓取（一次） | `DATA_STRATEGY.md` |
| **Hub 節點機能輪廓計算** | `L1_FACILITY_TAGS.md` | ← v2.1 新增

### Phase 2：感知與設施

| 任務 | 參考文件 |
|------|---------|
| n8n 動態狀態工作流程 | `N8N_WORKFLOWS.md` |
| OSM 設施抓取 | `DATA_STRATEGY.md` |
| L2 狀態顯示 | `UI_SPEC.md` |
| 降級 UI | `UI_SPEC.md` |

### Phase 3：AI 與商業

| 任務 | 參考文件 |
|------|---------|
| AI 對話頁面 | `UI_SPEC.md` |
| Action Cards | `UI_SPEC.md` |
| Trip Guard | `N8N_WORKFLOWS.md` |
| 商業導流 | `project_rules.md` |

---

## 🤖 給 Trae 的指令

### 開始前必讀

```
在開始任何開發之前，請先閱讀 .trae/rules/project_rules.md 的：
1. 設計哲學（理解「為什麼」）
2. 同心圓數據策略（理解服務邊界）
3. 模組化設計原則（理解擴展方式）

這些原則優先於任何細節規格。
```

### Phase 1 指令

```
請根據以下規格初始化 BambiGO 專案：

1. 讀取 TECH_STACK.md，建立模組化專案結構
2. 讀取 db_schema.md，建立 Supabase Migration
3. 實作 ZoneDetector 模組（圈層判定）
4. 實作 CityAdapter 模組（東京設定）
5. 建立首頁 UI（地圖 + Bottom Sheet）

重要提醒：
- 這些是「原則」不是「完整規格」
- 遇到未定義的細節時，依據原則做出合理判斷
- 保持模組化，方便未來擴展
```

---

## 📊 各文件用途

| 文件 | 何時讀取 | 核心內容 |
|------|---------|---------|
| `project_rules.md` | 每次開發前 | 設計哲學、同心圓策略、模組化原則 |
| `db_schema.md` | 建立 Migration | 表結構、索引策略、機能輪廓表 |
| `UI_SPEC.md` | 開發 UI | 頁面結構、降級 UI、組件規格 |
| `DATA_STRATEGY.md` | 串接 API | 更新頻率、差異化更新、數據分類 |
| `N8N_WORKFLOWS.md` | 建立自動化 | 工作流程設計、合理頻率 |
| `TECH_STACK.md` | 初始化專案 | 技術選型、模組結構、圈層邏輯 |
| `L1_FACILITY_TAGS.md` | 實作機能標籤 | 標籤架構、OSM 對應、計算邏輯 |

---

## 🔑 環境變數

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=

# ODPT
ODPT_API_KEY=
ODPT_CHALLENGE_KEY=

# Dify
DIFY_BASE_URL=
DIFY_API_KEY=

# LINE (Phase 3)
LINE_CHANNEL_ACCESS_TOKEN=
LINE_CHANNEL_SECRET=
```

---

## 📚 參考資料

- [ODPT 開發者網站](https://developer.odpt.org/)
- [日本公共交通開放數據挑戰賽 2025](https://challenge.odpt.org/)
- [Supabase 文件](https://supabase.com/docs)
- [Leaflet 文件](https://leafletjs.com/)

---

*版本：v2.1 | 最後更新：2025-12-16*
