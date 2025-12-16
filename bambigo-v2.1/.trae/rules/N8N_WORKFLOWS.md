# BambiGO n8n 自動化工作流程設計
# 版本：v2.0
# 原則：差異化更新、資源最小化、只處理變化

---

## 🎯 本文件的使用方式

> **重要提醒給 AI 開發代理：**
> 
> 本文件的工作流程是「設計藍圖」，不是「唯一正解」。
> 
> 你應該：
> 1. 理解每個工作流程的「目的」和「觸發條件」
> 2. 根據實際情況調整節點配置
> 3. 遇到新需求時，依據相同的模式設計新工作流程

---

## 1. 工作流程總覽

### 依執行頻率分類

| 頻率 | 工作流程 | 用途 | API 呼叫/日 |
|------|---------|------|------------|
| **每 15 分鐘** | `dynamic-status` | 運行狀態、GBFS | ~96 |
| **每小時** | `hourly-weather` | 天氣 | ~24 |
| **每月 1 日** | `monthly-facilities` | OSM 設施、GBFS 站點 | 2 |
| **每季 1 日** | `quarterly-static` | 車站、路線 | 1 |
| **事件驅動** | `event-trip-guard` | 異常推播 | 依異常數 |

### Design Rationale
```
為什麼這樣分類？

每 15 分鐘（動態）：
- 影響用戶「現在」的決策
- 但不需要秒級更新
- 15 分鐘足以反映狀態變化

每小時（天氣）：
- 天氣變化慢
- 不影響即時決策
- 只是「參考資訊」

每月（設施）：
- 便利商店不會天天開
- OSM 更新頻率低
- 抓太頻繁浪費資源

每季（靜態）：
- 車站不會消失
- 新站開通是大新聞
- 自動檢查就好
```

---

## 2. 工作流程 1：動態狀態 (dynamic-status)

### 觸發條件
```
Cron: */15 * * * *（每 15 分鐘）
只在營運時間執行：05:00 - 01:00（東京時間）
```

### 流程設計

```
[Schedule Trigger]
    ↓
[檢查是否在營運時間] ← 凌晨 1-5 點不執行
    ↓
[並行抓取]
    ├─ [ODPT 運行情報]
    └─ [GBFS 狀態]（只抓核心圈）
    ↓
[差異化比對]
    ├─ 狀態無變化 → 結束
    └─ 狀態有變化 → 繼續
    ↓
[更新 Supabase l2_cache]
    ↓
[若有異常] → [觸發 Trip Guard]
```

### 核心邏輯：差異化更新

```javascript
// 節點：Code (差異化比對)

const newData = $input.all();
const updates = [];
const alerts = [];

for (const item of newData) {
  const key = item.json.key;        // 如 'train:TokyoMetro.Ginza'
  const newStatus = item.json.status;
  
  // 從 cache 讀取舊狀態
  const oldData = await $supabase
    .from('l2_cache')
    .select('value')
    .eq('key', key)
    .single();
  
  const oldStatus = oldData?.data?.value?.status;
  
  // 只有狀態變化才處理
  if (newStatus !== oldStatus) {
    updates.push({
      key,
      value: item.json,
      expires_at: new Date(Date.now() + 20 * 60 * 1000) // 20 分鐘 TTL
    });
    
    // 非正常狀態才記錄為 alert
    if (newStatus !== '平常' && newStatus !== 'normal') {
      alerts.push(item.json);
    }
  }
}

// 輸出：只有變化的數據
return [
  { json: { updates, alerts, hasAlerts: alerts.length > 0 } }
];
```

### GBFS 只抓核心圈

```javascript
// 節點：Code (過濾核心圈 GBFS)

const CORE_BOUNDS = {
  minLat: 35.65, maxLat: 35.74,
  minLon: 139.73, maxLon: 139.82
};

const allStations = $input.first().json.data?.stations || [];

// 只保留核心圈內的站點
const coreStations = allStations.filter(s => 
  s.lat >= CORE_BOUNDS.minLat && s.lat <= CORE_BOUNDS.maxLat &&
  s.lon >= CORE_BOUNDS.minLon && s.lon <= CORE_BOUNDS.maxLon
);

return coreStations.map(s => ({ json: s }));
```

### 營運時間檢查

```javascript
// 節點：Code (檢查營運時間)

const now = new Date();
const tokyoHour = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' })).getHours();

// 凌晨 1-5 點不執行
if (tokyoHour >= 1 && tokyoHour < 5) {
  return []; // 空輸出，終止流程
}

return $input.all();
```

---

## 3. 工作流程 2：每小時天氣 (hourly-weather)

### 觸發條件
```
Cron: 0 * * * *（每小時第 0 分）
```

### 流程設計

```
[Schedule Trigger]
    ↓
[HTTP Request: 氣象廳 API]
    ↓
[解析東京天氣]
    ↓
[Supabase: 更新 l2_cache]
```

### 氣象數據解析

