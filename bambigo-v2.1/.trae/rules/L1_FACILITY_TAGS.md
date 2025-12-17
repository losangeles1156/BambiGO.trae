# BambiGO L1 生活機能標籤系統 (Facility Tags)
# 版本：v1.1
# 用途：定義節點周邊生活機能的標籤架構與分階段實作策略

---

## 🚨 Critical: Data is Pre-calculated (資料是預先計算的)

> **在閱讀本文件之前，請先理解這個關鍵約束！**

```
⚠️ L1 生活機能標籤是「冷數據」，不是即時計算的！

錯誤認知：
❌ 用戶打開 App → 即時呼叫 Overpass API → 計算周邊設施 → 顯示標籤
   (這會導致地圖載入要等 2-3 秒，用戶體驗極差！)

正確認知：
✅ 開發階段：n8n 每季跑一次批次 → 計算所有節點 → 寫入 DB
✅ 執行階段：App 只做 SELECT → 直接顯示 → 零計算、零延遲
```

### 資料生命週期

| 階段 | 時機 | 動作 | 延遲 |
|------|------|------|------|
| **生成** | 每季（或手動） | n8n 批次計算，寫入 DB | N/A（離線）|
| **讀取** | 用戶使用 App | SELECT 查詢 | <50ms |
| **更新** | 不會發生 | 直到下次批次 | N/A |

### 程式碼位置對照

| 邏輯類型 | 正確位置 | 錯誤位置 |
|---------|---------|---------|
| Overpass API 呼叫 | `scripts/calculateProfiles.ts` | ~~`app/api/nodes/route.ts`~~ |
| 類別計數計算 | `n8n workflow` | ~~`components/NodeCard.tsx`~~ |
| vibe_tags 生成 | `scripts/` 或 `n8n` | ~~`lib/ai/processor.ts`~~ |
| 讀取標籤顯示 | `components/FacilityProfile.tsx` | ✅ 這裡只讀不算 |

### 給 Trae 的明確指令

```
本文件中的「計算邏輯」（Overpass 查詢、類別計數、vibe_tags 生成）
全部都是「離線批次處理」用的，不是「App 執行時」用的。

當你實作 UI 組件時：
- FacilityProfile 組件只負責「顯示」
- 資料來自 props，props 來自 DB 查詢
- 不要在組件內做任何計算

當你實作 API Route 時：
- 只做 Supabase SELECT
- 不要呼叫 Overpass
- 不要計算 counts

計算邏輯只存在於：
- scripts/calculateFacilityProfiles.ts（手動執行）
- n8n workflow（定期執行）
```

---

## 🎯 本文件的使用方式

> **重要提醒給 AI 開發代理：**
> 
> L1 生活機能標籤是 BambiGO 的核心差異化功能。
> 它讓每個節點有「生活圈畫像」，而不只是名稱和座標。
> 
> 本文件定義：
> 1. 標籤的層級架構
> 2. 分階段導入策略
> 3. 資料取得方式
> 4. 資料庫設計

---

## 1. 概念說明

### 什麼是生活機能標籤？

```
傳統導航 App 的節點：
  上野站 = 名稱 + 座標 + 路線

BambiGO 的節點：
  上野站 = 名稱 + 座標 + 路線 + 生活圈畫像
         = 🛒購物x23 🍜餐飲x18 🏥醫療x5 🎭休閒x8
         = 「購物天堂、美食激戰區」
```

### Design Rationale
```
為什麼需要這個？
- 用戶不只是要「到達」，還想知道「那邊有什麼」
- 節點的「氛圍」來自周邊的商家組成
- 這是 AI 生成建議的重要輸入

半徑 50m 的原因：
- 車站出口步行 1 分鐘內可達
- 太大會混入不相關的區域
- 太小會漏掉重要設施
```

---

## 2. 標籤層級架構

### 三層結構

