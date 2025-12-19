# SOP Integration & Navigation Linkage Plan (Zero-One)

## 1. 需求分析 (Requirement Analysis)

### 1.1 核心目標
建立「天氣警報」與「設施導航」之間的自動化聯動機制。當使用者收到特定警報（如暴雨、地震）時，系統應能自動或半自動地引導使用者前往最近的安全設施（如避難所、室內休息區）。

### 1.2 聯動觸發條件 (Triggers)
- **手動觸發 (Manual)**: 使用者點擊警報卡片上的 L3 標籤（如 `#evacuation_site`）。
- **自動觸發 (Auto)**: 當警報等級達到 `High` 且使用者位於 L1 危險區域（如河濱公園）時（需使用者授權）。

### 1.3 交互規則 (Interaction Rules)
1.  **Alert Phase**: `AlertBanner` 顯示警報與 L3 建議標籤。
2.  **Decision Phase**: 使用者點擊標籤 -> 系統進入 `SOP_MODE`。
3.  **Navigation Phase**:
    -   地圖過濾並僅顯示相關設施（如僅顯示避難所）。
    -   系統計算使用者當前位置至最近設施的路徑。
    -   顯示導航指引卡片 (L4 Action Card)。

### 1.4 數據傳輸規範 (Data Specs)
-   **Context Object**: `SOPState`
    ```typescript
    interface SOPState {
      mode: 'normal' | 'emergency';
      triggerAlertId: string | null;
      targetCategory: L3Category | null; // e.g., 'shelter'
      targetFacilities: L3ServiceFacility[];
    }
    ```

## 2. 技術實現規劃 (Technical Implementation)

### 2.1 架構圖 (Architecture)
```mermaid
graph TD
    A[Alert Engine (n8n/RSS)] -->|Push Alert| B(AlertBanner)
    B -->|Click Tag| C{SOP Context}
    C -->|Activate Mode| D[MapController]
    C -->|Filter Data| E[FacilityManager]
    D -->|Render Route| F[MapCanvas]
    E -->|Query Nearest| G[Supabase/Local DB]
```

### 2.2 API 接口規範
由於導航主要在客戶端運算（或調用外部 API），我們定義內部 Context API：

-   `activateSOP(alertId: string, facilityType: string)`: 啟動 SOP 模式。
-   `findNearestFacility(userLoc: [lat, lng], type: string)`: 返回最近設施。

### 2.3 雙向數據同步
-   **Upstream**: 使用者位置與狀態回報給 n8n (via Webhook) 用於統計（Phase 3）。
-   **Downstream**: n8n 推送新的避難指示更新 `SOPState`。

### 2.4 監控與日誌
-   記錄每次 SOP 啟動事件 (`sop_activation`)。
-   記錄導航成功率 (`navigation_complete`)。

## 3. 開發執行計畫 (Execution Plan)

-   [ ] **Phase 1: Foundation** (Current)
    -   建立 `SOPContext`。
    -   實作 `AlertBanner` 點擊事件。
-   [ ] **Phase 2: Logic**
    -   實作 `findNearestFacility` 演算法 (Haversine)。
    -   聯動 `MapCanvas` 顯示高亮圖標。
-   [ ] **Phase 3: Routing**
    -   整合 Mapbox/OSRM 繪製路徑線 (Polyline)。

## 4. 交付標準 (Delivery)
-   單元測試：覆蓋 `findNearest` 邏輯。
-   效能：設施篩選 < 50ms (前端)。
-   UX：從點擊到地圖響應 < 200ms。
