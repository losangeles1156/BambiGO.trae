# BambiGO 專案核心規範 (Project Rules)
# 版本：v5.0
# 用途：Trae SOLO 開發的最高指導原則

---

## 🎯 本文件的使用方式

> **重要提醒給 AI 開發代理：**
> 
> 本文件是「指導原則」而非「完整規格」。文件中的範例（如車站名稱、設施類型）
> 僅用於說明概念，**不是開發的全部內容**。
> 
> 你應該：
> 1. 理解每個設計背後的「為什麼」(Design Rationale)
> 2. 根據原則自行推演出完整實作
> 3. 保留模組化擴展的彈性
> 4. 遇到文件未涵蓋的情況時，依據原則做出合理判斷

---

## 1. 產品定義

BambiGO 是一個基於 PWA 的**城市感性導航服務**。

### 核心價值
將冷冰冰的開放數據（ODPT, GTFS, OSM）轉譯為具備同理心的行動建議 (Nudge)，
解決交通空白與過度旅遊等社會課題。

### 我們的角色
**「焦慮解法的中介 (Broker of Anxiety Relief)」**

不只是告訴用戶「怎麼走」，而是在他們焦慮時提供「最好的下一步」。

### Design Rationale（為什麼這樣定位）
```
傳統導航 App 的問題：
- 提供太多選項 → 決策癱瘓
- 只給路線，不給建議 → 用戶仍然焦慮
- 異常時只顯示「延誤」→ 沒有解決方案

BambiGO 的差異化：
- 收斂為「單一最佳建議」
- 異常時主動提供替代方案
- 用「人格化語氣」降低焦慮感
```

---

## 2. 最高指導原則 (Prime Directives)

### 2.1 Guest-First（訪客優先）

**原則**：90% 的功能必須在免登入、免註冊的情況下可用。

**可用功能**：地圖、查詢、AI 對話、商業導流
**需註冊功能**：Trip Guard 行程守護（推播需要 LINE 綁定）

**Design Rationale**：
```
為什麼訪客優先？
- 旅客（特別是外國遊客）不願意為了一次性使用而註冊
- 註冊牆會導致 80%+ 的用戶流失
- 商業模式是導流分潤，不是用戶數據

實作原則：
- 不強制 GPS 授權，允許手動選擇位置
- 不要求任何個人資訊
- 偏好設定存在 localStorage，不需帳號
```

### 2.2 One Recommendation（一個建議原則）

**原則**：AI 輸出必須收斂為「單一最佳建議」(Primary Card)。

**輸出結構**：
- **Primary Card**：系統推薦的最佳方案（最大、最顯眼）
- **Secondary Cards**：最多 2 張替代方案（較小、需要滑動查看）

**Design Rationale**：
```
為什麼只給一個建議？
- Hick's Law：選項越多，決策時間越長
- 焦慮狀態下，用戶無法處理複雜資訊
- 「幫我決定」比「給我選項」更有價值

如何決定「最佳」？
- 優先考慮：時間、成本、舒適度的平衡
- 根據情境調整權重：
  - 趕時間 → 時間優先
  - 下雨天 → 舒適度優先
  - 預算有限 → 成本優先
```

### 2.3 Commercial Reality（商業現實）

**原則**：L4 行動建議必須優先考量「可執行的替代方案」。

**商業導流優先順序**：
1. 公共交通（免費，建立信任）
2. GO Taxi / Uber（付費，高單價）
3. LUUP / 共享單車（付費，中單價）
4. Ecbo Cloak（付費，解決痛點）

**Design Rationale**：
```
為什麼商業導流是核心？
- 免費 App 沒有可持續的商業模式
- 導流分潤 (CPA) 是最適合旅遊場景的變現方式
- 但必須「真正有幫助」才能建立信任

導流的道德準則：
- 永遠先推薦公共交通（即使沒有分潤）
- 只在公共交通「不適合」時推薦付費選項
- 不適合的定義：延誤、擁擠、無障礙需求、時間緊迫
```

### 2.4 Inheritance Efficiency（繼承效率）

**原則**：嚴守 10-15 個 Hub 母節點限制，其他節點透過演算法繼承。

**Design Rationale**：
```
為什麼要 Hub/Spoke 架構？
- 手工撰寫 Persona 很耗時（每個 Hub 約 2 小時）
- MVP 階段沒有資源為數百個節點寫人格
- 但每個節點都需要「有人格」才能情感化

繼承邏輯：
1. Spoke 節點繼承「同路線上最近的 Hub」的人格
2. 若有多條路線，取「共同路線數最多的 Hub」
3. 繼承內容：語氣、推薦偏好、在地知識
4. 不繼承：具體設施資訊（這是 L3 數據）
```