```
L1 生活機能標籤
├── 節點本身標籤（type）
│   └── station, poi, bus_stop, exit...
│
└── 周邊機能標籤（facility_profile）
    ├── 主類別 (Main Category)     ← MVP
    │   └── 購物、餐飲、醫療...
    │
    ├── 次類別 (Sub Category)      ← Phase 2
    │   └── 購物 > 百貨、便利商店、藥妝...
    │
    └── 子類別 (Detail Category)   ← Phase 3
        └── 餐飲 > 日料 > 壽司、拉麵...
```

### 主類別定義（MVP 必須）

| 主類別 ID | 名稱 | 圖示 | 說明 |
|----------|------|------|------|
| `shopping` | 購物 | 🛒 | 各類商店 |
| `dining` | 餐飲 | 🍜 | 餐廳、咖啡廳、酒吧 |
| `medical` | 醫療 | 🏥 | 醫院、診所、藥局 |
| `education` | 教育 | 🎓 | 學校、補習班 |
| `leisure` | 休閒 | 🎭 | 娛樂、觀光、公園 |
| `finance` | 金融 | 🏦 | 銀行、ATM |

### 次類別定義（Phase 2）

```typescript
const SUB_CATEGORIES = {
  shopping: [
    'department_store',   // 百貨公司
    'convenience',        // 便利商店
    'supermarket',        // 超市
    'drugstore',          // 藥妝店
    'clothing',           // 服飾
    'electronics',        // 3C
    'souvenir',           // 紀念品
    'variety_store',      // 雜貨（唐吉軻德類）
    'other_shop'          // 其他
  ],
  
  dining: [
    'restaurant',         // 餐廳（一般）
    'cafe',               // 咖啡廳
    'fast_food',          // 速食
    'ramen',              // 拉麵
    'izakaya',            // 居酒屋
    'bakery',             // 麵包店
    'other_dining'        // 其他
  ],
  
  medical: [
    'hospital',           // 醫院
    'clinic',             // 診所
    'pharmacy',           // 藥局
    'dental',             // 牙科
    'other_medical'       // 其他
  ],
  
  education: [
    'university',         // 大學
    'school',             // 中小學
    'cram_school',        // 補習班
    'language_school',    // 語言學校
    'other_education'     // 其他
  ],
  
  leisure: [
    'park',               // 公園
    'museum',             // 博物館
    'cinema',             // 電影院
    'karaoke',            // 卡拉OK
    'game_center',        // 遊戲中心
    'temple_shrine',      // 寺廟神社
    'tourist_spot',       // 觀光景點
    'other_leisure'       // 其他
  ],
  
  finance: [
    'bank',               // 銀行
    'atm',                // ATM
    'exchange',           // 外幣兌換
    'other_finance'       // 其他
  ]
};
```

### 子類別定義（Phase 3）

```
Phase 3 才需要的細分，例如：
- 醫療 > 診所 > 眼科、牙科、內科、皮膚科、耳鼻喉科
- 餐飲 > 日料 > 壽司、天婦羅、燒肉、拉麵、丼飯
- 購物 > 服飾 > 男裝、女裝、童裝、運動用品

這需要更完整的 POI 資料庫或大量人工標註，
MVP 和 Phase 2 不需要實作。
```

---

## 3. OSM 標籤對應

### 主類別對應（MVP）

