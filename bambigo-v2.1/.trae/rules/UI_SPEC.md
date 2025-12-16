# BambiGO PWA 介面規格書 (UI Specification)
# 版本：v2.0
# 設計原則：AI 對話為核心，UI 為輔助，優雅降級

---

## 🎯 本文件的使用方式

> **重要提醒給 AI 開發代理：**
> 
> 本文件的組件和頁面是「設計藍圖」，不是「完整規格」。
> 
> 你應該：
> 1. 理解每個設計決策的「為什麼」
> 2. 根據原則自行擴展未列出的細節
> 3. 保持設計語言的一致性
> 4. 所有 UI 都要考慮「三個圈層」的不同表現

---

## 1. 設計哲學

### 核心理念
```
「所有功能都能透過 AI 對話觸發，UI 提供快速入口」
```

### 互動模式優先順序
1. **AI 對話**（主要）：問任何問題，AI 理解並執行
2. **UI 快捷鍵**（輔助）：常用功能的一鍵觸發
3. **傳統導航**（備援）：底部 Tab 切換頁面

### Design Rationale
```
為什麼 AI 優先？
- 旅客不熟悉 App 的介面結構
- 自然語言是最直覺的互動方式
- 減少「找功能」的認知負擔

為什麼還需要 UI？
- 不是每個人都習慣打字
- 快捷按鈕可以減少輸入
- 視覺化資訊更容易瀏覽
```

---

## 2. 同心圓 UI 策略 ⭐ 重要

### 三圈層的 UI 差異

| 圈層 | 地圖顯示 | 節點標記 | Bottom Sheet | AI 能力 |
|------|---------|---------|--------------|--------|
| **核心圈** | 完整 + 彩色 | 大圖示 + 人格 | 完整三狀態 | 完整對話 |
| **緩衝圈** | 簡化 + 灰色 | 小圖示 + 基本 | 簡化兩狀態 | 純路線查詢 |
| **外部圈** | 極簡 | 無標記 | 降級提示 | 引導返回 |

### 視覺差異示意

```
核心圈節點：
┌─────────────┐
│  🚉 大圖示   │  ← 彩色、有陰影
│  上野站     │  ← 顯示名稱
│  ⚠️ 擁擠    │  ← 顯示狀態
└─────────────┘

緩衝圈節點：
┌───────┐
│  ○    │  ← 灰色小圓點
│ 新宿  │  ← 只有名稱
└───────┘

外部圈：
（無節點標記，只有底圖）
```

### 圈層切換時的 UI 反饋

```typescript
// 當用戶移動到不同圈層時

function onZoneChange(newZone: 'core' | 'buffer' | 'outer') {
  switch (newZone) {
    case 'core':
      // 不需要提示，這是正常狀態
      break;
      
    case 'buffer':
      showToast({
        message: '此區域僅提供基本導航',
        duration: 3000,
        action: { label: '了解更多', onClick: showZoneExplanation }
      });
      break;
      
    case 'outer':
      showModal({
        title: '超出服務範圍',
        message: 'BambiGO 目前專注於東京都心，這裡我還不太熟悉。',
        actions: [
          { label: '用 Google Maps', onClick: openGoogleMaps },
          { label: '返回東京都心', onClick: navigateToCore }
        ]
      });
      break;
  }
}
```

---

## 3. 頁面結構

### 頁面總覽

```
BambiGO PWA
├── 🗺️ 首頁 (Home) ← 預設頁面
├── 🦌 AI 對話 (Chat) ← 全螢幕覆蓋
├── 📍 節點詳情 (Node Detail) ← Push 頁面
├── 🔔 行程守護 (Trip Guard) ← Tab 頁面
└── ⚙️ 設定 (Settings) ← Tab 頁面
```

### Design Rationale
```
為什麼只有 5 個頁面？
- 旅客不需要複雜的功能架構
- 減少頁面 = 減少迷路
- 大部分需求透過 AI 對話解決

頁面的角色：
- 首頁：看地圖、看狀態、快速問 AI
- AI 對話：深度互動
- 節點詳情：看這個地方的完整資訊
- Trip Guard：管理訂閱（低頻使用）
- 設定：語系、無障礙（更低頻）
```

---

## 4. 頁面 1：首頁 (Home)

### 畫面結構