### 2.5 Graceful Degradation（優雅降級）

**原則**：服務品質隨距離遞減，但永遠不能「變磚塊」。

**這是新增的核心原則，詳見第 4 節「同心圓數據策略」。**

### 2.6 Static Data Principle（靜態數據原則）

**原則**：L1 標籤是「冷數據」，App 執行時只讀取、不計算。

**Design Rationale**：
```
為什麼這很重要？
- L1 標籤（category_counts, vibe_tags）需要呼叫 Overpass API 計算
- 如果每次用戶打開 App 都即時計算，地圖載入會慢 2-3 秒
- 用戶體驗會極差，跳出率會很高

正確架構：
┌────────────────────────────────────────────┐
│  開發/維護階段                              │
│  ─────────────────────────────────────── │
│  n8n 批次 → 呼叫 Overpass → 計算 → 寫入 DB │
│  頻率：每季一次（或手動觸發）               │
└────────────────────────────────────────────┘
          │
          ▼ (數據已存在 DB 中)
┌────────────────────────────────────────────┐
│  App 執行階段                               │
│  ─────────────────────────────────────── │
│  用戶打開 App → SELECT 查詢 → 直接顯示     │
│  零計算、零外部 API 呼叫、<50ms 延遲        │
└────────────────────────────────────────────┘

禁止事項：
❌ 在 API Route 中呼叫 Overpass
❌ 在 React 組件中計算 category_counts
❌ 在用戶互動時動態生成 vibe_tags

L1 標籤 ≈ 車站名稱：都是靜態寫死的，直接讀就好。
```

### 2.7 多語言與國際化

**原則**：繁體中文 (zh-TW) 為預設，必須支援日文 (ja) 與英文 (en)。

**Design Rationale**：
```
為什麼繁體中文是預設？
- 創辦人是台灣人，初期用戶以台灣旅客為主
- 繁體中文可以涵蓋港澳用戶
- 但 MVP 驗證場域在日本，日文是必要的

多語系策略：
- UI 文字：i18n 檔案，三語完整支援
- 節點名稱：JSONB 多語系欄位
- AI 對話：用戶用什麼語言問，就用什麼語言答
- 非支援語系：AI 仍可理解並回應，但 UI 保持預設語系
```

---

## 3. 四層標籤化數據模型

### 概念說明

```
L1 地點基因 (Location DNA)     ← 這個地方「是什麼」
    ↓
L2 即時狀態 (Live Status)      ← 這個地方「現在怎樣」
    ↓
L3 環境機能 (Micro-Facilities) ← 這個地方「有什麼」
    ↓
L4 行動策略 (Mobility Strategy) ← 所以你「該怎麼做」
```

### Design Rationale
```
為什麼要分四層？
- 數據的「更新頻率」不同，混在一起會浪費資源
- 數據的「來源」不同，需要不同的處理邏輯
- 分層後可以「組合」出無限的情境回應

為什麼不是三層或五層？
- 三層太少：無法區分「靜態屬性」和「即時狀態」
- 五層太多：增加複雜度但沒有對應的價值
- 四層剛好對應：身份、狀態、資源、行動
```

### 各層詳細定義

#### L1：地點基因層 (Location DNA)
- **本質**：節點的靜態身份與人格
- **更新頻率**：每季或更低（幾乎不變）
- **包含內容**：
  - 基本資訊（名稱、座標、類型）
  - Hub/Spoke 繼承關係
  - Persona Prompt（僅 Hub）
  - Vibe 標籤（busy, quiet, historic, modern）

#### L2：即時狀態層 (Live Status)
- **本質**：影響決策的動態變數
- **更新頻率**：15 分鐘（MVP）/ 未來可縮短至 5 分鐘
- **包含內容**：
  - 運行狀態（正常/延誤/停駛）
  - 擁擠度（低/中/高）
  - 天氣狀況
  - 活動/事件

#### L3：環境機能層 (Micro-Facilities)
- **本質**：解決旅途中「微需求」的服務設施
- **更新頻率**：每月
- **雙層標籤結構**：
  - **Supply Tags（供給）**：has_locker, has_toilet, has_wifi
  - **Suitability Tags（適用）**：good_for_waiting, luggage_friendly