```javascript
// lib/facilities/osmMapping.ts

export const OSM_TO_MAIN_CATEGORY = {
  // Shopping
  'shop': 'shopping',  // 所有 shop=* 都歸類為購物
  
  // Dining
  'amenity=restaurant': 'dining',
  'amenity=cafe': 'dining',
  'amenity=fast_food': 'dining',
  'amenity=bar': 'dining',
  'amenity=pub': 'dining',
  'amenity=food_court': 'dining',
  
  // Medical
  'amenity=hospital': 'medical',
  'amenity=clinic': 'medical',
  'amenity=pharmacy': 'medical',
  'amenity=doctors': 'medical',
  'amenity=dentist': 'medical',
  
  // Education
  'amenity=school': 'education',
  'amenity=university': 'education',
  'amenity=college': 'education',
  'amenity=kindergarten': 'education',
  'amenity=language_school': 'education',
  
  // Leisure
  'leisure=park': 'leisure',
  'leisure=playground': 'leisure',
  'tourism=museum': 'leisure',
  'tourism=attraction': 'leisure',
  'amenity=theatre': 'leisure',
  'amenity=cinema': 'leisure',
  'amenity=nightclub': 'leisure',
  
  // Finance
  'amenity=bank': 'finance',
  'amenity=atm': 'finance',
  'amenity=bureau_de_change': 'finance',
};
```

### 次類別對應（Phase 2）

```javascript
// lib/facilities/osmSubMapping.ts

export const OSM_TO_SUB_CATEGORY = {
  // Shopping 細分
  'shop=department_store': 'department_store',
  'shop=convenience': 'convenience',
  'shop=supermarket': 'supermarket',
  'shop=chemist': 'drugstore',
  'shop=cosmetics': 'drugstore',
  'shop=clothes': 'clothing',
  'shop=fashion': 'clothing',
  'shop=electronics': 'electronics',
  'shop=gift': 'souvenir',
  'shop=variety_store': 'variety_store',
  
  // Dining 細分
  'amenity=restaurant': 'restaurant',
  'amenity=cafe': 'cafe',
  'amenity=fast_food': 'fast_food',
  'amenity=bar': 'izakaya',
  'amenity=pub': 'izakaya',
  'shop=bakery': 'bakery',
  
  // 特殊：從 cuisine 標籤判斷
  'cuisine=ramen': 'ramen',
  'cuisine=sushi': 'restaurant',  // Phase 3 再細分
  
  // Medical 細分
  'amenity=hospital': 'hospital',
  'amenity=clinic': 'clinic',
  'amenity=pharmacy': 'pharmacy',
  'amenity=dentist': 'dental',
  
  // ... 其他對應
};
```

---

## 4. Overpass API 查詢

### MVP 查詢（主類別計數）

```javascript
// n8n 或 script 使用

function buildOverpassQuery(lat, lon, radiusMeters = 50) {
  return `
[out:json][timeout:30];
(
  // Shopping - 所有 shop
  node(around:${radiusMeters},${lat},${lon})["shop"];
  
  // Dining
  node(around:${radiusMeters},${lat},${lon})["amenity"~"restaurant|cafe|fast_food|bar|pub"];
  
  // Medical
  node(around:${radiusMeters},${lat},${lon})["amenity"~"hospital|clinic|pharmacy|doctors|dentist"];
  
  // Education
  node(around:${radiusMeters},${lat},${lon})["amenity"~"school|university|college|kindergarten"];
  
  // Leisure
  node(around:${radiusMeters},${lat},${lon})["leisure"];
  node(around:${radiusMeters},${lat},${lon})["tourism"~"museum|attraction"];
  node(around:${radiusMeters},${lat},${lon})["amenity"~"theatre|cinema"];
  
  // Finance
  node(around:${radiusMeters},${lat},${lon})["amenity"~"bank|atm"];
);
out body;
`;
}
```

### 計數處理

