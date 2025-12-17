# BambiGO AI 混合架構規格書 (AI Architecture)
# 版本：v1.1
# 核心原則：能不用 LLM 就不用，能用規則就用規則

---

## 🚨 Data Origin Constraint (資料來源鐵律)

> **這是最重要的架構約束，違反會導致嚴重效能問題！**

### Static Nature (靜態本質)

```
⚠️ 關鍵認知：

L1 標籤（如 #購物天堂、#美食激戰區、category_counts）是「冷數據 (Cold Data)」

它們：
❌ 不是即時計算的 (NOT calculated at runtime)
❌ 不是用戶打開 App 時動態生成的
❌ 不需要在地圖載入時呼叫 Overpass API

它們：
✅ 是預先算好的 (Pre-calculated)
✅ 是靜態寫死在資料庫的
✅ 跟車站名稱一樣，直接 SELECT 就好
```

### Generation Workflow (生成流程)

```
L1 標籤的生命週期：

┌─────────────────────────────────────────────────────────┐
│  開發/維護階段（每季執行一次）                            │
│  ═══════════════════════════════════════════════════   │
│                                                         │
│  [n8n Batch Job]                                        │
│       │                                                 │
│       ▼                                                 │
│  Step 1: 呼叫 Overpass API，取得 OSM 數據               │
│       │                                                 │
│       ▼                                                 │
│  Step 2: 計算每個節點周邊 50m 的設施統計                 │
│       │  (這裡才做計算！)                                │
│       ▼                                                 │
│  Step 3: 寫入 Supabase node_facility_profiles 表        │
│       │  (Hard-write，不是 Cache)                       │
│       ▼                                                 │
│  完成。直到下一季才會再執行。                            │
│                                                         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  App 執行階段（用戶使用時）                              │
│  ═══════════════════════════════════════════════════   │
│                                                         │
│  [用戶打開地圖]                                          │
│       │                                                 │
│       ▼                                                 │
│  SELECT * FROM nodes                                    │
│  JOIN node_facility_profiles ON ...                     │
│       │                                                 │
│       ▼                                                 │
│  直接顯示 category_counts 和 vibe_tags                  │
│                                                         │
│  ⚠️ 這裡不做任何計算！                                   │
│  ⚠️ 不呼叫任何外部 API！                                 │
│  ⚠️ 就跟讀取車站名稱一樣簡單！                           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Runtime Behavior (執行時行為)

```typescript
// ✅ 正確做法：直接讀取預先計算好的數據
async function getNodeWithProfile(nodeId: string) {
  const { data } = await supabase
    .from('nodes')
    .select(`
      *,
      facility_profile:node_facility_profiles(
        category_counts,
        vibe_tags,
        dominant_category
      )
    `)
    .eq('id', nodeId)
    .single();
  
  return data;  // 直接返回，零計算
}

// ❌ 錯誤做法：即時計算（絕對禁止！）
async function getNodeWithProfile_WRONG(nodeId: string) {
  const node = await getNode(nodeId);
  
  // ❌ 錯！不要在這裡呼叫 Overpass！
  const pois = await fetchOverpassAPI(node.lat, node.lon, 50);
  
  // ❌ 錯！不要在這裡計算！
  const counts = calculateCategoryCounts(pois);
  
  return { ...node, counts };
}
```

### 給 Trae 的明確指令

```
🔴 禁止事項：

1. 禁止在 App 啟動時計算 L1 標籤
2. 禁止在地圖載入時呼叫 Overpass API
3. 禁止在用戶互動時動態生成 vibe_tags
4. 禁止把 L1 標籤計算邏輯放在前端或 API Route

🟢 正確做法：