#### L4：行動策略層 (Mobility Strategy)
- **本質**：AI 綜合 L1-L3 生成的最終建議
- **更新頻率**：即時（每次查詢都重新生成）
- **輸出格式**：Action Cards

---

## 4. 同心圓數據策略 ⭐ 重要

### 為什麼需要同心圓？

```
問題：
MVP 只能深度經營「驗證場域」，但用戶不會只待在這個範圍內。
如果出了驗證場域 App 就變磚塊，用戶體驗會極差。

解決方案：
定義三個同心圓，每個圓有不同的「服務深度」和「降級策略」。
```

### 三個圈層定義

#### 🔴 核心圈 (Core Zone) - 完整體驗

**範圍**：台東區、千代田區、中央區（MVP 驗證場域）

**Bounding Box**：`[139.73, 35.65]` ~ `[139.82, 35.74]`

**數據深度**：L1 + L2 + L3 + L4 全量

**服務能力**：
- ✅ 完整 AI 人格對話
- ✅ 即時狀態顯示
- ✅ 設施搜尋（廁所、置物櫃）
- ✅ 商業導流（GO Taxi, LUUP, Ecbo）
- ✅ Trip Guard 推播

**Hub 節點（範例，非完整清單）**：
- 上野站、淺草站、御徒町站（台東區）
- 東京站、秋葉原站、神田站（千代田區）
- 銀座站、日本橋站（中央區）

**Design Rationale**：
```
為什麼選這三區？
- 台東區：觀光熱點（上野、淺草），過度旅遊問題明顯
- 千代田區：交通樞紐（東京站），轉乘需求高
- 中央區：商業中心（銀座），高消費力用戶

這三區的共同特點：
- ODPT 數據覆蓋完整
- OSM 設施數據豐富
- 有明確的「痛點」可以解決
```

#### 🟡 緩衝圈 (Buffer Zone) - 導航模式

**範圍**：ODPT 覆蓋的東京都心其他區域

**包含區域（範例）**：新宿、澀谷、池袋、品川、六本木

**數據深度**：L1 + L2（路線數據），無 L3 深度設施

**服務能力**：
- ✅ 基本路線查詢
- ✅ 即時運行狀態
- ⚠️ 簡化 AI 對話（無人格，純功能）
- ❌ 設施搜尋（無數據）
- ❌ 商業導流（無合作）

**UI 處理**：
```
當用戶進入緩衝圈時：
1. 地圖正常顯示，但節點標記變為「灰色/簡化」
2. 點擊節點顯示：「此區域僅提供基本導航」
3. AI 對話回應：「我對這區還不太熟，但可以幫你查路線」
4. 提供「返回核心區」的建議
```

**Design Rationale**：
```
為什麼要有緩衝圈？
- 用戶可能「經過」這些區域（如從新宿去上野）
- 我們有 ODPT 路線數據，可以提供基本導航
- 但沒有深度 L3 數據，不能假裝很熟

「只導航，不導覽」的意義：
- 導航：告訴你怎麼從 A 到 B
- 導覽：告訴你 A 有什麼好玩、附近有什麼設施
- 緩衝圈只做前者，避免給出錯誤資訊
```

#### ⚪ 外部圈 (Outer Zone) - 降級模式

**範圍**：東京都心以外、其他城市、海外

**數據深度**：無

**服務能力**：
- ⚠️ 優雅降級，提供外部連結
- ✅ Google Maps Deep Link
- ✅ 返回核心區的路線建議

**UI 處理**：
```
當用戶進入外部圈時：
1. 顯示友善提示：「這裡超出 BambiGO 的服務範圍」
2. 提供選項：
   - 「用 Google Maps 繼續」→ Deep Link
   - 「規劃回到東京都心的路線」→ 跳轉核心功能
3. AI 對話回應：「抱歉，我目前只熟悉東京都心，
   但我可以幫你規劃回去的路線！」
```

**Design Rationale**：
```
為什麼不直接說「不支援」？
- 「不支援」是技術用語，讓用戶感到被拒絕
- 「優雅降級」是提供替代方案，維持正面體驗
- 用戶記住的是「BambiGO 很貼心」而非「BambiGO 很弱」

Google Maps Deep Link 的價值：
- 不試圖做所有事，承認自己的邊界
- 把用戶導向更好的工具，而非讓他們卡住
- 未來擴展時，這些區域可以「升級」為緩衝圈或核心圈
```

