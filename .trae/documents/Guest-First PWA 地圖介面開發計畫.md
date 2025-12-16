## Mapbox 介面
- 建立 `components/map/MapCanvas.tsx`，使用 `react-map-gl` 與 `mapbox-gl`。
- 初始視圖：中心 `35.7141, 139.7774`（上野車站）、縮放 `13`、樣式 `mapbox://styles/mapbox/light-v11`。
- 資料來源：從 `/api/nodes` 取得 GeoJSON FeatureCollection，properties 含 `category`、`name`、`supply_tags`、`suitability_tags`。
- 分層渲染：
  - Station 圓點：深藍色（如 `#0b3d91`）、半徑較大（6–8）。
  - Bus 圓點：淺藍色（如 `#73a6ff`）、半徑較小（3–4），`minzoom: 13` 前隱藏。
- 互動：`interactiveLayerIds` 指向兩層，`onClick` 抓取 `e.features[0]` 顯示 Popup。

## NodeCard
- 建立 `components/map/NodeCard.tsx`，接收 `name jsonb`、`supply_tags`、`suitability_tags`。
- 語系：依 `navigator.language` 選 `zh`→`en`→`ja` 回退顯示。
- 顯示：標題為對應語言站名、列出 L3/L4 標籤。
- 假 L4 動作：提供「查看轉乘建議」按鈕，點擊 `console.log`。

## API 路由
- 建立 `app/api/nodes/route.ts`，伺服端使用 `pg` 直連 `process.env.DATABASE_URL`。
- SQL：查詢 `id, odpt_id, name, supply_tags, suitability_tags, category, ST_X(geom::geometry) AS lon, ST_Y(geom::geometry) AS lat`，可選擇再以 `ST_MakeEnvelope` 進一步 bbox 過濾。
- 回傳：轉為 GeoJSON FeatureCollection，以供 Map 層直接綁定。

## PWA 設定
- 新增 `public/manifest.json`：`name`、`short_name`、`start_url`、`display=standalone`、`background_color`、`theme_color`、基本 icons。
- 在 `app/layout.tsx` `<head>` 加入 `<link rel="manifest" href="/manifest.json">`。

## 首頁整合
- 更新 `app/page.tsx`，全螢幕容器渲染 `MapCanvas`。
- 若 `NEXT_PUBLIC_MAPBOX_TOKEN` 缺失，顯示覆蓋提示避免崩潰。

## 驗證
- 啟動 `npm run dev`，於 `http://localhost:3000` 檢視：
  - 地圖載入，中心在上野。
  - Station 深藍點與 Bus 淺藍點（Bus 在 zoom<13 隱藏）。
  - 點擊彈出 NodeCard 顯示 i18n 名稱與標籤；按鈕 `console.log`。
- 檢查 `/api/nodes` 回傳結構與數量與入庫一致。

## 需求環境
- `.env.local` 已包含：`NEXT_PUBLIC_MAPBOX_TOKEN`、`DATABASE_URL`；前端 `NEXT_PUBLIC_SUPABASE_*` 可保留以後用。

確認後我將依序建立 API、組件與 PWA 設定，啟動開發伺服器並回報畫面與真實站點顯示情況。