```
┌─────────────────────────────────┐
│  [狀態列]        [語系] [無障礙] │  ← 頂部固定
│  🌧️ 24°C  ⚡ 銀座線延誤          │
├─────────────────────────────────┤
│                                 │
│         🗺️ 地圖區域              │  ← 佔 60-85%
│         (Leaflet + OSM)         │
│                                 │
│            📍 節點標記            │
│                                 │
├────────── ═══════ ──────────────┤  ← Bottom Sheet
│  🚉 上野站                       │
│  JR・Metro | ⚠️ 擁擠             │
│  [🦌 問 BambiGO...]             │
└─────────────────────────────────┘
     🗺️      🔍      🔔      ⚙️      ← 底部導航
```

### Bottom Sheet 三狀態

#### 狀態 A：收合（預設，地圖最大化）

**高度**：約 120px

**顯示內容**：
- 當前節點圖示 + 名稱
- 1-2 個狀態標籤
- AI 輸入框提示（點擊展開）

**Design Rationale**：
```
為什麼預設收合？
- 用戶打開 App 通常是要「看地圖」
- 收合狀態讓地圖最大化
- 需要更多資訊時再上拉
```

#### 狀態 B：半展開（AI 建議）

**高度**：約 50% 畫面

**顯示內容**：
- 節點資訊（展開）
- AI 建議卡片（Primary）
- 替代方案（橫向滑動）

**觸發方式**：上拉 Bottom Sheet，或點擊 AI 輸入框

#### 狀態 C：全展開（完整資訊）

**高度**：約 85% 畫面

**顯示內容**：
- 所有半展開內容
- 快捷服務網格
- 「查看詳情」按鈕

### 核心圈 vs 緩衝圈的 Bottom Sheet

```typescript
// 根據圈層調整 Bottom Sheet 內容

interface BottomSheetContent {
  zone: 'core' | 'buffer' | 'outer';
  node: Node;
}

function renderBottomSheet({ zone, node }: BottomSheetContent) {
  if (zone === 'core') {
    return (
      <>
        <NodeHeader node={node} showPersona />
        <AIRecommendation />
        <ActionCards />
        <QuickServices />
      </>
    );
  }
  
  if (zone === 'buffer') {
    return (
      <>
        <NodeHeader node={node} showPersona={false} />
        <SimplifiedRouteSearch />
        <BufferZoneNotice />  {/* "此區域僅提供基本導航" */}
      </>
    );
  }
  
  // outer
  return <OuterZoneFallback />;
}
```

---

## 5. 頁面 2：AI 對話 (Chat)

### 畫面結構

```
┌─────────────────────────────────┐
│  [←]  🦌 BambiGO        [清除]  │
├─────────────────────────────────┤
│                                 │
│  ┌─────────────────────────┐   │
│  │ 你好！我是 BambiGO 🦌    │   │  ← AI 訊息
│  │ 你在上野站...           │   │
│  └─────────────────────────┘   │
│                                 │
│       ┌─────────────────────┐   │
│       │ 我想去淺草寺        │   │  ← 用戶訊息
│       └─────────────────────┘   │
│                                 │
│  ┌─────────────────────────┐   │
│  │ 好的！                  │   │
│  │ ┌─────────────────────┐ │   │  ← 內嵌卡片
│  │ │ 🚃 銀座線 → 淺草     │ │   │
│  │ │ 8 分鐘 | ¥180       │ │   │
│  │ │ [開始導航]          │ │   │
│  │ └─────────────────────┘ │   │
│  └─────────────────────────┘   │
│                                 │
├─────────────────────────────────┤
│  [🏠 回家] [🍜 吃飯] [♿ 無障礙] │  ← 快速回覆
├─────────────────────────────────┤
│  [🎤]  [輸入訊息...]    [➤]    │
└─────────────────────────────────┘
```

### AI 可理解的意圖

| 用戶說的話 | AI 理解為 | 執行動作 |
|-----------|----------|---------|
| 我想去淺草寺 | route_search | 顯示路線卡片 |
| 附近有廁所嗎 | facility_search | 顯示設施列表 |
| 這站有什麼特色 | node_info | 顯示節點人格 |
| 銀座線還在延誤嗎 | status_query | 查詢 L2 狀態 |
| 幫我訂閱山手線 | trip_guard | 開啟訂閱流程 |
| 切換日文 | settings | 切換語系 |
| 我在新宿 | location_update | 更新位置（緩衝圈提示）|

