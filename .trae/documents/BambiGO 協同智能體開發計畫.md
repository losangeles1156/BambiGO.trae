## 現況總結

* 前端採用 Next.js 16 App Router，React 19；依賴 `maplibre-gl`、`next-intl`、Supabase。

2

* 首頁整合地圖、底部工作表與 AI 助理：`bambigo-web/src/app/page.tsx:10-16,54-105`。

* 地圖互動與容錯完善：資料正規化、樣式載入重試、深色模式動態切換，參考 `bambigo-web/components/map/MapCanvas.tsx:53-76,93-101,101-122,123-171,208-225,231-250`。

* 節點資料 API 已提供速率限制與參數驗證：`bambigo-web/src/app/api/nodes/route.ts:8-43,45-79,95-118,169-189`。

* AI 助理目前為示範版，尚未串接 RAG/串流：`bambigo-web/src/components/assistant/FullScreenAssistant.tsx:6-8,23-44,25-38`。

## 目標

* 將城市 AI 助理升級為可串流、可回退的 GenAI 導引系統。

* 穩健處理不規則 API 回傳與 schema 變更，避免 hydration mismatch。

* 優化互動效能（地圖、卡片滑動、文字更新）並維持 UI 響應性。

* 建立端到端測試覆蓋（API、資料正規化、UI 回退）。

## 前端改進（App Router 客戶端）

* 建立資料正規化/驗證層：新增 `lib/schema` 使用 Zod（或輕量型檢查）驗證 `nodes/facilities/live` 回傳；在 `MapCanvas` 已有 minimal normalize，擴充為共用函式。

* 助理介面升級：在 `FullScreenAssistant` 加入串流訊息渲染、錯誤回退、離線與速率限制提示。維持簡潔 UI 與按鈕快速意圖。

* 後備 UI 一致性：沿用首頁離線提示 `bambigo-web/src/app/page.tsx:56-60`，把錯誤/空結果以「友善卡片」呈現（不白屏）。

## 後端與 API

* 新增 `/api/assistant`（SSE 或 chunked streaming），封裝 LLM 與 RAG 組合邏輯；沿用 `nodes` 路由的參數驗證與速率限制模式。

* 整合 Dify（或暫用 OpenAI/可換後端）：將 L1-L3 資料輸入，輸出行動建議（Action Cards）。保留超時/錯誤時之降級策略。

* 安全與觀測性：加入 `X-API-Version`、`Retry-After`、結構化錯誤；記錄請求 id 便於追蹤。

## AI/RAG 串流與回退

* 串流協定：前端 `EventSource` 或 `fetch()` + ReadableStream 渲染逐字訊息；指令/結構化卡片透過標記（如 JSON lines）。

* 回退策略：

  * 後端：檢索失敗時回傳 `fallback_reason` 與建議的通用卡片。

  * 前端：顯示「可重試」按鈕與替代意圖；保留最後成功的上下文。

* Schema 適配：為變動頻繁的檢索欄位設計 adapter，避免直接耦合 UI。

## 效能優化

* 地圖：維持現有 `style` 重試與 dark 模式觀察者；資料更新僅變更 GeoJSON source，避免重建 layer。

* 卡片滑動：保留 `requestAnimationFrame` 動量滾動（`ActionCarousel.tsx:44-66`）；加入邊界與摩擦控制，避免 GPU 過度占用。

* 助理文字：採用最小化 re-render（分離訊息列表與輸入框），串流使用批次 append 或 `scheduleMicrotask`，避免阻塞地圖主執行緒。

## 錯誤處理與後備 UI

* API：延續 `nodes` 的 400/429/500 響應模式；所有路由提供一致 JSON 結構，前端以「友善提示 + 重試」呈現。

* 前端：共用錯誤邏輯（hook 或 util），在地圖樣式錯誤時提供重試（已存在於 `MapCanvas.tsx:231-250`）。

* 離線與空資料：固定角落提示（`page.tsx:56-60`），卡片列表空時不渲染或顯示占位。

## 測試與品質保障

* 單元測試：

  * API 路由參數與速率限制（仿 `nodes`）；

  * 資料正規化函式（FeatureCollection 最小模型、空/錯誤輸入）。

* 端到端/元件測試：

  * 助理串流渲染、錯誤回退流程；

  * 地圖點擊事件與 BottomSheet 狀態切換（`page.tsx:73-77,78-105`）。

* 覆蓋率維持於 Vitest 設定目標（`package.json:48-56`）。

## 作業與設定

* `.env.example` 補充所需變數：`DATABASE_URL`、第三方 LLM/RAG API key、`NODES_RATE_LIMIT` 等；避免提交秘密。

* 文件：新增 README 區段（架構、串流協定、回退策略）。

## 風險與假設

* 假設短期以 Dify 或暫用 OpenAI 作為檢索/生成來源，之後可替換。

* 使用 SSE 在開發環境可行；部署環境需確保反向代理支援。

* 依現況未見全域狀態庫，維持 hooks 模式即可；若需求擴大再評估。

***

請確認是否按此計畫執行，或指示優先順序（例如先完成助理串流與回退，再擴充資料驗證）。