```javascript
// lib/facilities/profileCalculator.ts

interface CategoryCounts {
  shopping: number;
  dining: number;
  medical: number;
  education: number;
  leisure: number;
  finance: number;
}

export function calculateCategoryCounts(elements: OSMElement[]): CategoryCounts {
  const counts: CategoryCounts = {
    shopping: 0,
    dining: 0,
    medical: 0,
    education: 0,
    leisure: 0,
    finance: 0,
  };
  
  for (const el of elements) {
    const tags = el.tags || {};
    
    // Shopping: 有 shop 標籤的都算
    if (tags.shop) {
      counts.shopping++;
      continue;
    }
    
    // Dining
    if (['restaurant', 'cafe', 'fast_food', 'bar', 'pub', 'food_court'].includes(tags.amenity)) {
      counts.dining++;
      continue;
    }
    
    // Medical
    if (['hospital', 'clinic', 'pharmacy', 'doctors', 'dentist'].includes(tags.amenity)) {
      counts.medical++;
      continue;
    }
    
    // Education
    if (['school', 'university', 'college', 'kindergarten', 'language_school'].includes(tags.amenity)) {
      counts.education++;
      continue;
    }
    
    // Leisure
    if (tags.leisure || tags.tourism || ['theatre', 'cinema', 'nightclub'].includes(tags.amenity)) {
      counts.leisure++;
      continue;
    }
    
    // Finance
    if (['bank', 'atm', 'bureau_de_change'].includes(tags.amenity)) {
      counts.finance++;
      continue;
    }
  }
  
  return counts;
}
```

---

## 5. 資料庫設計

### node_facility_profiles 表

```sql
-- 節點生活機能輪廓表
create table node_facility_profiles (
  node_id text primary key references nodes(id) on delete cascade,
  
  -- 計算參數
  radius_meters int not null default 50,
  
  -- MVP：主類別計數
  category_counts jsonb not null default '{}',
  /*
    {
      "shopping": 23,
      "dining": 18,
      "medical": 5,
      "education": 2,
      "leisure": 8,
      "finance": 3
    }
  */
  
  -- Phase 2：次類別計數
  subcategory_counts jsonb default '{}',
  /*
    {
      "shopping": {
        "convenience": 5,
        "drugstore": 4,
        "department_store": 2,
        "clothing": 8,
        "other_shop": 4
      },
      "dining": {
        "restaurant": 8,
        "cafe": 4,
        "ramen": 3,
        "izakaya": 3
      }
    }
  */
  
  -- 衍生標籤（AI 生成或人工標註）
  vibe_tags text[] default '{}',
  /*
    ['購物天堂', '美食激戰區', '文青聚落', '商業區']
  */
  
  -- 總數（方便排序）
  total_count int generated always as (
    (category_counts->>'shopping')::int +
    (category_counts->>'dining')::int +
    (category_counts->>'medical')::int +
    (category_counts->>'education')::int +
    (category_counts->>'leisure')::int +
    (category_counts->>'finance')::int
  ) stored,
  
  -- 主要特色（最高的類別）
  dominant_category text,
  
  -- 資料來源與時間
  data_source text default 'osm',
  calculated_at timestamptz default now(),
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 索引
create index idx_facility_profile_node on node_facility_profiles(node_id);
create index idx_facility_profile_dominant on node_facility_profiles(dominant_category);
create index idx_facility_profile_total on node_facility_profiles(total_count desc);
```

### 輔助函數

```sql
-- 計算主要特色類別
create or replace function update_dominant_category()
returns trigger as $$
begin
  select key into new.dominant_category
  from jsonb_each_text(new.category_counts)
  order by value::int desc
  limit 1;
  
  return new;
end;
$$ language plpgsql;

create trigger tr_update_dominant
before insert or update on node_facility_profiles
for each row execute function update_dominant_category();
```

---

## 6. UI 呈現

### MVP 顯示方式

```
節點卡片上的機能標籤：

┌─────────────────────────────────┐
│  🚉 上野站                      │
│  JR・Metro・京成                │
│  ─────────────────────────────  │
│  🛒23  🍜18  🎭8  🏥5  🏦3      │  ← 機能指紋
│  ─────────────────────────────  │
│  #購物天堂 #美食激戰區           │  ← vibe_tags
└─────────────────────────────────┘
```

### 組件設計

