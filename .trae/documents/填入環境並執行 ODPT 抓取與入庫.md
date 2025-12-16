## 所需資訊
- `ODPT_API_TOKEN`：ODPT 平台的 API Token（將用來請求 `odpt:Station` 與 `odpt:BusstopPole`）。
- `NEXT_PUBLIC_SUPABASE_URL`：你的 Supabase 專案 URL。
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`：Supabase anon key（前端用）。
- `SUPABASE_SERVICE_ROLE_KEY`：Supabase service role key（僅伺服端；後續可能用於管理用途）。
- `DATABASE_URL`：Supabase Postgres 連線字串（我們的 ETL 使用此直連來 upsert）。
- `NEXT_PUBLIC_MAPBOX_TOKEN`：Mapbox token（用於地圖展示；可稍後提供）。

## `.env.local` 範例（請填入 bambigo-web/.env.local）
```
NEXT_PUBLIC_SUPABASE_URL=... 
NEXT_PUBLIC_SUPABASE_ANON_KEY=... 
SUPABASE_SERVICE_ROLE_KEY=... 
ODPT_API_TOKEN=... 
NEXT_PUBLIC_MAPBOX_TOKEN=... 
DATABASE_URL=postgresql://postgres:<DB_PASSWORD>@db.<project-ref>.supabase.co:5432/postgres
```
- `DATABASE_URL` 可在 Supabase Dashboard 的 Database 設定頁取得；若有 PgBouncer，常見是 `...:6543`，否則預設 `5432`。

## 我將執行的步驟
1. 寫入你提供的環境變數到 `bambigo-web/.env.local`（不曝光任何秘密）。
2. 先跑 `npm run init:schema` 確保 `nodes` 表與索引存在。
3. 跑 `npm run fetch:odpt`：
   - 只抓取運營商 `JR-East`、`TokyoMetro`、`Toei` 的 `Station` 與 `BusstopPole`。
   - 只保留落在 Bounding Box `[139.73,35.65]`–`[139.82,35.74]` 的節點。
   - 進行名稱 i18n 映射（`{ja,en,zh}`，`zh` 缺省時以 `ja` 代入）。
   - L3 標籤：車站加 `has_train`；巴士站加 `has_bus`。
   - 以批次 upsert 寫入 `nodes`（含 `geom`）。
4. 回報指標：`stations_fetched`、`busstops_fetched`、`within_bbox`、`upserted_added`、`upserted_updated`、`total_odpt_nodes`。

## 安全與校驗
- 所有秘密僅存於本地 `.env.local`；程式碼不記錄與不回傳敏感值。
- 若 ODPT 欄位差異，我的腳本含鍵名回退策略以穩健解析座標與名稱。

提供上述變數後，我即可執行 ETL 並回報抓到與入庫的節點總數。