1. L1 標籤計算只存在於 n8n 工作流程或 scripts/ 資料夾
2. App 內只做 SELECT 查詢
3. 把 node_facility_profiles 當作靜態表讀取
4. 任何需要「計算」的邏輯都應該是離線批次處理
```

---

## 🎯 本文件的使用方式

> **重要提醒給 AI 開發代理：**
> 
> BambiGO 採用「三層 AI 混合架構」，不是所有任務都丟給 LLM。
> 
> 開發時必須判斷每個功能屬於哪一層：
> 1. **Rule-based**（60%）：確定性任務，寫邏輯就好
> 2. **SLM**（30%）：需要一點智慧，但模式固定
> 3. **LLM**（10%）：真正需要「思考」的複雜任務
> 
> 錯誤的層級選擇 = 浪費成本 + 增加延遲 + 降低可控性

---

## 1. 架構總覽

### 三層職責定義

```
┌─────────────────────────────────────────────────────────┐
│                    LLM Layer (10%)                       │
│                   「CEO / 顧問」                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │ • 複雜多條件推理                                  │    │
│  │ • 節點人格對話（創意生成）                        │    │
│  │ • 模糊意圖理解                                    │    │
│  │ • 情緒處理與同理心回應                            │    │
│  │ • 異常情況判斷                                    │    │
│  └─────────────────────────────────────────────────┘    │
│  技術：Gemini 1.5 Flash / Claude 3 Haiku                 │
│  延遲：1-3 秒 | 成本：$0.001-0.01/次                      │
├─────────────────────────────────────────────────────────┤
│                    SLM Layer (30%)                       │
│                   「經理 / 專員」                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │ • 意圖分類 (Intent Classification)               │    │
│  │ • 實體抽取 (NER: 地點、時間、條件)               │    │
│  │ • 簡單文本生成（模板填充）                        │    │
│  │ • 語言偵測與翻譯路由                              │    │
│  │ • 情緒分類（正面/中性/負面）                      │    │
│  └─────────────────────────────────────────────────┘    │
│  技術：Gemma 2B / Phi-3 Mini / 本地部署                  │
│  延遲：50-200ms | 成本：趨近 $0（自建）                   │
├─────────────────────────────────────────────────────────┤
│                 Rule-based Layer (60%)                   │
│                   「作業標準 / SOP」                      │
│  ┌─────────────────────────────────────────────────┐    │
│  │ • 資料查詢（L2 狀態、設施搜尋）                   │    │
│  │ • 格式轉換（時間、票價、距離）                    │    │
│  │ • 圈層判定（Zone Detection）                     │    │
│  │ • 關鍵字匹配（快速意圖判斷）                      │    │
│  │ • 模板回應（固定句型）                            │    │
│  │ • 商業規則（導流優先順序）                        │    │
│  │ • 合規檢查（內容安全）                            │    │
│  └─────────────────────────────────────────────────┘    │
│  技術：TypeScript 邏輯 / 正則表達式 / 決策樹             │
│  延遲：<10ms | 成本：$0                                  │
└─────────────────────────────────────────────────────────┘
```

### Design Rationale

```
為什麼要三層而非全用 LLM？

成本考量：
- LLM API 按 token 計費
- 假設每天 10,000 次對話
- 全用 LLM：$100-300/月
- 混合架構：$10-30/月（節省 90%）

延遲考量：
- LLM：1-3 秒回應
- SLM：100-200ms
- Rule：<10ms
- 用戶期待「即時感」，簡單查詢等 3 秒會失去耐心

可控性考量：
- LLM 可能「幻覺」或「自由發揮」
- Rule-based 100% 可預測
- 涉及商業導流時，不能讓 AI 亂推薦

可用性考量：
- LLM API 可能掛掉或超時
- Rule-based 永遠可用
- SLM 本地部署也不受外部影響
```

---

## 2. 任務路由器 (Intent Router)

### 路由流程

```
用戶輸入
    │
    ▼
┌─────────────────────┐
│  1. 快速規則匹配     │  ← 關鍵字、正則
│     (Rule-based)    │
└──────────┬──────────┘
           │ 無法匹配
           ▼
┌─────────────────────┐
│  2. SLM 意圖分類     │  ← 本地模型
│     + 實體抽取       │
└──────────┬──────────┘
           │ 意圖明確
           ▼
┌─────────────────────┐
│  3. 執行對應處理     │
│  - 簡單 → Rule      │
│  - 中等 → SLM       │
│  - 複雜 → LLM       │
└─────────────────────┘
```

### 路由規則定義

```typescript
// lib/ai/intentRouter.ts

interface RouteResult {
  layer: 'rule' | 'slm' | 'llm';
  intent: string;
  entities: Record<string, any>;
  confidence: number;
}

// 第一層：快速規則匹配
const QUICK_PATTERNS: Record<string, { pattern: RegExp; intent: string }[]> = {
  // 狀態查詢 → Rule-based
  status_query: [
    { pattern: /(.+線|.+ライン).*(延誤|遅延|状況|狀態|還在|まだ)/i, intent: 'line_status' },
    { pattern: /(現在|今).*(擁擠|混雑|人多|混んで)/i, intent: 'crowding_status' },
    { pattern: /天氣|weather|天気/i, intent: 'weather_status' },
  ],
  
  // 設施查詢 → Rule-based
  facility_query: [
    { pattern: /(廁所|トイレ|toilet|洗手間)/i, intent: 'find_toilet' },
    { pattern: /(置物櫃|ロッカー|locker|寄放)/i, intent: 'find_locker' },
    { pattern: /(ATM|提款機)/i, intent: 'find_atm' },
    { pattern: /(充電|チャージ|charge)/i, intent: 'find_charging' },
  ],
  
  // 路線查詢 → SLM（需要抽取地點）
  route_query: [
    { pattern: /(想去|要去|去|到|how to get|行きたい|への行き方)/i, intent: 'route_search' },
    { pattern: /(怎麼走|怎么走|どう行く|how do i)/i, intent: 'route_search' },
  ],
  
  // 系統指令 → Rule-based
  system_command: [
    { pattern: /(切換|切替|switch).*(語言|言語|language|中文|日文|英文)/i, intent: 'change_language' },
    { pattern: /(訂閱|subscribe|通知)/i, intent: 'trip_guard' },
  ],
};