```typescript
// components/node/FacilityProfile.tsx

interface FacilityProfileProps {
  counts: CategoryCounts;
  vibeTags?: string[];
  showZero?: boolean;  // 是否顯示數量為 0 的類別
}

const CATEGORY_CONFIG = {
  shopping: { icon: '🛒', label: '購物' },
  dining: { icon: '🍜', label: '餐飲' },
  leisure: { icon: '🎭', label: '休閒' },
  medical: { icon: '🏥', label: '醫療' },
  finance: { icon: '🏦', label: '金融' },
  education: { icon: '🎓', label: '教育' },
};

export function FacilityProfile({ counts, vibeTags, showZero = false }: FacilityProfileProps) {
  // 按數量排序，只顯示前 5 個（或非零的）
  const sortedCategories = Object.entries(counts)
    .filter(([_, count]) => showZero || count > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);
  
  return (
    <div className="facility-profile">
      <div className="category-counts">
        {sortedCategories.map(([category, count]) => (
          <span key={category} className="category-badge">
            {CATEGORY_CONFIG[category].icon}
            {count}
          </span>
        ))}
      </div>
      
      {vibeTags && vibeTags.length > 0 && (
        <div className="vibe-tags">
          {vibeTags.map(tag => (
            <span key={tag} className="vibe-tag">#{tag}</span>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Phase 2 展開詳情

```
點擊機能指紋展開：

購物 🛒 (23)
├── 便利商店 5
├── 藥妝店 4
├── 服飾店 8
├── 百貨公司 2
└── 其他 4

餐飲 🍜 (18)
├── 餐廳 8
├── 咖啡廳 4
├── 拉麵 3
└── 居酒屋 3
```

---

## 7. 分階段實作計畫

### MVP（競賽前必須完成）

| 任務 | 工作量 | 產出 |
|------|-------|------|
| 定義 6 個主類別 OSM 對應 | 2 小時 | osmMapping.ts |
| 建立 node_facility_profiles 表 | 1 小時 | Migration SQL |
| 寫 Overpass 查詢腳本 | 4 小時 | profileCalculator.ts |
| 執行 Hub 節點計算（10-15 站）| 1 小時 | 資料庫數據 |
| 人工檢查 + 補 vibe_tags | 3 小時 | 微調 |
| UI 組件 FacilityProfile | 2 小時 | React Component |
| **總計** | **約 1.5 天** | |

### Phase 2

| 任務 | 工作量 | 產出 |
|------|-------|------|
| 定義次類別 OSM 對應 | 4 小時 | osmSubMapping.ts |
| 更新計算腳本 | 4 小時 | 支援次類別 |
| 執行全部核心圈節點 | 2 小時 | ~100 節點 |
| AI 輔助分類（可選） | 8 小時 | 更精確分類 |
| UI 展開詳情 | 4 小時 | 展開互動 |
| **總計** | **約 3 天** | |

### Phase 3

| 任務 | 工作量 | 說明 |
|------|-------|------|
| 子類別定義 | 大量 | 需要領域知識 |
| 外部 POI 資料庫整合 | 視供應商 | Google Places 或 Foursquare |
| 人工標註系統 | 大量 | 需要標註工具 |
| **總計** | **數週~數月** | 有營收後再做 |

---

## 8. n8n 工作流程

### 工作流程：計算節點機能輪廓

```
觸發條件：手動（MVP）或每月自動（Phase 2+）

[觸發]
    ↓
[Supabase: 讀取需要計算的節點]
    ↓
[Loop: 每個節點]
    ├─ [Overpass API: 查詢周邊 50m POI]
    ├─ [Code: 計算主類別計數]
    ├─ [Code: 判斷主要特色]
    └─ [Supabase: Upsert node_facility_profiles]
    ↓
[完成通知]
```

### n8n Code 節點

```javascript
// 節點：計算主類別計數

const elements = $input.first().json.elements || [];

const counts = {
  shopping: 0,
  dining: 0,
  medical: 0,
  education: 0,
  leisure: 0,
  finance: 0,
};

