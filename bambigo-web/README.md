# BambiGO Web

## 架構
- Next.js 16（App Router）+ React 19
- 地圖：MapLibre GL
- 後端資料：PostgreSQL（nodes 路由），Supabase 可選
- 測試：Vitest

## 重要路由與元件
- `src/app/page.tsx`：首頁整合地圖、BottomSheet、AI 助理
- `components/map/MapCanvas.tsx`：地圖來源/圖層、樣式載入重試、深色模式切換
- `src/app/api/nodes/route.ts`：節點資料，含速率限制與參數驗證
- `src/app/api/assistant/route.ts`：AI 助理串流（SSE），含速率限制與回退 JSON
- `src/components/assistant/FullScreenAssistant.tsx`：助理 UI，支援串流渲染與錯誤回退
- `src/lib/schema.ts`：FeatureCollection 正規化與過濾工具

## 環境變數
建立 `.env` 參考 `.env.example`：
```
ASSISTANT_RATE_LIMIT=20,60
AI_PROVIDER=dify
DATABASE_URL=postgres://user:pass@host:5432/dbname
```

### v2.1 指南補充（同步 bambigo-v2.1）
- 新增 L1 生活機能標籤與分階段實作建議
- 採用 AI 三層混合架構（Rule/SLM/LLM），降低成本與延遲
- 同心圓數據策略：核心圈 → 緩衝圈 → 外部圈（優雅降級）

### 追加環境變數
- Supabase：`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`
- ODPT：`ODPT_API_KEY`、`ODPT_CHALLENGE_KEY`
- Dify：`DIFY_API_KEY`、`DIFY_API_URL`
- LINE（Phase 3）：`LINE_CHANNEL_ACCESS_TOKEN`、`LINE_CHANNEL_SECRET`

更多細節請參考本地 `bambigo-v2.1/README.md` 與 `.trae/rules`（若存在）。

## 開發
```
npm run dev
```
開啟首頁後，按下「🦌 AI」進入助理，全程在瀏覽器側串流渲染；需設定真實提供者（Dify/n8n），否則後端回傳配置錯誤。

## 測試
```
npm test -- --run
```
涵蓋 schema 正規化與 assistant 路由（參數/速率限制/串流標頭）測試。