### 圈層判定邏輯

```typescript
// lib/zones/zoneDetector.ts

type Zone = 'core' | 'buffer' | 'outer';

interface ZoneConfig {
  core: {
    bounds: [[number, number], [number, number]];
    districts: string[];
  };
  buffer: {
    odptOperators: string[];
  };
}

function detectZone(lat: number, lon: number, config: ZoneConfig): Zone {
  // 1. 檢查是否在核心圈 Bounding Box 內
  if (isInBounds(lat, lon, config.core.bounds)) {
    return 'core';
  }
  
  // 2. 檢查是否有 ODPT 數據覆蓋（查詢最近的車站）
  const nearestStation = await findNearestOdptStation(lat, lon);
  if (nearestStation && nearestStation.distance < 2000) { // 2km 內
    return 'buffer';
  }
  
  // 3. 其他都是外部圈
  return 'outer';
}
```

---

## 5. 模組化設計原則

### 為什麼需要模組化？

```
問題：
- MVP 只是起點，未來會不斷擴展
- 新城市、新數據源、新功能都要能輕鬆加入
- 寫死的架構會讓擴展變成重寫

解決方案：
- 每個功能都是獨立模組
- 模組之間通過明確的介面溝通
- 新增功能 = 新增模組，不修改現有代碼
```

### City Adapter 模式

```typescript
// lib/adapters/cityAdapter.ts

interface CityAdapter {
  id: string;                    // 'tokyo_core', 'osaka', 'taipei'
  name: LocalizedText;
  timezone: string;
  bounds: BoundingBox;
  
  // 功能開關（不是所有城市都有所有功能）
  features: {
    hasSubway: boolean;
    hasBus: boolean;
    hasSharedMobility: boolean;
    hasTaxiIntegration: boolean;
  };
  
  // 數據源設定
  dataSources: {
    odptOperators?: string[];    // ODPT 營運商
    gtfsFeeds?: string[];        // GTFS 來源
    gbfsSystems?: string[];      // 共享單車系統
  };
  
  // 商業導流設定
  commercialPartners: {
    taxi?: { provider: string; deepLinkTemplate: string };
    locker?: { provider: string; deepLinkTemplate: string };
  };
}

// 範例：東京核心區
const tokyoCoreAdapter: CityAdapter = {
  id: 'tokyo_core',
  name: { 'zh-TW': '東京都心', 'ja': '東京都心', 'en': 'Central Tokyo' },
  timezone: 'Asia/Tokyo',
  bounds: { sw: [139.73, 35.65], ne: [139.82, 35.74] },
  features: {
    hasSubway: true,
    hasBus: true,
    hasSharedMobility: true,
    hasTaxiIntegration: true,
  },
  dataSources: {
    odptOperators: ['TokyoMetro', 'Toei', 'JR-East'],
    gbfsSystems: ['docomo-cycle-tokyo', 'hellocycling'],
  },
  commercialPartners: {
    taxi: { provider: 'go_taxi', deepLinkTemplate: 'https://go.mo-t.com/?...' },
    locker: { provider: 'ecbo', deepLinkTemplate: 'https://cloak.ecbo.io/?...' },
  },
};
```

**Design Rationale**：
```
為什麼用 Adapter 模式？
- 未來可能擴展到大阪、京都、甚至台北
- 每個城市的數據源、商業合作都不同
- Adapter 模式讓「新增城市」變成「新增設定檔」

Adapter 包含什麼？
- 地理範圍（判斷用戶在哪個城市）
- 功能開關（這個城市有什麼功能）
- 數據源（這個城市的數據從哪來）
- 商業合作（這個城市可以導流到哪裡）
```

### 節點類型擴展

```typescript
// lib/nodes/nodeTypes.ts

// 基礎節點類型（MVP 必須支援）
type BaseNodeType = 'station' | 'bus_stop' | 'bike_station';

// 擴展節點類型（未來可加入）
type ExtendedNodeType = 
  | 'poi'           // 景點
  | 'restaurant'    // 餐廳
  | 'hotel'         // 飯店
  | 'hospital'      // 醫院
  | 'embassy';      // 大使館（緊急用）

// 節點類型註冊表
const nodeTypeRegistry = {
  station: {
    icon: '🚉',
    canBeHub: true,
    requiredFields: ['lines', 'operator'],
    optionalFields: ['exitInfo', 'barrierFreeMap'],
  },
  bus_stop: {
    icon: '🚏',
    canBeHub: false,  // 巴士站不能當 Hub
    requiredFields: ['routes'],
    optionalFields: [],
  },
  // ... 其他類型
};
```