```javascript
// 節點：Code (解析天氣)

const data = $input.first().json;

// 氣象廳 API 返回結構複雜，需要解析
const tokyo = data[0]; // 東京地區
const weather = tokyo.timeSeries?.[0]?.areas?.[0];

const result = {
  key: 'weather:tokyo',
  value: {
    weather: weather?.weathers?.[0] || '不明',
    weatherCode: weather?.weatherCodes?.[0],
    wind: weather?.winds?.[0],
    updated_at: new Date().toISOString()
  },
  expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 小時 TTL
};

return [{ json: result }];
```

---

## 4. 工作流程 3：每月設施 (monthly-facilities)

### 觸發條件
```
Cron: 0 3 1 * *（每月 1 日凌晨 3 點）
或手動觸發
```

### 流程設計

```
[Schedule/Manual Trigger]
    ↓
[並行抓取]
    ├─ [Overpass API: OSM 設施]
    └─ [GBFS: station_information]
    ↓
[比對現有數據]
    ├─ 數量無變化 → 結束
    └─ 數量有變化 → 繼續
    ↓
[差異化更新]
    ├─ 新增設施 → INSERT
    ├─ 刪除設施 → 標記 inactive
    └─ 修改設施 → UPDATE
    ↓
[記錄更新日誌]
```

### Overpass 查詢（只查核心圈）

```javascript
// 節點：HTTP Request (Overpass)

const query = `
[out:json][timeout:120];
(
  node["amenity"="toilets"](35.65,139.73,35.74,139.82);
  node["amenity"="lockers"](35.65,139.73,35.74,139.82);
  node["shop"="convenience"](35.65,139.73,35.74,139.82);
  node["amenity"="atm"](35.65,139.73,35.74,139.82);
  node["amenity"="bench"](35.65,139.73,35.74,139.82);
  node["amenity"="charging_station"](35.65,139.73,35.74,139.82);
  node["tourism"="information"](35.65,139.73,35.74,139.82);
);
out center;
`;

// POST 到 Overpass API
```

### 差異化比對邏輯

```javascript
// 節點：Code (差異化比對設施)

const newFacilities = $('Overpass').all().map(i => i.json);
const existingCount = $('Supabase Count').first().json.count;

// 快速檢查：數量差異小於 5% 就跳過詳細處理
const diff = Math.abs(newFacilities.length - existingCount);
const diffPercent = diff / existingCount * 100;

if (diffPercent < 5) {
  console.log(`數量變化 ${diffPercent.toFixed(1)}% < 5%，跳過更新`);
  return [{ json: { action: 'skip', reason: 'no_significant_change' } }];
}

// 有顯著變化，進行詳細比對
const existingIds = new Set($('Supabase IDs').all().map(i => i.json.id));
const newIds = new Set(newFacilities.map(f => `osm:${f.id}`));

const toInsert = newFacilities.filter(f => !existingIds.has(`osm:${f.id}`));
const toDelete = [...existingIds].filter(id => !newIds.has(id));

return [{ json: { 
  action: 'update',
  toInsert: toInsert.length,
  toDelete: toDelete.length,
  facilities: toInsert
} }];
```

---

## 5. 工作流程 4：每季靜態 (quarterly-static)

### 觸發條件
```
Cron: 0 2 1 1,4,7,10 *（每季第一天凌晨 2 點）
或手動觸發（新站開通時）
```

### 流程設計

```
[Schedule/Manual Trigger]
    ↓
[HTTP Request: ODPT 車站]
    ├─ TokyoMetro
    ├─ Toei
    └─ JR-East（競賽限定）
    ↓
[合併數據]
    ↓
[比對現有數據]
    ├─ 無新站 → 結束
    └─ 有新站 → 繼續
    ↓
[處理新站]
    ├─ 判斷是否在核心圈
    ├─ 設定 is_hub = false
    └─ 關聯最近的 Hub
    ↓
[Supabase: Upsert nodes]
```

### Design Rationale
```
為什麼每季而非每月？
- 新車站開通是大事
- 一年最多 1-2 個新站
- 更頻繁地檢查沒有意義

手動觸發的時機：
- 新聞報導有新站開通
- 準備擴展到新區域
- 競賽有新數據發布
```

### 新站處理邏輯

```javascript
// 節點：Code (處理新站)

const CORE_BOUNDS = { /* ... */ };
const newStations = $input.all().map(i => i.json);

const processed = newStations.map(station => {
  const lat = station['geo:lat'];
  const lon = station['geo:long'];
  
  // 判斷圈層
  const isInCore = isInBounds(lat, lon, CORE_BOUNDS);
  const zone = isInCore ? 'core' : 'buffer';
  
  return {
    id: station['owl:sameAs'],
    name: {
      'ja': station['dc:title'],
      'en': station['odpt:stationTitle']?.en,
      'zh-TW': station['odpt:stationTitle']?.['zh-Hant'] || station['dc:title']
    },
    type: 'station',
    location: `POINT(${lon} ${lat})`,
    zone: zone,
    is_hub: false, // 新站預設不是 Hub
    // Hub 需要手動指定並撰寫 Persona
    line_ids: station['odpt:railway'] ? [station['odpt:railway']] : [],
    source_dataset: 'odpt',
    metadata: {
      operator: station['odpt:operator'],
      station_code: station['odpt:stationCode']
    }
  };
});

return processed.map(p => ({ json: p }));
```