// 需要升級到 LLM 的情況
const LLM_TRIGGERS = [
  // 多條件組合
  /(.+)(而且|並且|同時|还要|また).+/i,
  // 帶有特殊需求
  /(輪椅|wheelchair|車椅子|無障礙|バリアフリー)/i,
  /(小孩|子供|baby|嬰兒|ベビーカー)/i,
  /(行李|大件|荷物|luggage)/i,
  // 情緒表達
  /(急|趕|焦|緊急|ヤバい|困った|help)/i,
  // 開放式問題
  /(推薦|建議|おすすめ|suggest|哪裡好|どこがいい)/i,
  // 節點人格對話
  /(這裡|這站|ここ).*(特色|故事|歷史|什麼樣)/i,
];

export function routeIntent(input: string): RouteResult {
  // Step 1: 快速規則匹配
  for (const [category, patterns] of Object.entries(QUICK_PATTERNS)) {
    for (const { pattern, intent } of patterns) {
      if (pattern.test(input)) {
        return {
          layer: 'rule',
          intent,
          entities: extractEntitiesByRule(input, intent),
          confidence: 0.95,
        };
      }
    }
  }
  
  // Step 2: 檢查是否需要 LLM
  for (const trigger of LLM_TRIGGERS) {
    if (trigger.test(input)) {
      return {
        layer: 'llm',
        intent: 'complex_query',
        entities: {},
        confidence: 0.7,
      };
    }
  }
  
  // Step 3: 交給 SLM 分類
  return {
    layer: 'slm',
    intent: 'pending_classification',
    entities: {},
    confidence: 0,
  };
}
```

---

## 3. 各層詳細設計

### 3.1 Rule-based Layer

#### 適用任務

| 任務 | 輸入 | 處理方式 | 輸出 |
|------|------|---------|------|
| 路線狀態查詢 | 「銀座線延誤嗎」 | 查 L2 Cache | 模板回應 |
| 設施搜尋 | 「找廁所」 | 查 Facilities 表 | 設施列表 |
| 天氣查詢 | 「今天天氣」 | 查 L2 Cache | 模板回應 |
| 圈層判定 | GPS 座標 | Zone Detector | core/buffer/outer |
| 語系切換 | 「切換日文」 | 更新 State | 確認訊息 |
| 格式化 | 時間、票價 | Format 函數 | 格式化字串 |

#### 模板回應系統

```typescript
// lib/ai/templates.ts

interface TemplateContext {
  locale: 'zh-TW' | 'ja' | 'en';
  data: Record<string, any>;
}

const TEMPLATES = {
  line_status_normal: {
    'zh-TW': '{{lineName}}目前正常運行 ✓',
    'ja': '{{lineName}}は現在、平常運転です ✓',
    'en': '{{lineName}} is operating normally ✓',
  },
  
  line_status_delayed: {
    'zh-TW': '⚠️ {{lineName}}目前有延誤，預計影響約 {{delayMinutes}} 分鐘。\n\n{{suggestion}}',
    'ja': '⚠️ {{lineName}}は現在、約{{delayMinutes}}分の遅延が発生しています。\n\n{{suggestion}}',
    'en': '⚠️ {{lineName}} is currently delayed by approximately {{delayMinutes}} minutes.\n\n{{suggestion}}',
  },
  
  facility_found: {
    'zh-TW': '在{{nodeName}}附近找到 {{count}} 個{{facilityType}}：',
    'ja': '{{nodeName}}付近に{{count}}件の{{facilityType}}があります：',
    'en': 'Found {{count}} {{facilityType}} near {{nodeName}}:',
  },
  
  facility_not_found: {
    'zh-TW': '抱歉，{{nodeName}}附近沒有找到{{facilityType}}。\n要不要試試其他站？',
    'ja': '申し訳ありません、{{nodeName}}付近に{{facilityType}}が見つかりませんでした。\n他の駅を試してみますか？',
    'en': 'Sorry, no {{facilityType}} found near {{nodeName}}.\nWould you like to try another station?',
  },
  
  zone_buffer_notice: {
    'zh-TW': '你目前在{{areaName}}，這裡我還不太熟悉，但可以幫你查基本路線資訊。',
    'ja': '現在{{areaName}}にいますね。ここはまだ詳しくないですが、基本的なルート情報は調べられます。',
    'en': "You're currently in {{areaName}}. I'm not very familiar with this area yet, but I can help with basic route info.",
  },
  
  zone_outer_fallback: {
    'zh-TW': '這裡超出 BambiGO 的服務範圍了 🦌\n\n要不要用 Google Maps 繼續，或者我幫你規劃回東京都心的路線？',
    'ja': 'ここはBambiGOのサービスエリア外です 🦌\n\nGoogle Mapsで続けますか？それとも東京都心への戻り方を調べましょうか？',
    'en': "This is outside BambiGO's service area 🦌\n\nWould you like to continue with Google Maps, or shall I help you get back to central Tokyo?",
  },
};

