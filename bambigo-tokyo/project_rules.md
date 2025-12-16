# BambiGO Tokyo MVP - Project Rules
# 版本：v4.0 (對應技術架構規格書)
# 用途：Trae SOLO 開發指引

---

## 1. 產品定義

BambiGO 是一個基於 PWA 的**城市感性導航服務**。

核心價值：將冷冰冰的開放數據（ODPT, GTFS, OSM）轉譯為具備同理心的行動建議 (Nudge)，解決交通空白與過度旅遊等社會課題。

我們不只提供導航，而是成為「焦慮解法的中介 (Broker of Anxiety Relief)」。

---

## 2. 最高指導原則 (Prime Directive)

### 2.1 Guest-First（訪客優先）
- 90% 的功能必須在**免登入、免註冊**的情況下可用
- 可用功能：地圖、查詢、AI 對話、商業導流
- 註冊僅用於「Trip Guard 行程守護」推播功能

### 2.2 Commercial Reality（商業現實）
- L4 行動建議必須優先考量「可執行的替代方案」
- 若公車擁擠，直接提供 Uber/GO 或 LUUP 的 Deep Link
- 商業導流是 MVP 的核心變現邏輯

### 2.3 Inheritance Efficiency（繼承效率）
- 嚴守 **10-15 個 Hub 母節點**限制
- 所有子節點 (Spoke) 透過演算法繼承母節點人格
- 確保 MVP 開發資源聚焦

### 2.4 動態擴充原則
- 文檔中的地點（上野、淺草）僅為 MVP 驗證範例
- 系統架構必須支援動態新增任何符合地理圍欄內的節點

### 2.5 一個建議原則 (One Recommendation)
- AI 輸出必須收斂為「單一最佳建議」(Primary Card)
- 消除使用者的決策癱瘓
- 其餘最多 2 張為 Secondary Cards（替代或體驗選項）

### 2.6 多語言與國際化策略（重要）
- **繁體中文 (zh-TW)** 為預設系統語系
- 必須支援 **英文 (en)** 與 **日文 (ja)** 的 UI 切換
- 其他語系可透過 AI 自然對話輸入獲得回應
- 資料庫所有顯示文字欄位採用 JSONB 多語系結構

```json
// 多語系欄位範例
{
  "name": {
    "zh-TW": "上野站",
    "ja": "上野駅", 
    "en": "Ueno Station"
  }
}
```

---

## 3. 要解決的社會課題

1. **過度旅遊 (Overtourism)**：數據驅動的識別與分流
2. **資訊斷層導致的決策癱瘓**：
   - 決策癱瘓、等待焦慮、異常焦慮
   - 資源焦慮、抵達焦慮
3. **多模式整合的缺失**：使用者需要切換多個 App

---

## 4. 技術架構 (Tech Stack)

### 4.1 智能核心
- **Reasoning Engine**: Google Gemini 3 Pro（透過 Dify 調用）
- **Orchestration**: Dify (RAG Engine) - 管理 Prompt 與觀光知識庫
- **開發核心**: Trae SOLO Mode

### 4.2 自動化與數據層
- **ETL Pipeline**: n8n (Self-Hosted on Zeabur)
- **Database**: Supabase (PostgreSQL)
- **Cache**: Supabase Table 或 KV（MVP 階段），未來可切換 Redis

### 4.3 前端互動層
- **Platform**: Next.js PWA（可安裝至手機主畫面，離線支援）
- **User State**:
  - Guest（訪客）：不強制授權 GPS，可手動選擇節點
  - Member（會員）：GPS 追蹤 + LINE Login，啟用 Trip Guard

---

## 5. 驗證場域定義 (The Sandbox)

### 5.1 地理圍欄 (Geo-fence)
- **核心區**：台東區（上野/淺草）、千代田區（東京車站/皇居）、中央區（銀座）
- **Bounding Box**: `[139.73, 35.65]` 至 `[139.82, 35.74]`
- 系統設計為更改 Bounding Box 參數即可切換至其他區域

### 5.2 數據獲取策略
採用 **「ODPT First, OSM Second」** 策略：

1. **Phase 1 (骨幹)**: ODPT API → JR東日本、東京Metro、都營地鐵/巴士站點
2. **Phase 2 (肌肉)**: Overpass API (OSM) → toilets, attractions, lockers
3. **Phase 3 (神經)**: GBFS API → Docomo Cycle / LUUP 微型移動站點

---

## 6. 四層標籤化數據模型

### L1：地點基因層 (Location DNA) - 骨架
- **定義**：節點的靜態屬性與基礎設施能力
- **數據來源**：ODPT, OSM, MLIT, GBFS
- **母子繼承架構**：
  - Hub（母節點）：10-15 個，手工撰寫 Persona Prompt
  - Spoke（子節點）：數百個，自動繼承最近 Hub 的人格

### L2：即時狀態層 (Live Status) - 感知
- **定義**：影響決策的動態變數
- **數據來源**：ODPT API (TrainInformation, BusLocation), OpenWeather
- **快取策略**：TTL 20 分鐘
- **異常偵測**：delay > 15min 或 status != Normal

### L3：環境機能層 (Micro-Facilities) - 細節
- **定義**：解決旅途中「微需求」的服務設施
- **雙層標籤結構**：
  - **供給標籤 (Supply Tags)**：has_locker, has_bench, has_wifi, has_elevator
  - **適用標籤 (Suitability Tags)**：good_for_waiting, work_friendly, quiet_zone, luggage_friendly

