# BambiGO 數據策略規格書 (Data Strategy)
# 版本：v2.0
# 原則：差異化更新、同心圓深度、資源最小化

---

## 🎯 本文件的使用方式

> **重要提醒給 AI 開發代理：**
> 
> 本文件列出的數據源是「MVP 階段的核心需求」，不是完整清單。
> 
> 你應該：
> 1. 理解「為什麼需要這個數據」而非只是「怎麼抓取」
> 2. 遇到新數據需求時，依據同樣的分類邏輯判斷優先級
> 3. 永遠考慮「這個數據多久需要更新一次」

---

## 1. 數據更新頻率策略

### Design Rationale
```
為什麼不能「即時」更新所有數據？
- API 呼叫有成本（速率限制、伺服器負載）
- 大部分數據根本不需要即時
- 過度抓取會被 API 提供者封鎖

MVP 階段的原則：
- 能慢則慢（節省資源）
- 只在「影響用戶決策」時才需要快
- 差異化更新：只更新「有變化」的數據
```

### 更新頻率分類

| 類別 | 更新頻率 | 數據範例 | 原因 |
|------|---------|---------|------|
| **靜態** | 每季/半年 | 車站位置、路線圖 | 除非有新站開通，否則不變 |
| **半靜態** | 每月 | 時刻表、設施清單 | 偶爾調整，但不頻繁 |
| **動態** | 每 15 分鐘 | 運行狀態、擁擠度 | 影響用戶決策，但不需要秒級 |
| **事件驅動** | 即時 | 異常警報 | 只在「發生時」推送 |

### 差異化更新策略

```
原則：不做「全量抓取」，只抓「有變化的」

實作方式：
1. 靜態數據：手動觸發，或設定每季檢查一次
2. 半靜態數據：每月初抓取一次，比對 hash 值判斷是否有變化
3. 動態數據：
   - 先檢查 API 的 Last-Modified header
   - 若無變化，不處理
   - 若有變化，只更新變化的欄位
4. 事件驅動：使用 Webhook 或輪詢，發現異常才處理
```

---

## 2. 同心圓數據深度

### 核心圈 (Core Zone) - 完整數據

**範圍**：台東區、千代田區、中央區

**數據深度**：L1 + L2 + L3 + L4

| 數據層 | 來源 | 更新頻率 |
|-------|------|---------|
| L1 節點 | ODPT + 手工 Hub | 每季 |
| L2 狀態 | ODPT API | 15 分鐘 |
| L3 設施 | OSM + 手工補充 | 每月 |
| L4 策略 | AI 即時生成 | 每次查詢 |

### 緩衝圈 (Buffer Zone) - 基本數據

**範圍**：ODPT 覆蓋的其他東京區域

**數據深度**：L1 + L2

| 數據層 | 來源 | 更新頻率 |
|-------|------|---------|
| L1 節點 | ODPT（自動） | 每季 |
| L2 狀態 | ODPT API | 15 分鐘 |
| L3 設施 | ❌ 不抓取 | - |
| L4 策略 | 簡化版（純路線） | 每次查詢 |

### 外部圈 (Outer Zone) - 無數據

**範圍**：ODPT 覆蓋範圍外

**處理方式**：不抓取任何數據，優雅降級到 Google Maps

---

## 3. ODPT 數據詳細規格

### 3.1 靜態數據（每季更新）

#### 車站資料 (odpt:Station)

**用途**：L1 節點建立

**API 範例**：
```
GET https://api.odpt.org/api/v4/odpt:Station
    ?odpt:operator=odpt.Operator:TokyoMetro
    &acl:consumerKey=YOUR_KEY
```

**需要的欄位**：
| 欄位 | 對應 BambiGO | 說明 |
|------|-------------|------|
| owl:sameAs | nodes.id | 唯一識別碼 |
| dc:title | nodes.name.ja | 日文站名 |
| odpt:stationTitle | nodes.name.* | 多語系站名 |
| geo:lat, geo:long | nodes.location | 座標 |
| odpt:railway | nodes.line_ids | 所屬路線 |
| odpt:connectingRailway | metadata | 轉乘路線 |