### 緩衝圈的 AI 回應

```typescript
// 當用戶在緩衝圈問問題

if (userZone === 'buffer') {
  if (intent === 'facility_search') {
    return {
      type: 'text',
      content: '抱歉，我對新宿的設施還不太熟悉 😅\n' +
               '但我可以幫你查怎麼去上野或淺草，那邊我很熟！\n' +
               '或者你可以試試 Google Maps 找附近設施。',
      actions: [
        { label: '查路線去上野', action: 'route_to_ueno' },
        { label: '開啟 Google Maps', action: 'open_google_maps' }
      ]
    };
  }
  
  if (intent === 'route_search') {
    // 緩衝圈可以查路線
    return routeSearchResult;
  }
}
```

### 快速回覆按鈕

```typescript
// 根據情境動態調整快速回覆

function getQuickReplies(context: Context): QuickReply[] {
  const base = [
    { icon: '🏠', text: '我要回家' },
    { icon: '🍜', text: '想吃飯' },
  ];
  
  // 如果是車站，加入相關選項
  if (context.nodeType === 'station') {
    base.push({ icon: '🚻', text: '找廁所' });
    base.push({ icon: '🧳', text: '寄放行李' });
  }
  
  // 如果有無障礙需求
  if (context.accessibilityMode) {
    base.unshift({ icon: '♿', text: '無障礙路線' });
  }
  
  // 如果在緩衝圈
  if (context.zone === 'buffer') {
    base.push({ icon: '📍', text: '回到東京都心' });
  }
  
  return base.slice(0, 4); // 最多 4 個
}
```

---

## 6. 頁面 3：節點詳情 (Node Detail)

### 畫面結構（核心圈）

```
┌─────────────────────────────────┐
│  [←]  上野站            [分享]  │
├─────────────────────────────────┤
│      🚉                        │
│    上野站                       │
│  Ueno Station                   │
│  ━━━━━━━━━━━━━━━━               │
│  🏛️ 歷史文化 | 🛒 購物           │  ← L1 標籤
├─────────────────────────────────┤
│  📖 關於這個地方                │  ← 節點人格
│  「上野是東京的北玄關...」       │
├─────────────────────────────────┤
│  📊 現在的狀況                  │  ← L2 狀態
│  [⚠️ 正面口擁擠] [✓ 公園口順暢] │
│  [🚃 銀座線延誤 5 分]           │
├─────────────────────────────────┤
│  🏪 周邊設施                    │  ← L3 設施
│  [🚻 廁所 x3] [🧳 置物櫃 x5]    │
│  → 查看所有設施                 │
├─────────────────────────────────┤
│  [🦌 問 BambiGO 關於這裡...]    │  ← AI 入口
└─────────────────────────────────┘
```

### 緩衝圈的節點詳情（簡化版）

```
┌─────────────────────────────────┐
│  [←]  新宿站            [分享]  │
├─────────────────────────────────┤
│      ○                         │  ← 簡化圖示
│    新宿站                       │
│  Shinjuku Station               │
├─────────────────────────────────┤
│  📊 運行狀態                    │  ← 只有 L2
│  [✓ 正常運行]                  │
├─────────────────────────────────┤
│  ℹ️ 此區域僅提供基本資訊         │
│                                 │
│  想看更多？                      │
│  [去上野看看] [去淺草看看]       │
└─────────────────────────────────┘
```

### Design Rationale
```
為什麼緩衝圈要簡化？
- 我們沒有 L3 設施數據
- 沒有撰寫 Persona
- 硬撐只會顯示「無資料」，體驗更差

誠實 > 裝熟：
- 承認「這裡我不熟」
- 提供替代方案（去核心圈）
- 用戶會感謝誠實
```

---

## 7. 降級模式 UI

### 外部圈進入時的 Modal

```
┌─────────────────────────────────┐
│                                 │
│        🦌                       │
│                                 │
│   超出服務範圍                   │
│                                 │
│   BambiGO 目前專注於東京都心，    │
│   這裡我還不太熟悉。             │
│                                 │
│   但別擔心，我可以：             │
│                                 │
│   ┌───────────────────────────┐ │
│   │  🗺️ 用 Google Maps 繼續   │ │
│   └───────────────────────────┘ │
│                                 │
│   ┌───────────────────────────┐ │
│   │  🚃 規劃回東京都心的路線   │ │
│   └───────────────────────────┘ │
│                                 │
│         [稍後再說]              │
│                                 │
└─────────────────────────────────┘
```