### L4：行動策略層 (Mobility Strategy) - 決策
- **定義**：AI 綜合 L1-L3 生成的最終建議
- **運算核心**：Dify RAG + LLM
- **輸出格式**：Action Cards（最多 3 張）

---

## 7. L4 Action Cards 規格

AI 輸出必須收斂為 3 張卡片：

| 順序 | 類型 | 範例 | 導流目標 |
|------|------|------|----------|
| 1 | 最佳大眾運輸 | "搭銀座線，3 分鐘後發車" | ODPT 數據 |
| 2 | 舒適/快速替代 | "搭 Uber/GO，約 ¥1200，省 10 分鐘" | Taxi 導流 |
| 3 | 微型移動/體驗 | "騎共享滑板車，沿途風景好，約 15 分鐘" | LUUP 導流 |

### Deep Link 整合
- **Taxi**: `https://go.mo-t.com/...` (GO Taxi)
- **Shared Mobility**: `https://luup.sc/...` (LUUP)
- **Locker Service**: `https://cloak.ecbo.io/...` (Ecbo Cloak)

---

## 8. 資料庫設計原則

### 8.1 混合策略
- **核心實體（高頻查詢）**：正規化表格 + 索引
- **擴充屬性（低頻/動態）**：JSONB 欄位
- **即時數據（高頻更新）**：Cache（MVP 用 Supabase KV）

### 8.2 多語系欄位結構
所有面向使用者的文字欄位必須使用 JSONB：

```sql
name jsonb not null, -- {"zh-TW": "上野站", "ja": "上野駅", "en": "Ueno Station"}
```

### 8.3 核心表格
- `cities`：城市/區域 + City Adapter 設定
- `nodes`：節點主表（Hub/Spoke 繼承）
- `facilities`：L3 設施表
- `facility_suitability`：適用標籤（情境索引）
- `shared_mobility_stations`：GBFS 共享運具
- `users`：用戶（含 LINE 整合）
- `trip_subscriptions`：Trip Guard 訂閱
- `nudge_logs`：意圖日誌（核心商業數據）

---

## 9. 商業變現邏輯

BambiGO 的商業價值在於「焦慮解法的中介」：

1. **移動導流**
   - 情境：電車延誤（焦慮）→ BambiGO 建議 → 點擊叫車
   - 價值：CPA 分潤

2. **空手觀光導流**
   - 情境：找不到置物櫃（焦慮）→ BambiGO 建議 → 預約 Ecbo Cloak
   - 價值：服務手續費分潤

---

## 10. 開發里程碑

### Phase 1：骨幹建置（Current Focus）
- [ ] 設定 Zeabur 環境變數 ODPT_API_KEY
- [ ] 建立 Hub/Spoke 資料庫結構（含 parent_hub_id）
- [ ] n8n 建立 ODPT 自動抓取 Workflow
- [ ] City Adapter 介面實作
- [ ] 地圖分層渲染 (Layering)

### Phase 2：感知與細節
- [ ] 定義 10 個核心 Hub 並撰寫 Persona Prompt
- [ ] 實作 L3 供給/適用雙欄位結構
- [ ] OSM 數據抓取，自動填入 Supply Tags
- [ ] L2 即時狀態顯示

### Phase 3：決策與神經
- [ ] 接入 GBFS 共享運具數據
- [ ] Dify 知識庫對接
- [ ] L4 AI 對話建議功能
- [ ] Trip Guard 自動化流程
- [ ] PWA Manifest 與 Action Cards UI
- [ ] Deep Links 整合

---

## 11. 程式碼規範

### 11.1 命名慣例
- 檔案：kebab-case (`city-adapter.ts`)
- 變數/函數：camelCase (`resolveNodePersona`)
- 常數：UPPER_SNAKE_CASE (`ODPT_API_KEY`)
- 型別/介面：PascalCase (`NodePersona`)

### 11.2 多語系處理
```typescript
// 取得當前語系的名稱
function getLocalizedName(name: JsonB, locale: 'zh-TW' | 'ja' | 'en'): string {
  return name[locale] || name['zh-TW'] || Object.values(name)[0];
}
```

### 11.3 City Adapter 結構
```typescript
// lib/adapters/tokyo.ts
export const tokyoAdapter: CityAdapter = {
  id: 'tokyo_core',
  hasSubway: true,
  hasSharedMobility: true,
  hasBus: true,
  odptOperators: ['TokyoMetro', 'Toei', 'JR-East'],
  gbfsSystems: ['docomo-cycle-tokyo', 'luup'],
  defaultLanguage: 'ja',
  bounds: {
    sw: [139.73, 35.65],
    ne: [139.82, 35.74]
  }
};
```

---

## 12. 環境變數

```env
# ODPT API
ODPT_API_KEY=your_odpt_api_key

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Dify
DIFY_API_KEY=your_dify_api_key
DIFY_BASE_URL=https://api.dify.ai/v1

# LINE (Trip Guard)
LINE_CHANNEL_ACCESS_TOKEN=your_line_token
LINE_CHANNEL_SECRET=your_line_secret
```

---

## 13. 參考文件

- 技術架構規格書 v4.0
- 資料庫設計規格 v4.1
- 日本公共交通開放數據清單 (CSV)
- ODPT API 文件：https://developer.odpt.org/
- GBFS 規格：https://gbfs.org/

---

*本文件為 Trae SOLO 開發的核心規則檔，請放置於 `.trae/rules/project_rules.md`*