**需要抓取的營運商**：
- `odpt.Operator:TokyoMetro` - 東京Metro（核心圈必須）
- `odpt.Operator:Toei` - 都營地下鐵（核心圈必須）
- `odpt.Operator:JR-East` - JR東日本（核心圈必須，競賽限定）

**Design Rationale**：
```
為什麼每季才更新？
- 新車站開通是大事，會有新聞，不需要自動偵測
- 車站不會「消失」，只會「新增」
- 每季檢查一次足以應付

差異化策略：
- 不要每次都抓全部車站
- 記錄上次抓取的數量，只有數量增加時才處理新站
```

#### 路線資料 (odpt:Railway)

**用途**：路線圖渲染、Hub 繼承演算法

**更新頻率**：每季（與車站同步）

**需要的欄位**：
| 欄位 | 用途 |
|------|------|
| owl:sameAs | 路線 ID |
| dc:title | 路線名稱 |
| odpt:color | 路線顏色（地圖渲染用）|
| odpt:stationOrder | 站點順序（繼承演算法用）|

---

### 3.2 半靜態數據（每月更新）

#### GTFS 靜態檔案

**用途**：完整時刻表、票價

**下載 URL**：
| 來源 | URL | 說明 |
|------|-----|------|
| 都營巴士 | `files/Toei/data/ToeiBus-GTFS.zip` | 核心圈巴士 |
| 台東めぐりん | `files/odpt/TokyoTaitoCity/megurinCCBY40.zip` | 社區巴士 |
| 千代田風ぐるま | `files/odpt/HitachiAutomobileTransportation/Chiyoda_ALLLINES.zip` | 社區巴士 |
| JR東日本 | `files/JR-East/data/JR-East-Train-GTFS.zip` | 競賽限定 |

**差異化策略**：
```
1. 下載前先檢查 Last-Modified header
2. 與上次下載的日期比對
3. 若相同，跳過（大部分月份都會跳過）
4. 若不同，下載並解析

GTFS 解析優先順序：
1. stops.txt → 補充 nodes 表
2. routes.txt → 補充路線資訊
3. 其他檔案 → MVP 暫不處理
```

---

### 3.3 動態數據（每 15 分鐘）

#### 運行情報 (odpt:TrainInformation) ⚡ 最重要

**用途**：L2 即時狀態、Trip Guard 觸發

**API 範例**：
```
GET https://api.odpt.org/api/v4/odpt:TrainInformation
    ?acl:consumerKey=YOUR_KEY
```

**關鍵欄位**：
| 欄位 | 說明 |
|------|------|
| odpt:railway | 路線 ID |
| odpt:trainInformationStatus | 狀態（平常/遅延/運転見合わせ）|
| odpt:trainInformationText | 詳細說明 |
| dc:date | 更新時間 |

**處理邏輯**：
```javascript
// 差異化更新：只處理「狀態變化」
async function processTrainInfo(newData) {
  const cached = await getCache('train_info');
  
  for (const info of newData) {
    const railwayId = info['odpt:railway'];
    const newStatus = info['odpt:trainInformationStatus'];
    const oldStatus = cached[railwayId]?.status;
    
    // 只有狀態變化才處理
    if (newStatus !== oldStatus) {
      await updateL2Status(railwayId, newStatus);
      
      // 非正常狀態才觸發 Trip Guard
      if (!newStatus.includes('平常')) {
        await triggerTripGuard(railwayId, info);
      }
    }
  }
  
  await setCache('train_info', newData);
}
```

**Design Rationale**：
```
為什麼是 15 分鐘而非 1 分鐘？
- 運行異常不會每分鐘都變化
- 15 分鐘足以讓用戶做出決策
- API 呼叫次數減少 15 倍

為什麼用差異化更新？
- 正常狀態佔 95% 的時間
- 只有異常時才需要寫入資料庫
- 減少資料庫壓力
```