---

## 6. 設施類型定義

### 重要提醒

> 以下列表是「目前已定義的類型」，不是「全部類型」。
> 
> AI 開發代理應該：
> 1. 理解這些類型的「分類邏輯」
> 2. 遇到新設施時，判斷應該歸類到哪個類型
> 3. 或建議新增類型（需符合分類邏輯）

### 分類邏輯

```
設施類型的命名規則：
- 主類別_子類別（如 toilet_accessible）
- 主類別對應「功能」，子類別對應「特性」

設施類型的判斷標準：
- 是否解決旅途中的「微需求」？
- 是否有「可查詢的狀態」？（開/關、空/滿）
- 是否有「商業導流價值」？
```

### 目前定義的類型

| 主類別 | 子類別 | 說明 |
|-------|-------|------|
| toilet | - | 一般廁所 |
| toilet | accessible | 無障礙廁所 |
| locker | small/medium/large | 投幣式置物櫃 |
| locker | service | 寄放服務（如 ecbo） |
| charging | - | 充電站/行動電源租借 |
| atm | - | ATM |
| convenience | - | 便利商店 |
| bench | - | 休息座椅 |
| wifi | - | 免費 WiFi |
| drinking_water | - | 飲水機 |
| tourist_info | - | 觀光案內所 |
| elevator | - | 電梯 |
| escalator | - | 電扶梯 |

---

## 7. Hub 節點設計指南

### Hub 的定義

**Hub 是「區域的代表性節點」**，擁有手工撰寫的 Persona Prompt。

### 選擇 Hub 的標準

```
必要條件（全部滿足）：
1. 是交通樞紐（多條路線交會）
2. 有明確的「區域特色」可以描述
3. 周邊有足夠的 L3 設施數據

加分條件：
- 觀光熱點
- 轉乘複雜（需要導引）
- 有過度旅遊問題（需要分流）
```

### Hub Persona 撰寫範本

```markdown
## [節點名稱] 的人格設定

### 基本資訊
- 所屬區域：[區名]
- 主要路線：[路線列表]
- 區域特色：[一句話描述]

### 說話風格
- 語氣：[親切/專業/活潑/沉穩]
- 特色用語：[如果有在地俚語或特色說法]

### 在地知識
- 這個站的特色是什麼？
- 周邊有什麼值得推薦的？
- 有什麼「只有當地人知道」的小技巧？

### 常見問題
- 旅客最常問什麼問題？
- 應該怎麼回答？

### 注意事項
- 有什麼地方容易讓旅客困擾？
- 有什麼安全或禮儀需要提醒？
```

### Design Rationale
```
為什麼要手寫 Persona？
- AI 生成的人格「太平均」，沒有地方特色
- 好的人格需要「在地知識」，這無法自動化
- 但手寫很耗時，所以限制數量（10-15 個）

Spoke 如何繼承？
- 繼承「語氣」和「說話風格」
- 繼承「區域層級的在地知識」
- 不繼承「節點特定的設施資訊」
```

---

## 8. 錯誤處理原則

### 原則：永遠給用戶一條路

```
Bad：顯示錯誤訊息後什麼都不做
Good：顯示問題 + 提供替代方案

範例：
❌ "無法載入數據，請稍後再試"
✅ "資料載入中遇到問題，但我可以用離線資料幫你：[選項A] [選項B]"
```

### 各類錯誤的處理

| 錯誤類型 | 處理方式 |
|---------|---------|
| API 失敗 | 使用 Cache 數據，標註「資料更新於 X 分鐘前」|
| 定位失敗 | 允許手動選擇位置 |
| 網路離線 | 使用 PWA 離線數據 |
| 超出服務範圍 | 優雅降級 + Google Maps 連結 |

---

## 9. 參考文件

| 文件 | 用途 |
|------|------|
| `db_schema.md` | 資料庫結構 |
| `UI_SPEC.md` | 介面設計 |
| `DATA_STRATEGY.md` | 數據獲取策略 |
| `N8N_WORKFLOWS.md` | 自動化流程 |
| `TECH_STACK.md` | 技術選型 |

---

*本文件是 BambiGO 的核心規範，所有開發決策都應參考本文件的原則。*
*如有衝突，本文件的原則優先於其他文件的細節。*