### Google Maps Deep Link

```typescript
// 生成 Google Maps Deep Link

function openGoogleMaps(destination?: { lat: number; lon: number; name: string }) {
  let url = 'https://www.google.com/maps';
  
  if (destination) {
    url += `/search/?api=1&query=${encodeURIComponent(destination.name)}`;
  }
  
  // 優先使用 App（如果有安裝）
  const iosUrl = url.replace('https://www.google.com/maps', 'comgooglemaps://');
  const androidUrl = `intent://maps.google.com/maps?${url.split('?')[1]}#Intent;scheme=https;package=com.google.android.apps.maps;end`;
  
  // 檢測平台並開啟
  if (isIOS()) {
    window.location.href = iosUrl;
    setTimeout(() => window.location.href = url, 500); // fallback
  } else if (isAndroid()) {
    window.location.href = androidUrl;
  } else {
    window.open(url, '_blank');
  }
}
```

---

## 8. 共用組件設計

### Action Card（行動建議卡片）

```typescript
interface ActionCard {
  type: 'transit' | 'taxi' | 'bike' | 'walk';
  title: string;
  subtitle: string;
  duration: number;      // 分鐘
  price?: number;        // 日圓
  deeplink?: string;
  isRecommended: boolean;
  zone: 'core' | 'buffer';  // 只在核心圈顯示完整，緩衝圈簡化
}
```

### 組件視覺規格

```
核心圈 Action Card：
┌─────────────────────────────┐
│  🚃  銀座線 → 淺草          │
│      下一班 3 分鐘後        │
│  ────────────────────────  │
│  8 分鐘          ¥180      │
│           [開始導航]       │
└─────────────────────────────┘

緩衝圈 Action Card（簡化）：
┌─────────────────────────────┐
│  🚃  山手線 → 上野          │
│  約 15 分鐘    ¥200         │
└─────────────────────────────┘
```

### 狀態標籤 (Status Pill)

```typescript
interface StatusPill {
  type: 'weather' | 'alert' | 'crowded' | 'normal' | 'info';
  icon: string;
  text: string;
  severity: 'info' | 'warning' | 'error';
}

// 顏色對應
const severityColors = {
  info: { bg: '#EEF2FF', text: '#4F46E5' },
  warning: { bg: '#FEF3C7', text: '#D97706' },
  error: { bg: '#FEE2E2', text: '#DC2626' }
};
```

---

## 9. 響應式與無障礙

### 無障礙模式

```typescript
// 無障礙模式的調整

const accessibilityStyles = {
  fontSize: {
    normal: '14px',
    accessible: '18px'
  },
  contrast: {
    normal: { text: '#374151', bg: '#FFFFFF' },
    accessible: { text: '#000000', bg: '#FFFFFF' }
  },
  touchTarget: {
    normal: '44px',
    accessible: '56px'
  }
};
```

### 語系切換

```typescript
// 即時切換，不需要重新載入

function setLocale(locale: 'zh-TW' | 'ja' | 'en') {
  // 更新 state
  useAppStore.setState({ locale });
  
  // 更新 HTML lang 屬性
  document.documentElement.lang = locale;
  
  // 儲存偏好
  localStorage.setItem('bambigo_locale', locale);
}
```

---

## 10. 給 Trae 的實作指引

### 組件開發順序

```
Phase 1：
1. MapContainer（地圖 + 節點標記）
2. BottomSheet（三狀態切換）
3. StatusPill（狀態標籤）
4. 圈層偵測邏輯

Phase 2：
5. ChatWindow（AI 對話）
6. ActionCard（行動建議）
7. QuickReplies（快速回覆）

Phase 3：
8. NodeDetail（節點詳情頁）
9. TripGuard（訂閱管理）
10. Settings（設定頁）
```

### 關鍵原則

```
1. 每個組件都要考慮「三個圈層」的表現
2. 核心圈 = 完整功能
3. 緩衝圈 = 簡化功能 + 誠實提示
4. 外部圈 = 優雅降級 + 外部連結
5. 永遠給用戶一條路（不能變磚塊）
```

---

*本文件定義 BambiGO PWA 的介面規格，應與 project_rules.md 的設計原則配合使用。*