#### 列車位置 (odpt:Train) - MVP 可選

**用途**：計算擁擠度（進階功能）

**Design Rationale**：
```
MVP 是否需要？
- 擁擠度是「加分項」，不是核心功能
- 可以先用「運行情報」判斷是否異常
- Phase 2 再考慮加入

如果要加入：
- 更新頻率：15 分鐘
- 只抓取核心圈涵蓋的路線
```

---

## 4. 非 ODPT 數據獲取

### 4.1 OpenStreetMap - L3 設施

**用途**：廁所、置物櫃、便利商店等

**API**：Overpass API

**更新頻率**：每月

**查詢範圍**：只查詢核心圈 Bounding Box

```
// Overpass 查詢範本
[out:json][timeout:120];
(
  node["amenity"="toilets"](35.65,139.73,35.74,139.82);
  node["amenity"="lockers"](35.65,139.73,35.74,139.82);
  node["shop"="convenience"](35.65,139.73,35.74,139.82);
  node["amenity"="atm"](35.65,139.73,35.74,139.82);
  node["amenity"="bench"](35.65,139.73,35.74,139.82);
);
out center;
```

**差異化策略**：
```
1. 不要每次都抓全部設施
2. 記錄上次抓取的總數
3. 只有總數變化超過 5% 時才重新處理
4. 用 OSM 的 timestamp 欄位判斷哪些是新增的
```

**Design Rationale**：
```
為什麼只抓核心圈？
- 緩衝圈沒有深度 L3 服務
- 外部圈不抓任何數據
- 抓了也用不到，浪費資源

為什麼每月？
- OSM 更新頻率本來就低
- 便利商店不會天天開新店
- 每月檢查足夠
```

### 4.2 GBFS 共享單車

**用途**：L1 節點（站點位置）+ L4 導流

**API 來源**：
| 系統 | GBFS URL |
|------|----------|
| Docomo | `gbfs/docomo-cycle-tokyo/gbfs.json` |
| HelloCycling | `gbfs/hellocycling/gbfs.json` |

**數據分類**：
| 數據 | 更新頻率 | 原因 |
|------|---------|------|
| station_information | 每月 | 站點位置幾乎不變 |
| station_status | 15 分鐘 | 車輛數影響導流決策 |

**差異化策略**：
```
station_information（站點位置）：
- 每月比對站點數量
- 只處理新增/刪除的站點

station_status（即時狀態）：
- 只抓取核心圈 Bounding Box 內的站點
- 用 station_information 過濾，不抓緩衝圈/外部圈
```

### 4.3 氣象數據

**用途**：L2 狀態標籤、雨天建議

**API**：氣象廳或 OpenWeatherMap

**更新頻率**：每小時

**Design Rationale**：
```
為什麼每小時？
- 天氣不會每分鐘變化
- 每小時足以讓用戶知道「現在的天氣」
- 減少 API 呼叫

影響什麼決策？
- 下雨 → 建議搭車而非走路
- 高溫 → 建議有冷氣的路線
- 這些不需要即時精確
```

### 4.4 商業服務導流

**處理方式**：不抓取數據，只提供 Deep Link

| 服務 | Deep Link | 說明 |
|------|-----------|------|
| GO Taxi | `https://go.mo-t.com/` | 計程車 |
| LUUP | `https://luup.sc/` | 電動滑板車 |
| Ecbo Cloak | `https://cloak.ecbo.io/` | 行李寄存 |

**Design Rationale**：
```
為什麼不抓取這些服務的數據？
- 這些是「導流」不是「整合」
- 我們不需要知道 GO Taxi 有幾台車
- 用戶點擊後會跳轉到對方 App

商業合作升級後：
- 可能會有 API 可以查詢即時狀態
- 但 MVP 階段不需要
```

---

## 5. 數據存儲設計

### 存儲位置選擇

