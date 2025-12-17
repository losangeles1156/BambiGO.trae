# BambiGO 資料庫設計規格 (Database Schema)
# 版本：v2.0
# 原則：核心正規化、擴充彈性、支援圈層

---

## 🎯 本文件的使用方式

> **重要提醒給 AI 開發代理：**
> 
> 本文件的 Schema 是「核心結構」，不是「完整規格」。
> 
> 你應該：
> 1. 理解每個表的「目的」和「關聯」
> 2. 根據需求自行擴展欄位（使用 JSONB）
> 3. 保持索引策略的一致性
> 4. 新增表時遵循相同的設計原則

---

## 1. 設計哲學

### 混合策略

| 策略 | 適用場景 | 原因 |
|------|---------|------|
| **正規化 + 索引** | 高頻查詢欄位 | 效能最佳 |
| **JSONB** | 低頻/動態欄位 | 彈性擴展 |
| **Cache 表** | 即時數據 | TTL 自動過期 |

### Design Rationale
```
為什麼用混合策略？
- 純正規化：新增欄位要 ALTER TABLE，迭代慢
- 純 JSONB：無法建索引，查詢慢
- 混合：核心欄位正規化（快），擴展欄位 JSONB（彈性）

怎麼判斷哪些正規化？
- 會用在 WHERE 條件的 → 正規化
- 只是「顯示」用的 → JSONB
```

### 多語系欄位

所有面向用戶的文字使用 JSONB：

```json
{
  "zh-TW": "上野站",
  "ja": "上野駅",
  "en": "Ueno Station"
}
```

---

## 2. 表格總覽

```
核心表：
├── cities          城市/區域設定
├── nodes           節點主表（車站、景點）
├── facilities      設施表（L3）
├── facility_suitability  適用標籤

用戶表：
├── users           用戶
├── trip_subscriptions  Trip Guard 訂閱

運營表：
├── shared_mobility_stations  共享運具站點
├── l2_cache        即時狀態快取
└── nudge_logs      意圖日誌（商業分析）
```

---

## 3. cities 表

**用途**：City Adapter 的資料庫對應

```sql
create table cities (
  id text primary key,                    -- 'tokyo_core', 'tokyo_buffer'
  name jsonb not null,                    -- {"zh-TW": "東京都心", ...}
  timezone text not null default 'Asia/Tokyo',
  
  -- 地理範圍
  bounds geography(polygon, 4326),
  
  -- 圈層標記 ⭐ 重要
  zone_type text not null default 'core', -- 'core', 'buffer'
  parent_city_id text references cities(id),  -- buffer 指向 core
  
  -- City Adapter 設定
  config jsonb not null default '{}',
  /*
    {
      "features": {
        "hasSubway": true,
        "hasSharedMobility": true,
        "hasTaxiIntegration": true
      },
      "dataSources": {
        "odptOperators": ["TokyoMetro", "Toei"],
        "gbfsSystems": ["docomo-cycle-tokyo"]
      },
      "commercialPartners": {
        "taxi": { "provider": "go_taxi", "deeplink": "..." }
      }
    }
  */
  
  enabled boolean default true,
  created_at timestamptz default now()
);

-- 初始數據
insert into cities (id, name, zone_type, config) values
  ('tokyo_core', 
   '{"zh-TW": "東京都心", "ja": "東京都心", "en": "Central Tokyo"}',
   'core',
   '{"features": {"hasSubway": true, "hasSharedMobility": true, "hasTaxiIntegration": true}}'),
  ('tokyo_buffer', 
   '{"zh-TW": "東京周邊", "ja": "東京周辺", "en": "Greater Tokyo"}',
   'buffer',
   '{"features": {"hasSubway": true, "hasSharedMobility": false, "hasTaxiIntegration": false}}');
```

### Design Rationale
```
為什麼 cities 要分 core 和 buffer？
- 不同圈層的「功能」不同
- 用 zone_type 欄位區分，方便查詢
- parent_city_id 讓 buffer 指向對應的 core

未來擴展：
- 新增 osaka_core, osaka_buffer
- 只需要 INSERT，不需要改程式碼
```

