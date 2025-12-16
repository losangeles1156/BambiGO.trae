## 介面總覽
- 以 Bottom Sheet 為主體，提供「收合／半展開／全展開」三種狀態；地圖區域隨狀態改變占比（85%／50%／15%）。
- 收合：顯示迷你節點卡（節點名稱＋即時標籤），地圖主視，純瀏覽。
- 半展開：完整節點資訊＋AI情境化建議＋橫向 Action Cards（慣性滑動）。
- 全展開：設施列表（可滾動）＋上拉進入全螢幕 AI 對話模式。

## 組件與路徑
- `src/components/sheets/BottomSheet.tsx`：狀態機、拖曳把手、圓點指示器、三態切換；以 CSS transform＋requestAnimationFrame 實作 60fps。
- `src/components/cards/ActionCarousel.tsx`：橫向卡片滑動，慣性控制（速度、阻尼、邊界回彈），`will-change: transform`。
- `src/components/assistant/FullScreenAssistant.tsx`：🦌 AI 全螢幕對話介面；快速回覆按鈕、上下文保留；Esc/返回鍵關閉。
- `src/components/cards/MiniNodeCard.tsx`：收合態顯示（名稱＋即時狀態 Chips）。
- `src/components/cards/NodeDetailCard.tsx`：半展開態顯示（L1-L4 區塊、標籤與簡述）。
- `src/components/lists/FacilityList.tsx`：全展開態的設施列表（按需展開、分組）。
- 現有 `MapCanvas` 更新：暴露 `resize()` 與 `setFocusNode(id)`；跟隨 Bottom Sheet 狀態通知呼叫 `map.resize()`。
- `src/types/ui.ts`：定義 Tag、Status、Recommendation、Facility 等型別。

## 互動行為
- 把手拖曳：根據拖曳距離與速度決定目標狀態；阻尼係數 `ζ` 與彈簧常數 `k` 可微調；滑動手勢支援觸控與滑鼠。
- 圓點指示器：點擊直接跳轉狀態；ARIA `role="tablist"`＋鍵盤導覽。
- 🦌 AI 按鈕：進入全螢幕對話；三層漸進揭露（基礎→詳細→AI）。
- 卡片橫滑：慣性＋邊界彈性；可鍵盤左右切換。

## 地圖聯動
- 地圖容器高度依三態切換（85/50/15%）；在切換結束後 `map.resize()`。
- 點選地圖節點更新 Bottom Sheet 內容；收合態下顯示迷你卡；半展開自動切到詳細。

## 資料來源
- 節點：`/api/nodes` 取得要素；底稿用現有 FeatureCollection。
- 狀態/活動/人潮：先以前端假資料模擬；後續接入 L2/L3。
- 推薦：以靜態樣例呈現 One Recommendation＋替代方案。

## 效能與可用性
- 目標 60fps：使用 `transform: translateY`＋`requestAnimationFrame`；避免 reflow；`passive` 事件；移動端 CSS `will-change`。
- 可存取性：ARIA role、鍵盤操作、焦點環；對比比率適配深色模式。

## 深色模式
- 使用 CSS 變數（已於 `globals.css`）與 Tailwind v4；地圖採深色主題（降低卡片干擾）。

## 驗收準則
- 三態切換流暢（拖曳、點擊圓點、點擊把手皆可）。
- 地圖最小 15% 可見；切換時沒有內容抖動；`map.resize()` 正常。
- 半展開顯示 L1-L4 與 Action Cards；全展開顯示設施列表與上拉進入 AI。
- 🦌 AI 全螢幕對話可開啟／關閉、快速回覆運作。

## 實施步驟
1. 建立 `BottomSheet`（狀態機＋拖曳手勢）；串接圓點指示器與把手。
2. 整合 `MapCanvas`：高度聯動＋`resize()` 通知。
3. 實作 `MiniNodeCard`／`NodeDetailCard`／`FacilityList`；導入假資料。
4. 實作 `ActionCarousel`（橫向慣性滑動）。
5. 實作 `FullScreenAssistant`；加入快捷意圖。
6. 更新 `page.tsx` 排版；`typecheck`／`lint`；本地預覽。

同意後，我將開始實作並提供可開啟的預覽網址（localhost）。