export function renderTemplate(
  templateKey: string,
  context: TemplateContext
): string {
  const template = TEMPLATES[templateKey]?.[context.locale];
  if (!template) {
    return TEMPLATES[templateKey]?.['en'] || 'Template not found';
  }
  
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return context.data[key] ?? `{{${key}}}`;
  });
}
```

#### 商業規則引擎

```typescript
// lib/ai/businessRules.ts

interface CommercialRecommendation {
  provider: string;
  priority: number;
  reason: string;
  deeplink: string;
}

// 導流優先順序規則
export function getCommercialRecommendations(
  context: {
    hasDelay: boolean;
    isCrowded: boolean;
    isRaining: boolean;
    hasLuggage: boolean;
    isAccessibility: boolean;
    distance: number;  // 公尺
  }
): CommercialRecommendation[] {
  const recommendations: CommercialRecommendation[] = [];
  
  // 規則 1: 永遠先推薦公共交通（除非有問題）
  if (!context.hasDelay && !context.isCrowded) {
    recommendations.push({
      provider: 'public_transit',
      priority: 1,
      reason: '正常運行中',
      deeplink: '',
    });
  }
  
  // 規則 2: 有延誤或擁擠 + 距離 < 2km → 推薦 LUUP
  if ((context.hasDelay || context.isCrowded) && context.distance < 2000 && !context.isRaining) {
    recommendations.push({
      provider: 'luup',
      priority: 2,
      reason: '避開擁擠，騎車更快',
      deeplink: 'https://luup.sc/',
    });
  }
  
  // 規則 3: 下雨或有大行李 → 推薦計程車
  if (context.isRaining || context.hasLuggage) {
    recommendations.push({
      provider: 'go_taxi',
      priority: 2,
      reason: context.isRaining ? '雨天搭車更舒適' : '行李太多搭車方便',
      deeplink: 'https://go.mo-t.com/',
    });
  }
  
  // 規則 4: 有行李需求 → 推薦寄放
  if (context.hasLuggage) {
    recommendations.push({
      provider: 'ecbo_cloak',
      priority: 3,
      reason: '附近有寄放點',
      deeplink: 'https://cloak.ecbo.io/',
    });
  }
  
  // 規則 5: 無障礙需求 → 只推薦有無障礙的選項
  if (context.isAccessibility) {
    return recommendations.filter(r => 
      r.provider === 'go_taxi' || r.provider === 'public_transit'
    );
  }
  
  return recommendations.sort((a, b) => a.priority - b.priority);
}
```

---

### 3.2 SLM Layer

#### 適用任務

| 任務 | 輸入 | 模型 | 輸出 |
|------|------|------|------|
| 意圖分類 | 用戶完整輸入 | Gemma 2B | Intent ID + 信心度 |
| 地點實體抽取 | 「我想去淺草」 | Gemma 2B | `{ destination: "淺草" }` |
| 時間實體抽取 | 「明天下午三點」 | Gemma 2B | `{ time: "2024-01-16T15:00" }` |
| 情緒分類 | 用戶輸入 | Phi-3 Mini | positive/neutral/negative |
| 簡單句子生成 | 結構化數據 | Gemma 2B | 自然語言句子 |

#### SLM 技術選型

| 模型 | 參數量 | 延遲 | 部署方式 | 適用場景 |
|------|-------|------|---------|---------|
| **Gemma 2B** | 2B | 50-100ms | Ollama / HuggingFace | 意圖分類、NER |
| **Phi-3 Mini** | 3.8B | 100-200ms | Ollama | 稍複雜的生成 |
| **Qwen2 1.5B** | 1.5B | 30-80ms | Ollama | 中文優化 |

#### MVP 建議：使用 Ollama 本地部署

```bash
# 安裝 Ollama
curl -fsSL https://ollama.com/install.sh | sh

# 下載模型
ollama pull gemma2:2b
ollama pull phi3:mini
```

#### SLM 呼叫封裝

```typescript
// lib/ai/slm.ts

interface SLMConfig {
  baseUrl: string;  // Ollama API
  model: string;
  timeout: number;
}