---

## 4. nodes 表

**用途**：L1 節點主表，支援 Hub/Spoke 繼承

```sql
create table nodes (
  id text primary key,                    -- 'odpt:TokyoMetro.Ueno'
  city_id text references cities(id),
  
  -- 基本資訊
  name jsonb not null,
  type text not null,                     -- 'station', 'bus_stop', 'bike_station', 'poi'
  location geography(point, 4326) not null,
  geohash text not null,
  
  -- 圈層（冗餘，加速查詢）
  zone text not null default 'core',      -- 'core', 'buffer'
  
  -- L1 核心屬性（正規化）
  vibe text,                              -- 'busy', 'quiet', 'historic'
  accessibility text default 'unknown',
  
  -- Hub/Spoke 繼承
  is_hub boolean default false,
  parent_hub_id text references nodes(id),
  persona_prompt text,                    -- 只有 Hub 有
  
  -- 路線關聯
  line_ids text[],
  
  -- 數據來源
  source_dataset text not null,           -- 'odpt', 'osm', 'gbfs', 'manual'
  source_id text,
  
  -- 擴充屬性
  metadata jsonb default '{}',
  external_links jsonb default '{}',
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 核心索引
create index idx_nodes_city on nodes(city_id);
create index idx_nodes_zone on nodes(zone);
create index idx_nodes_type on nodes(type);
create index idx_nodes_geohash on nodes(geohash);
create index idx_nodes_hub on nodes(is_hub) where is_hub = true;
create index idx_nodes_parent on nodes(parent_hub_id);
create index idx_nodes_location on nodes using gist(location);
create index idx_nodes_lines on nodes using gin(line_ids);
```

### Design Rationale
```
為什麼 zone 是冗餘欄位？
- 可以從 city_id 推導出來
- 但加了冗餘可以直接 WHERE zone = 'core'
- 查詢效能更好

為什麼用 text[] 存 line_ids？
- 一個站可能有多條路線
- PostgreSQL 原生支援陣列
- 可以用 GIN 索引加速「包含」查詢
```

---

## 5. facilities 表

**用途**：L3 設施，支援 Supply Tags

```sql
create table facilities (
  id text primary key,                    -- 'osm:12345' 或 'manual:xxx'
  node_id text references nodes(id) on delete cascade,
  city_id text references cities(id),
  
  -- 基本資訊
  type text not null,                     -- 見下方類型列表
  name jsonb,
  
  -- 位置描述
  distance_meters int,
  direction text,                         -- '改札内北側'
  floor text,
  
  -- L3 Supply Tags（正規化）
  has_wheelchair_access boolean default false,
  has_baby_care boolean default false,
  is_free boolean default true,
  is_24h boolean default false,
  
  -- 即時狀態
  current_status text default 'unknown',  -- 'available', 'busy', 'closed'
  status_updated_at timestamptz,
  
  -- 擴充屬性
  attributes jsonb default '{}',
  
  -- 商業導流
  booking_url text,
  
  -- 數據來源
  source_dataset text not null,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 索引
create index idx_facilities_node on facilities(node_id);
create index idx_facilities_city on facilities(city_id);
create index idx_facilities_type on facilities(type);
create index idx_facilities_wheelchair on facilities(has_wheelchair_access) 
  where has_wheelchair_access = true;
```

### 設施類型（type 欄位）

```
基本類型（MVP 必須）：
- toilet, toilet_accessible
- locker_small, locker_medium, locker_large, locker_service
- convenience_store, atm
- bench, charging

擴展類型（未來可加）：
- elevator, escalator
- wifi, drinking_water
- tourist_info
```

### Design Rationale
```
為什麼 Supply Tags 正規化？
- has_wheelchair_access 是常見查詢條件
- 正規化後可以建索引
- 查「輪椅友善廁所」會很快

為什麼 attributes 用 JSONB？
- 不同設施類型有不同屬性
- locker 有 price、size
- toilet 有 has_ostomate
- 正規化會很複雜
```

---

## 6. node_facility_profiles 表

**用途**：儲存節點周邊 50m 的生活機能統計（L1 標籤）

