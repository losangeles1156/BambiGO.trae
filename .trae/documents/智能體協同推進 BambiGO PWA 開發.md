## 當前進度
- 已完成 Bottom Sheet 三態（收合/半展開/全展開）與地圖高度聯動（src/app/page.tsx, src/components/sheets/BottomSheet.tsx, components/map/MapCanvas.tsx）。
- 已實作語意標籤卡、設施列表、行動卡片輪播與 AI 全螢幕對話（src/components/cards/*, src/components/lists/FacilityList.tsx, src/components/assistant/FullScreenAssistant.tsx）。
- API 節點查詢嚴格化與限流（bambigo-web/src/app/api/nodes/route.ts）。

## 待完成需求
- 多語系一致性：UI 使用 zh/ja/en，資料庫規範為 zh-TW/ja/en；需建立映射並接入 next-intl。
- L2/L3 真實資料接入：天氣、人潮、活動、設施來源與快取策略；與 db_schema 規範對齊。
- OpenAPI 契約：為 /api/nodes 與後續服務定義規格，加入契約測試。
- PWA 品質：深色模式、Icon/Maskable 調整、離線策略優化（節點與地圖瓦片）。
- 互動與效能：Bottom Sheet 60fps、Action Cards 慣性與回彈、地圖層級渲染優化。
- 可存取性與測試：ARIA/鍵盤導覽、E2E/單元測試補齊。
- CI/CD 與版本流程：PR 檢核（lint/typecheck/test）、分支策略與提交規範。

## 智能體選擇
- 前端：frontend-architect（組件與狀態）、frontend-interaction-expert（hydration/性能/回退 UI）。
- 設計：ui-designer（視覺層級、色彩與可讀性）。
- 後端：backend-architect（API 設計，/live,/facilities 等）。
- 數據：DataEngineer（L2/L3 ETL、適配器與快取）。
- AI 整合：ai-integration-eng（AI 助理介面與上下文保持）。
- 測試：api-test-pro（契約/負載/性能）；performance-expert（60fps 與渲染剖析）。
- 平台：devops-architect（CI/CD 與環境變數策略）。
- 規範：compliance-checker（隱私/條款審視，必要時）。

## 任務分解與分工
- 多語系整合
  - 建立 `i18n` 層（src/lib/utils/i18n.ts）映射 zh↔zh-TW；導入 next-intl；Header 語言切換對齊。
- L2/L3 接入
  - 定義 `/api/live`（天氣/人潮/活動）與 `/api/facilities`（設施）接口；資料來源與快取（TTL 20 分鐘）對齊 db_schema。
  - DataEngineer 撰寫適配器與批次抓取，backend-architect 實作路由與授權策略。
- OpenAPI 與契約測試
  - 生成 `/api/nodes`, `/api/live`, `/api/facilities` 規格；api-test-pro 驗證 4xx/2xx 行為與負載。
- PWA 品質提升
  - manifest icon/maskable、深色模式地圖樣式；SW 策略調整（節點 networkFirst+回退、瓦片 cacheFirst）。
- 互動與效能
  - Bottom Sheet 使用 transform+RAF 調參，ActionCarousel 慣性與彈性；frontend-interaction-expert 做 hydration 防護。
- 可存取性與測試
  - ARIA 標記與鍵盤操作；新增單元/端到端測試覆蓋核心互動。
- CI/CD 與流程
  - devops-architect 建置 PR 檢核（lint/typecheck/test），分支策略與 Conventional Commits。

## 監控與協同
- 任務看板：依上述模組建立看板與責任智能體；每項任務具狀態與驗收準則。
- 定期彙總：每次合併前產生測試報告（契約/性能/可存取性指標）。
- 風險控制：hydration、API 延遲與資料缺失提供回退 UI；錯誤日誌收集與告警。

## 交付物與驗收標準
- UI：三態面板流暢、Map 聯動正確、深色模式、ARIA 適配。
- API：OpenAPI 完整、契約測試通過、4xx/429/2xx 行為一致。
- PWA：可安裝、離線策略有效、SW 無阻塞。
- 效能：互動 60fps、LCP 與渲染剖析達標。
- 流程：CI 檢核合格、PR 模板與分支策略落地。

請確認以上協同計畫。我將按此方案協同與調度智能體並開始執行。