const DEFAULT_CONFIG: SLMConfig = {
  baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  model: 'gemma2:2b',
  timeout: 5000,
};

// 意圖分類
export async function classifyIntent(
  input: string,
  config: SLMConfig = DEFAULT_CONFIG
): Promise<{ intent: string; confidence: number }> {
  const prompt = `
你是一個意圖分類器。根據用戶輸入，判斷屬於以下哪個意圖：

可能的意圖：
- route_search: 想知道怎麼去某個地方
- facility_search: 想找某種設施（廁所、置物櫃等）
- status_query: 想知道交通狀況
- node_info: 想了解某個地點的資訊
- trip_guard: 想訂閱通知
- general_chat: 一般閒聊
- unclear: 無法判斷

用戶輸入：「${input}」

只回答意圖名稱，不要解釋。
`.trim();

  const response = await fetch(`${config.baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      prompt,
      stream: false,
      options: { temperature: 0.1 },  // 低溫度 = 更確定
    }),
  });

  const data = await response.json();
  const intentRaw = data.response?.trim().toLowerCase();
  
  // 驗證是否為有效意圖
  const validIntents = [
    'route_search', 'facility_search', 'status_query',
    'node_info', 'trip_guard', 'general_chat', 'unclear'
  ];
  
  const intent = validIntents.includes(intentRaw) ? intentRaw : 'unclear';
  const confidence = intent === 'unclear' ? 0.3 : 0.85;
  
  return { intent, confidence };
}

// 實體抽取
export async function extractEntities(
  input: string,
  intent: string,
  config: SLMConfig = DEFAULT_CONFIG
): Promise<Record<string, any>> {
  const prompt = `
從以下句子中抽取實體資訊，以 JSON 格式回答。

意圖類型：${intent}
用戶輸入：「${input}」

${intent === 'route_search' ? `
需要抽取：
- origin: 出發地（如果有提到）
- destination: 目的地
- time: 時間（如果有提到）
- preferences: 特殊需求（無障礙、避開人潮等）
` : ''}

${intent === 'facility_search' ? `
需要抽取：
- facility_type: 設施類型（toilet, locker, atm, convenience, charging）
- location: 位置（如果有提到）
- requirements: 特殊需求（無障礙、免費等）
` : ''}

只回答 JSON，不要解釋。如果某項沒有提到，不要包含該欄位。
`.trim();

  const response = await fetch(`${config.baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      prompt,
      stream: false,
      options: { temperature: 0.1 },
    }),
  });

  const data = await response.json();
  
  try {
    // 嘗試解析 JSON
    const jsonMatch = data.response?.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('Entity extraction failed:', e);
  }
  
  return {};
}

// 簡單文本生成（模板增強）
export async function enhanceTemplate(
  template: string,
  context: Record<string, any>,
  config: SLMConfig = DEFAULT_CONFIG
): Promise<string> {
  const prompt = `
將以下模板轉換為更自然的對話語氣，保持原意但讓它聽起來更友善：

原始模板：「${template}」
上下文資訊：${JSON.stringify(context)}

只回答轉換後的句子，不要解釋。
`.trim();

  const response = await fetch(`${config.baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      prompt,
      stream: false,
      options: { temperature: 0.7 },  // 稍高溫度 = 更自然
    }),
  });

  const data = await response.json();
  return data.response?.trim() || template;
}
```

---

### 3.3 LLM Layer

#### 適用任務

| 任務 | 觸發條件 | 模型 | 範例 |
|------|---------|------|------|
| 複雜多條件推理 | 多個 AND/OR 條件 | Gemini Flash | 「帶輪椅奶奶，下雨，想去淺草吃飯」 |
| 節點人格對話 | 詢問節點故事/特色 | Gemini Flash | 「跟我說說上野站的故事」 |
| 情緒處理 | 偵測到負面情緒 | Claude Haiku | 「我好焦慮，完全不知道怎麼辦」 |
| 模糊意圖理解 | SLM 信心度 < 0.6 | Gemini Flash | 「那個...就是那個地方」 |
| 創意建議生成 | 開放式問題 | Gemini Flash | 「推薦我一個適合約會的地方」 |

#### LLM 技術選型

| 模型 | 延遲 | 成本 | 適用場景 |
|------|------|------|---------|
| **Gemini 1.5 Flash** | 1-2s | $0.075/1M tokens | 主要 LLM，性價比高 |
| **Claude 3 Haiku** | 1-2s | $0.25/1M tokens | 情緒處理、同理心 |
| **GPT-4o Mini** | 1-2s | $0.15/1M tokens | 備援選項 |

#### MVP 建議：Gemini 1.5 Flash via Dify

```typescript
// lib/ai/llm.ts

interface LLMConfig {
  provider: 'dify' | 'direct';
  apiKey: string;
  baseUrl: string;
}

const DIFY_CONFIG: LLMConfig = {
  provider: 'dify',
  apiKey: process.env.DIFY_API_KEY!,
  baseUrl: process.env.DIFY_BASE_URL || 'https://api.dify.ai/v1',
};

// 複雜查詢處理
export async function handleComplexQuery(
  input: string,
  context: {
    currentNode?: string;
    zone: 'core' | 'buffer' | 'outer';
    locale: string;
    userPreferences?: Record<string, any>;
    l2Status?: Record<string, any>;
  }
): Promise<{
  response: string;
  actionCards?: ActionCard[];
  followUp?: string[];
}> {
  const systemPrompt = buildSystemPrompt(context);
  
  const response = await fetch(`${DIFY_CONFIG.baseUrl}/chat-messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DIFY_CONFIG.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: {
        current_node: context.currentNode,
        zone: context.zone,
        l2_status: JSON.stringify(context.l2Status),
      },
      query: input,
      user: 'bambigo-user',
      response_mode: 'blocking',
    }),
  });

  const data = await response.json();
  
  return {
    response: data.answer,
    actionCards: parseActionCards(data.answer),
    followUp: parseFollowUp(data.answer),
  };
}