```sql
create table node_facility_profiles (
  node_id text primary key references nodes(id) on delete cascade,
  
  -- 計算參數
  radius_meters int not null default 50,
  
  -- MVP：主類別計數
  category_counts jsonb not null default '{
    "shopping": 0,
    "dining": 0,
    "medical": 0,
    "education": 0,
    "leisure": 0,
    "finance": 0
  }',
  
  -- Phase 2：次類別計數
  subcategory_counts jsonb default '{}',
  
  -- 衍生標籤（規則生成或 AI 生成）
  vibe_tags text[] default '{}',
  
  -- 統計欄位
  total_count int default 0,
  dominant_category text,
  
  -- 資料來源與時間
  data_source text default 'osm',
  calculated_at timestamptz,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 索引
create index idx_facility_profile_node on node_facility_profiles(node_id);
create index idx_facility_profile_dominant on node_facility_profiles(dominant_category);
create index idx_facility_profile_total on node_facility_profiles(total_count desc);
create index idx_facility_profile_vibe on node_facility_profiles using gin(vibe_tags);

-- 計算 total_count 和 dominant_category 的觸發器
create or replace function calculate_facility_stats()
returns trigger as $$
declare
  max_category text;
  max_count int := 0;
  cat_key text;
  cat_value int;
begin
  new.total_count := 0;
  for cat_key, cat_value in select * from jsonb_each_text(new.category_counts)
  loop
    new.total_count := new.total_count + cat_value::int;
    if cat_value::int > max_count then
      max_count := cat_value::int;
      max_category := cat_key;
    end if;
  end loop;
  new.dominant_category := max_category;
  return new;
end;
$$ language plpgsql;

create trigger tr_calculate_facility_stats
before insert or update of category_counts on node_facility_profiles
for each row execute function calculate_facility_stats();
```

### Design Rationale
```
⚠️ 重要：這是「冷數據」表，不是「快取」表！

資料生命週期：
- 生成：n8n 每季批次執行，呼叫 Overpass API，計算後寫入
- 讀取：App 執行時直接 SELECT，零計算
- 更新：只有下次批次執行時才會更新

❌ 禁止：在 App 執行時動態計算這些數據
❌ 禁止：在 API Route 中呼叫 Overpass
✅ 正確：把這張表當作靜態參照表（像車站名稱一樣）

為什麼獨立成表？
- 機能輪廓是「計算產生」的，與節點本身的靜態資料分開
- 可以獨立更新，不影響 nodes 表
- 不同的更新頻率（nodes 每季，profiles 也是每季但邏輯獨立）

category_counts vs 正規化欄位？
- 用 JSONB 方便新增類別
- 6 個主類別固定，但 Phase 2 會有更多次類別
- 觸發器自動計算 total 和 dominant
```

---

## 7. facility_suitability 表

**用途**：L3 Suitability Tags（適用標籤）

```sql
create table facility_suitability (
  id uuid primary key default gen_random_uuid(),
  facility_id text references facilities(id) on delete cascade,
  
  tag text not null,                      -- 見下方標籤列表
  confidence float default 1.0,           -- 0-1
  source text default 'manual',           -- 'manual', 'ai_inferred'
  
  created_at timestamptz default now()
);

-- 索引（核心查詢）
create index idx_suitability_tag on facility_suitability(tag);
create index idx_suitability_facility on facility_suitability(facility_id);
```

### Suitability Tags

```
目前定義的標籤：
- good_for_waiting    適合久候
- work_friendly       適合工作
- quiet_zone          安靜區域
- luggage_friendly    適合大行李
- family_friendly     適合親子
- rain_shelter        可避雨
- emergency_ready     緊急設備

這些是「範例」，可以根據需求擴展。
```

### Design Rationale
```
為什麼分開 Supply 和 Suitability？
- Supply：客觀事實（有沒有）
- Suitability：主觀判斷（適不適合）

範例：
- Supply: has_bench = true, has_wifi = true
- Suitability: good_for_waiting（因為有椅子+WiFi）

Suitability 可以：
- 手動標註（confidence = 1.0）
- AI 推斷（confidence < 1.0）
- 用戶回饋調整
```