---

## 6. 工作流程 5：Trip Guard 警報 (event-trip-guard)

### 觸發條件
```
由 dynamic-status 工作流程呼叫
當 hasAlerts = true 時觸發
```

### 流程設計

```
[Webhook 接收異常資訊]
    ↓
[Supabase: 查詢訂閱該路線的用戶]
    ↓
[過濾]
    ├─ 時間條件（是否在用戶設定的監控時間內）
    └─ 冷卻時間（避免重複推播）
    ↓
[生成推播內容]
    ├─ 異常說明
    └─ 替代方案建議
    ↓
[LINE Messaging API: 推播]
    ↓
[Supabase: 記錄推播歷史]
```

### 推播冷卻邏輯

```javascript
// 避免同一路線短時間內重複推播

const COOLDOWN_MINUTES = 30;

async function shouldNotify(userId, railwayId) {
  const lastNotification = await $supabase
    .from('trip_subscriptions')
    .select('last_notified_at')
    .eq('user_id', userId)
    .contains('route_ids', [railwayId])
    .single();
  
  if (!lastNotification.data?.last_notified_at) {
    return true; // 從未推播過
  }
  
  const lastTime = new Date(lastNotification.data.last_notified_at);
  const cooldownEnd = new Date(lastTime.getTime() + COOLDOWN_MINUTES * 60 * 1000);
  
  return new Date() > cooldownEnd;
}
```

### LINE 推播訊息格式

```javascript
// Flex Message 格式

const createAlertMessage = (alert) => ({
  type: 'flex',
  altText: `🚨 ${alert.railway_name} 運行異常`,
  contents: {
    type: 'bubble',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#FF6B6B',
      contents: [
        { type: 'text', text: '🚨 運行異常通知', color: '#FFFFFF', weight: 'bold' }
      ]
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: alert.railway_name, weight: 'bold', size: 'xl' },
        { type: 'text', text: alert.status_text, wrap: true, margin: 'md' },
        { type: 'separator', margin: 'lg' },
        { type: 'text', text: '💡 BambiGO 建議', weight: 'bold', margin: 'lg' },
        { type: 'text', text: alert.suggestion, wrap: true, margin: 'sm' }
      ]
    },
    footer: {
      type: 'box',
      layout: 'horizontal',
      contents: [
        {
          type: 'button',
          style: 'primary',
          action: {
            type: 'uri',
            label: '查看替代路線',
            uri: `https://bambigo.app/route?from=${alert.context}`
          }
        }
      ]
    }
  }
});
```

---

## 7. 工作流程監控

### 每個工作流程應包含

```
[開始]
    ↓
[記錄開始時間]
    ↓
... 主要邏輯 ...
    ↓
[記錄結束時間 + 處理數量]
    ↓
[若有錯誤] → [Discord/Slack 通知]
```

### 監控 Webhook

```javascript
// Error Handler 節點

const error = $input.first().json;

const notification = {
  workflow: $workflow.name,
  error: error.message,
  timestamp: new Date().toISOString(),
  node: error.node || 'unknown'
};

// 發送到 Discord
await $http.post(process.env.DISCORD_WEBHOOK, {
  embeds: [{
    title: `🚨 n8n 工作流程錯誤`,
    description: `**${notification.workflow}** 執行失敗`,
    fields: [
      { name: '錯誤訊息', value: notification.error },
      { name: '節點', value: notification.node }
    ],
    color: 0xFF0000,
    timestamp: notification.timestamp
  }]
});
```

---

## 8. 環境變數

```env
# n8n 環境變數（設定在 Zeabur）

# ODPT API
ODPT_API_KEY=your_general_key
ODPT_CHALLENGE_KEY=your_challenge_key

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=your_service_key

# LINE Messaging API
LINE_CHANNEL_ACCESS_TOKEN=your_line_token

# 監控
DISCORD_WEBHOOK=https://discord.com/api/webhooks/xxx

# 時區
TZ=Asia/Tokyo
```

---

## 9. 工作流程建立順序

### MVP 必須（Phase 1）

1. `dynamic-status` - 運行狀態（核心功能）
2. `hourly-weather` - 天氣
3. `quarterly-static` - 車站數據（手動執行一次）

### Phase 2

4. `monthly-facilities` - OSM 設施
5. `event-trip-guard` - Trip Guard 推播

### Phase 3

6. GBFS 站點同步
7. GTFS 時刻表匯入

---

*本文件定義 n8n 工作流程設計，應與 DATA_STRATEGY.md 配合使用。*
