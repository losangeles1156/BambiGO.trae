## 目標
- 撰寫並執行 `scripts/fetch_tokyo_odpt.ts`，抓取 ODPT 的 `Station` 與 `BusstopPole`，限定指定 Bounding Box 與 Operators，進行 i18n 名稱映射與 L3 標籤預處理，最後以 `upsert` 寫入 `nodes` 表並回報總數。

## 連線與環境
- 使用 `dotenv` 讀取環境變數：`ODPT_API_TOKEN`、`DATABASE_URL`（直連 Supabase Postgres）。
- 若 `nodes` 表不存在，先執行既有 `init:schema.ts`（同一連線）以建立 Schema。
- 寫入資料使用 `pg` 直連並執行 `INSERT ... ON CONFLICT (odpt_id) DO UPDATE`，`geom` 以 `st_setsrid(st_point(lon, lat), 4326)` 建立。

## 抓取來源
- 端點：
  - `https://api.odpt.org/api/v4/odpt:Station?acl:consumerKey=<token>&odpt:operator=odpt.Operator:JR-East`
  - `odpt.Operator:TokyoMetro`
  - `odpt.Operator:Toei`
  - `https://api.odpt.org/api/v4/odpt:BusstopPole?acl:consumerKey=<token>&odpt:operator=odpt.Operator:Toei`
- 先取全量（指定運營商），於客戶端做 Bounding Box 過濾（西南 `[139.73, 35.65]` 至 東北 `[139.82, 35.74]`）。

## 轉換與過濾
- 位置鍵探索：嘗試 `geo:longitude`/`geo:latitude`，回退檢查常見別名（`lon`/`lng`/`long`、`lat`）。
- 唯一識別：`owl:sameAs` 或 `@id`；以此作為 `odpt_id`。
- i18n 名稱：
  - 優先使用回傳內的日文/英文名稱欄位（如 `dc:title` 或業務欄位），
  - 若缺英語，從 `sameAs` 最末段推斷羅馬字（如 `...TokyoMetro.Ginza.Ginza` → `Ginza`），
  - `zh` 若缺，暫填 `ja`。
- L3 標籤預處理：
  - Station → `supply_tags` 加入 `has_train`
  - BusstopPole → `supply_tags` 加入 `has_bus`
- 其餘欄位：`suitability_tags` 預設 `[]`；`external_links` 預設 `[]`；`category` 設為 `station`/`busstop`。

## 寫入策略（Upsert）
- DDL 假定：`public.nodes` 已存在且包含需求欄位與索引。
- DML：
```sql
insert into public.nodes (odpt_id, name, supply_tags, suitability_tags, external_links, category, geom)
values ($1, $2::jsonb, $3::jsonb, '[]'::jsonb, '[]'::jsonb, $4, st_setsrid(st_point($5, $6), 4326))
on conflict (odpt_id) do update set
  name = EXCLUDED.name,
  supply_tags = EXCLUDED.supply_tags,
  category = EXCLUDED.category,
  geom = EXCLUDED.geom;
```
- 成功後以 `select count(*) from public.nodes where odpt_id is not null` 回報抓取與匯入總數（也可同時統計新增/更新筆數）。

## 腳本結構
- `scripts/fetch_tokyo_odpt.ts`：
  - 讀取 env → 檢查 `ODPT_API_TOKEN`/`DATABASE_URL`
  - 端點請求（各運營商）→ 合併 → 正規化資料 → Bounding Box 過濾
  - 批次 upsert（分批 500 筆）→ 統計新增/更新 → 印出總筆數

## 驗證與輸出
- 以 `npm run fetch:odpt` 執行（新增 npm 腳本），終端輸出：
  - `stations fetched: N, busstops fetched: M, within bbox: K`
  - `upserted: added A, updated U`
  - `total nodes with odpt_id: T`

## 依賴
- 已有：`pg`, `dotenv`, `tsx`
- 使用 Node 18+ 內建 `fetch`；若需重試可採簡易重試邏輯。

## 風險與回退
- 若 ODPT 部分欄位差異：以鍵探索與回退策略確保名稱與座標可解析；缺英語時以羅馬字推斷，缺中文時以日文填充。
- 若 `nodes` 表不存在或缺欄位：先調用現有遷移腳本建立（需要 `DATABASE_URL`）。

確認後我將新增腳本與 npm 腳本、執行 ETL，並回報抓取範圍內的節點總數。