// 節點人格對話
export async function handlePersonaChat(
  input: string,
  nodeId: string,
  personaPrompt: string,
  context: { locale: string }
): Promise<string> {
  const prompt = `
${personaPrompt}

用戶問：「${input}」

請用這個節點的人格來回答，保持親切但有特色的語氣。
回答語言：${context.locale === 'zh-TW' ? '繁體中文' : context.locale === 'ja' ? '日文' : '英文'}
`.trim();

  const response = await fetch(`${DIFY_CONFIG.baseUrl}/chat-messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DIFY_CONFIG.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: {},
      query: prompt,
      user: 'bambigo-user',
      response_mode: 'blocking',
    }),
  });

  const data = await response.json();
  return data.answer;
}

function buildSystemPrompt(context: any): string {
  return `
你是 BambiGO，一個有同理心的城市導航助手。

你的特點：
- 不只給路線，還給「建議」
- 理解旅客的焦慮，提供解決方案
- 永遠給出「單一最佳建議」，不讓用戶選擇困難

當前情境：
- 用戶位置：${context.currentNode || '未知'}
- 服務圈層：${context.zone}
- 即時狀態：${JSON.stringify(context.l2Status)}

回應規則：
1. 如果在核心圈：提供完整建議
2. 如果在緩衝圈：只提供基本路線，誠實說「這裡我不熟」
3. 如果在外部圈：建議使用 Google Maps

輸出格式：
- 先給建議
- 如果有替代方案，用「或者...」帶過
- 最後可以問一個 follow-up 問題
`.trim();
}
```

---

## 4. 完整處理流程

### 4.1 主處理器

```typescript
// lib/ai/processor.ts

import { routeIntent } from './intentRouter';
import { classifyIntent, extractEntities } from './slm';
import { handleComplexQuery, handlePersonaChat } from './llm';
import { renderTemplate } from './templates';
import { getCommercialRecommendations } from './businessRules';

interface ProcessResult {
  response: string;
  actionCards?: ActionCard[];
  followUp?: string[];
  processingLayer: 'rule' | 'slm' | 'llm';
  latencyMs: number;
}

export async function processUserInput(
  input: string,
  context: AppContext
): Promise<ProcessResult> {
  const startTime = Date.now();
  
  // Step 1: 快速路由
  const route = routeIntent(input);
  
  // Step 2: 根據路由結果處理
  let result: ProcessResult;
  
  switch (route.layer) {
    case 'rule':
      result = await handleRuleBasedIntent(route.intent, route.entities, context);
      break;
      
    case 'slm':
      // SLM 進一步分類
      const classification = await classifyIntent(input);
      
      if (classification.confidence < 0.6) {
        // 信心度低，升級到 LLM
        result = await handleLLMQuery(input, context);
      } else {
        const entities = await extractEntities(input, classification.intent);
        result = await handleSLMIntent(classification.intent, entities, context);
      }
      break;
      
    case 'llm':
      result = await handleLLMQuery(input, context);
      break;
  }
  
  result.latencyMs = Date.now() - startTime;
  return result;
}

async function handleRuleBasedIntent(
  intent: string,
  entities: Record<string, any>,
  context: AppContext
): Promise<ProcessResult> {
  switch (intent) {
    case 'line_status': {
      const status = await getLineStatus(entities.line);
      const templateKey = status.isNormal ? 'line_status_normal' : 'line_status_delayed';
      
      return {
        response: renderTemplate(templateKey, {
          locale: context.locale,
          data: {
            lineName: status.name,
            delayMinutes: status.delayMinutes,
            suggestion: status.isNormal ? '' : '建議改搭其他路線',
          },
        }),
        processingLayer: 'rule',
        latencyMs: 0,
      };
    }
    
    case 'find_toilet':
    case 'find_locker':
    case 'find_atm':
    case 'find_charging': {
      const facilityType = intent.replace('find_', '');
      const facilities = await searchFacilities(context.currentNodeId, facilityType);
      
      const templateKey = facilities.length > 0 ? 'facility_found' : 'facility_not_found';
      
      return {
        response: renderTemplate(templateKey, {
          locale: context.locale,
          data: {
            nodeName: context.currentNodeName,
            count: facilities.length,
            facilityType: getFacilityTypeName(facilityType, context.locale),
          },
        }),
        actionCards: facilities.slice(0, 3).map(f => ({
          type: 'facility',
          title: f.name,
          subtitle: f.direction,
          distance: f.distance,
        })),
        processingLayer: 'rule',
        latencyMs: 0,
      };
    }
    
    // ... 其他 rule-based 意圖
    
    default:
      return {
        response: '抱歉，我不太理解你的意思。',
        processingLayer: 'rule',
        latencyMs: 0,
      };
  }
}

async function handleSLMIntent(
  intent: string,
  entities: Record<string, any>,
  context: AppContext
): Promise<ProcessResult> {
  switch (intent) {
    case 'route_search': {
      // 有目的地，執行路線搜尋
      if (entities.destination) {
        const routes = await searchRoutes(
          context.currentNodeId,
          entities.destination,
          entities.preferences
        );
        
        // 套用商業規則
        const recommendations = getCommercialRecommendations({
          hasDelay: routes.some(r => r.hasDelay),
          isCrowded: routes.some(r => r.isCrowded),
          isRaining: context.weather?.isRaining || false,
          hasLuggage: entities.preferences?.includes('luggage'),
          isAccessibility: entities.preferences?.includes('wheelchair'),
          distance: routes[0]?.distance || 0,
        });
        
        return {
          response: `去${entities.destination}的話，建議：`,
          actionCards: routes.slice(0, 3).map((r, i) => ({
            type: 'transit',
            title: r.summary,
            subtitle: r.details,
            duration: r.duration,
            price: r.price,
            isRecommended: i === 0,
          })),
          processingLayer: 'slm',
          latencyMs: 0,
        };
      }
      
      // 沒有目的地，詢問
      return {
        response: '你想去哪裡呢？',
        followUp: ['淺草', '銀座', '秋葉原'],
        processingLayer: 'slm',
        latencyMs: 0,
      };
    }
    
    // ... 其他 SLM 意圖
    
    default:
      // 無法處理，升級到 LLM
      return handleLLMQuery(context.lastInput, context);
  }
}

async function handleLLMQuery(
  input: string,
  context: AppContext
): Promise<ProcessResult> {
  const result = await handleComplexQuery(input, {
    currentNode: context.currentNodeId,
    zone: context.zone,
    locale: context.locale,
    l2Status: context.l2Status,
  });
  
  return {
    ...result,
    processingLayer: 'llm',
    latencyMs: 0,
  };
}
```

---

## 5. 降級策略

### 5.1 各層降級路徑

```
LLM 不可用時：
┌─────────────────────────────────┐
│  LLM 失敗/超時                   │
│           ↓                     │
│  嘗試 SLM 處理                   │
│           ↓                     │
│  SLM 也失敗 → Rule-based 兜底   │
│           ↓                     │
│  「抱歉，我現在有點忙，          │
│   可以試試這些快速選項：」       │
│   [查路線] [找設施] [看狀態]     │
└─────────────────────────────────┘
```

### 5.2 降級實作

```typescript
// lib/ai/fallback.ts

interface FallbackConfig {
  llmTimeout: number;      // LLM 超時時間（毫秒）
  slmTimeout: number;      // SLM 超時時間
  maxRetries: number;      // 最大重試次數
}

const DEFAULT_FALLBACK_CONFIG: FallbackConfig = {
  llmTimeout: 5000,
  slmTimeout: 2000,
  maxRetries: 2,
};

export async function processWithFallback(
  input: string,
  context: AppContext,
  config: FallbackConfig = DEFAULT_FALLBACK_CONFIG
): Promise<ProcessResult> {
  // 嘗試正常處理
  try {
    const result = await Promise.race([
      processUserInput(input, context),
      timeout(config.llmTimeout),
    ]);
    return result;
  } catch (e) {
    console.warn('Primary processing failed, trying fallback:', e);
  }
  
  // LLM/SLM 都失敗，使用 Rule-based 兜底
  return {
    response: getFallbackResponse(context.locale),
    actionCards: getQuickActions(context),
    processingLayer: 'rule',
    latencyMs: 0,
    isFallback: true,
  };
}

function getFallbackResponse(locale: string): string {
  const responses = {
    'zh-TW': '抱歉，我現在反應有點慢 😅\n先試試這些快速功能吧：',
    'ja': 'すみません、ちょっと反応が遅くなっています 😅\nこちらのクイック機能をお試しください：',
    'en': "Sorry, I'm a bit slow right now 😅\nTry these quick options:",
  };
  return responses[locale] || responses['en'];
}

function getQuickActions(context: AppContext): ActionCard[] {
  return [
    { type: 'quick', title: '🚃 查路線', action: 'route_search' },
    { type: 'quick', title: '🚻 找廁所', action: 'find_toilet' },
    { type: 'quick', title: '📊 看狀態', action: 'status_overview' },
    { type: 'quick', title: '🧳 寄行李', action: 'find_locker' },
  ];
}

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Timeout')), ms);
  });
}
```

---

## 6. 成本估算

### 6.1 假設情境

- 每日活躍用戶：1,000 人
- 每用戶平均對話：5 輪
- 每日總對話數：5,000 次

### 6.2 各層分配與成本

| 層級 | 佔比 | 次數/日 | 單價 | 日成本 | 月成本 |
|------|------|--------|------|-------|--------|
| Rule-based | 60% | 3,000 | $0 | $0 | $0 |
| SLM (本地) | 30% | 1,500 | $0 | $0 | $0 |
| LLM | 10% | 500 | $0.002 | $1 | $30 |
| **總計** | | 5,000 | | $1/日 | **$30/月** |

### 6.3 與全 LLM 架構比較

| 架構 | 月成本 | 平均延遲 |
|------|-------|---------|
| 全 LLM | $150-300 | 1.5-2.5s |
| **混合架構** | **$30** | **300-500ms** |
| 節省 | **80-90%** | **70-80%** |

---

## 7. 監控與優化

### 7.1 監控指標

```typescript
// lib/ai/metrics.ts

interface AIMetrics {
  // 各層使用統計
  layerDistribution: {
    rule: number;
    slm: number;
    llm: number;
  };
  
  // 延遲統計
  latencyP50: number;
  latencyP90: number;
  latencyP99: number;
  
  // 品質指標
  fallbackRate: number;      // 降級率
  slmToLLMEscalation: number; // SLM 升級 LLM 的比率
  
  // 成本追蹤
  llmTokensUsed: number;
  estimatedCost: number;
}

// 記錄每次處理結果
export function logProcessingResult(result: ProcessResult) {
  // 發送到分析服務（如 Supabase、Mixpanel）
  analytics.track('ai_processing', {
    layer: result.processingLayer,
    latencyMs: result.latencyMs,
    isFallback: result.isFallback || false,
    intent: result.intent,
  });
}
```

### 7.2 優化方向

```
如果 LLM 使用率 > 15%：
→ 檢查是否有更多意圖可以用 Rule 處理
→ 調整 SLM 信心度閾值

如果平均延遲 > 500ms：
→ 檢查 SLM 模型是否太大
→ 考慮更積極的 Rule-based 匹配

如果降級率 > 5%：
→ 檢查 LLM API 穩定性
→ 增加重試機制
```

---

## 8. 給 Trae 的實作指引

### 8.1 實作順序

```
Phase 1（MVP 必須）：
1. 實作 Intent Router（快速規則匹配）
2. 實作 Template 系統
3. 實作 Business Rules
4. 串接 Dify/Gemini（LLM）
5. 實作 Fallback 機制

Phase 2（SLM 整合）：
6. 部署 Ollama + Gemma 2B
7. 實作 SLM 意圖分類
8. 實作 SLM 實體抽取
9. 調整路由邏輯

Phase 3（優化）：
10. 監控與指標收集
11. 根據數據調整各層邊界
12. Fine-tune SLM（如果需要）
```

### 8.2 MVP 可以先跳過 SLM

```
如果時間緊迫，MVP 可以簡化為：

Rule-based (70%) + LLM (30%)

- Rule：所有確定性任務
- LLM：所有需要「理解」的任務

Phase 2 再加入 SLM 優化成本
```

---

## 9. 參考文件

| 文件 | 相關內容 |
|------|---------|
| `project_rules.md` | One Recommendation 原則 |
| `UI_SPEC.md` | AI 對話頁面、Quick Replies |
| `DATA_STRATEGY.md` | L2 Cache（供 Rule-based 查詢）|
| `TECH_STACK.md` | Dify 設定 |

---

*本文件定義 BambiGO 的 AI 混合架構，是成本控制與回應品質的關鍵。*
*開發時務必判斷每個功能屬於哪一層，不要「偷懶全丟 LLM」。*