| 數據類型 | 存儲位置 | 原因 |
|---------|---------|------|
| L1 節點 | Supabase 表 | 需要地理查詢 |
| L2 狀態 | Supabase + Cache 表 | 需要過期機制 |
| L3 設施 | Supabase 表 | 需要關聯查詢 |
| GBFS 狀態 | Supabase Cache | 高頻更新，需要 TTL |

### Cache 表設計

```sql
-- L2 即時狀態快取
create table l2_cache (
  key text primary key,           -- 'train:TokyoMetro.Ginza'
  value jsonb not null,
  expires_at timestamptz not null,
  updated_at timestamptz default now()
);

-- 自動清理過期資料（每小時執行）
create index idx_l2_cache_expires on l2_cache(expires_at);
```

**TTL 設定**：
| 數據類型 | TTL | 原因 |
|---------|-----|------|
| 運行狀態 | 20 分鐘 | 比更新頻率稍長，避免空窗 |
| GBFS 狀態 | 20 分鐘 | 同上 |
| 天氣 | 2 小時 | 變化慢，可以長一點 |

---

## 6. 數據抓取優先順序

### Phase 1 - 骨幹（立即需要）

| 優先級 | 數據 | 來源 | 頻率 |
|-------|------|------|------|
| P0 | 核心圈車站 | ODPT | 一次性 |
| P0 | 路線資料 | ODPT | 一次性 |
| P1 | 運行情報 | ODPT | 15 分鐘 |
| P1 | 天氣 | 氣象廳 | 1 小時 |

### Phase 2 - 設施（第二優先）

| 優先級 | 數據 | 來源 | 頻率 |
|-------|------|------|------|
| P2 | OSM 設施 | Overpass | 每月 |
| P2 | GBFS 站點 | GBFS | 每月 |
| P2 | GBFS 狀態 | GBFS | 15 分鐘 |

### Phase 3 - 增強（有時間再做）

| 優先級 | 數據 | 來源 | 頻率 |
|-------|------|------|------|
| P3 | GTFS 時刻表 | ODPT | 每月 |
| P3 | 社區巴士 | GTFS | 每月 |
| P3 | 列車位置 | ODPT | 15 分鐘 |

---

## 7. API 呼叫預算

### MVP 階段預估

| API | 每日呼叫次數 | 計算方式 |
|-----|-------------|---------|
| ODPT 運行情報 | 96 | 24hr × 4次/hr |
| ODPT 列車位置 | 0 | MVP 不抓 |
| GBFS 狀態 | 96 | 24hr × 4次/hr |
| 氣象 | 24 | 24hr × 1次/hr |
| Overpass | 1 | 每月 1 次 |

**總計**：約 200 次/日（遠低於任何 API 限制）

**Design Rationale**：
```
為什麼要計算 API 預算？
- 免費 API 有呼叫限制
- 超過限制會被封鎖
- MVP 要確保在限制內運作

如何進一步優化？
- 運行情報：只在營運時間抓取（6:00-24:00）
- 可以再減少 25% 的呼叫
```

---

## 8. 錯誤處理策略

### API 失敗時

```typescript
async function fetchWithFallback(apiCall, cacheKey) {
  try {
    const data = await apiCall();
    await setCache(cacheKey, data);
    return { data, source: 'api' };
  } catch (error) {
    // 嘗試使用 cache
    const cached = await getCache(cacheKey);
    if (cached) {
      return { data: cached, source: 'cache', stale: true };
    }
    // cache 也沒有，返回空數據
    return { data: null, source: 'none', error };
  }
}
```

### UI 顯示

| 數據來源 | UI 處理 |
|---------|---------|
| API 即時 | 正常顯示 |
| Cache | 顯示 + 標註「資料更新於 X 分鐘前」|
| 無數據 | 顯示「暫時無法取得資料」+ 手動重試按鈕 |

---

*本文件定義 BambiGO 的數據獲取策略，應與 N8N_WORKFLOWS.md 配合使用。*