---

## 8. l2_cache 表

**用途**：即時狀態快取，自動過期

```sql
create table l2_cache (
  key text primary key,                   -- 'train:TokyoMetro.Ginza'
  value jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 過期索引
create index idx_l2_cache_expires on l2_cache(expires_at);

-- 清理函數
create or replace function cleanup_expired_cache()
returns void as $$
begin
  delete from l2_cache where expires_at < now();
end;
$$ language plpgsql;
```

### Key 命名規則

```
train:{railway_id}     列車運行狀態
crowding:{node_id}     擁擠度
weather:{city_id}      天氣
gbfs:{station_id}      共享單車狀態
```

### Design Rationale
```
為什麼用表而不是 Redis？
- MVP 階段 Supabase 免費
- 不需要額外維護 Redis
- 效能足夠（QPS < 100）

未來升級：
- 當 QPS > 1000 時考慮 Redis
- 只需要改 Cache 模組，不影響其他程式碼
```

---

## 9. 其他表（簡化版）

### users 表

```sql
create table users (
  id uuid primary key references auth.users(id),
  display_name text,
  preferred_language text default 'zh-TW',
  line_user_id text unique,
  preferences jsonb default '{}',
  is_guest boolean default true,
  created_at timestamptz default now()
);
```

### trip_subscriptions 表

```sql
create table trip_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  route_ids text[] not null,
  origin_node_id text references nodes(id),
  destination_node_id text references nodes(id),
  active_days int[] default array[0,1,2,3,4,5,6],
  active_start_time time,
  active_end_time time,
  last_notified_at timestamptz,
  notification_cooldown_minutes int default 30,
  is_active boolean default true,
  created_at timestamptz default now()
);
```

### nudge_logs 表

```sql
create table nudge_logs (
  id uuid primary key default gen_random_uuid(),
  city_id text references cities(id),
  session_id text not null,
  user_id uuid references users(id),
  
  -- 觸發情境
  trigger_type text not null,
  trigger_node_id text references nodes(id),
  
  -- 用戶意圖
  query_type text not null,
  query_raw text,
  
  -- AI 回應
  response_type text,
  action_cards jsonb,
  
  -- 用戶行為
  card_selected int,
  deeplink_clicked boolean default false,
  clicked_provider text,
  
  created_at timestamptz default now()
);

-- 商業分析索引
create index idx_nudge_city on nudge_logs(city_id);
create index idx_nudge_clicked on nudge_logs(deeplink_clicked) 
  where deeplink_clicked = true;
create index idx_nudge_created on nudge_logs(created_at);
```

---

## 10. 常用查詢

### 查詢核心圈的 Hub 節點

```sql
select * from nodes
where zone = 'core' and is_hub = true;
```

### 查詢節點周邊設施（有輪椅）

```sql
select f.*
from facilities f
where f.node_id = 'odpt:TokyoMetro.Ueno'
  and f.has_wheelchair_access = true;
```

### 查詢「適合等待」的設施

```sql
select f.*
from facilities f
join facility_suitability s on s.facility_id = f.id
where f.node_id = 'odpt:TokyoMetro.Ueno'
  and s.tag = 'good_for_waiting'
  and s.confidence >= 0.8;
```

### 取得繼承的 Persona

```sql
select coalesce(
  n.persona_prompt,
  (select persona_prompt from nodes where id = n.parent_hub_id)
) as effective_persona
from nodes n
where n.id = 'odpt:TokyoMetro.Iriya';
```

---

## 11. Migration 執行順序

```
supabase/migrations/
├── 001_extensions.sql        # PostGIS
├── 002_cities.sql
├── 003_nodes.sql
├── 004_facility_profiles.sql # L1 機能輪廓 ← 新增
├── 005_facilities.sql
├── 006_suitability.sql
├── 007_users.sql
├── 008_trip_subscriptions.sql
├── 009_l2_cache.sql
├── 010_nudge_logs.sql
├── 011_shared_mobility.sql
└── 012_functions.sql
```

---

*本文件定義資料庫結構，應與 DATA_STRATEGY.md 配合理解數據流向。*