for (const el of elements) {
  const tags = el.tags || {};
  
  if (tags.shop) { counts.shopping++; continue; }
  if (['restaurant','cafe','fast_food','bar','pub'].includes(tags.amenity)) { counts.dining++; continue; }
  if (['hospital','clinic','pharmacy','doctors','dentist'].includes(tags.amenity)) { counts.medical++; continue; }
  if (['school','university','college'].includes(tags.amenity)) { counts.education++; continue; }
  if (tags.leisure || tags.tourism || ['theatre','cinema'].includes(tags.amenity)) { counts.leisure++; continue; }
  if (['bank','atm'].includes(tags.amenity)) { counts.finance++; continue; }
}

// 找出主要特色
const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];

return [{
  json: {
    node_id: $('節點資料').first().json.id,
    category_counts: counts,
    dominant_category: dominant,
    total_count: Object.values(counts).reduce((a, b) => a + b, 0),
    calculated_at: new Date().toISOString()
  }
}];
```

---

## 9. Vibe Tags 生成

### 規則式生成（MVP）

```javascript
// lib/facilities/vibeGenerator.ts

export function generateVibeTags(counts: CategoryCounts): string[] {
  const tags: string[] = [];
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  
  // 購物為主
  if (counts.shopping >= 15 && counts.shopping / total > 0.3) {
    tags.push('購物天堂');
  }
  
  // 餐飲為主
  if (counts.dining >= 10 && counts.dining / total > 0.25) {
    tags.push('美食激戰區');
  }
  
  // 文化休閒
  if (counts.leisure >= 5) {
    tags.push('休閒去處');
  }
  
  // 生活機能完整
  if (counts.shopping > 0 && counts.dining > 0 && counts.medical > 0 && counts.finance > 0) {
    tags.push('生活便利');
  }
  
  // 商業區特徵
  if (counts.finance >= 5 && counts.dining >= 5 && counts.shopping < 10) {
    tags.push('商業區');
  }
  
  // 安靜區域
  if (total < 10) {
    tags.push('寧靜區域');
  }
  
  return tags.slice(0, 3); // 最多 3 個
}
```

### AI 輔助生成（Phase 2）

```
Prompt 範本：

根據以下節點的周邊設施統計，生成 2-3 個描述該區域氛圍的標籤：

節點：上野站
購物：23（便利商店5、藥妝4、服飾8、百貨2、其他4）
餐飲：18（餐廳8、咖啡4、拉麵3、居酒屋3）
休閒：8（博物館3、公園2、其他3）
醫療：5
金融：3

請用繁體中文，每個標籤 2-4 個字，描述這個區域給人的感覺。

範例輸出：購物天堂、美食激戰區、文化聚落
```

---

## 10. 常見查詢

### 查詢購物最多的節點

```sql
select n.name, p.category_counts, p.vibe_tags
from nodes n
join node_facility_profiles p on p.node_id = n.id
where n.zone = 'core'
order by (p.category_counts->>'shopping')::int desc
limit 10;
```

### 查詢「生活便利」的節點

```sql
select n.name, p.category_counts
from nodes n
join node_facility_profiles p on p.node_id = n.id
where 'life_convenient' = any(p.vibe_tags)
  or (
    (p.category_counts->>'shopping')::int > 0 and
    (p.category_counts->>'dining')::int > 0 and
    (p.category_counts->>'medical')::int > 0
  );
```

### 查詢特定類別豐富的節點

```sql
-- 找餐飲 >= 10 的節點
select n.name, p.category_counts->>'dining' as dining_count
from nodes n
join node_facility_profiles p on p.node_id = n.id
where (p.category_counts->>'dining')::int >= 10
order by (p.category_counts->>'dining')::int desc;
```

---

*本文件定義 L1 生活機能標籤系統，應與 db_schema.md 和 DATA_STRATEGY.md 配合使用。*
