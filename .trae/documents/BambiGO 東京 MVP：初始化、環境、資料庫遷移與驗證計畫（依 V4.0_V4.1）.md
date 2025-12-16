## 現況檢查
- 專案：`bambigo-web` 為 Next.js 16（App Router）已就緒。
- 依賴：`mapbox-gl`, `react-map-gl`, `@supabase/supabase-js`, `lucide-react`, `next-intl`, `clsx`, `tailwind-merge` 已安裝。
- 架構文件：根目錄含 `BambiGO 技術架構規格書V4.0.pdf` 與 `BambiGO_Database_Schema_v4.1.md.pdf`；未找到 `.trae/context.md`，將以現有 PDF 為依據。

## 專案初始化（核對）
- 保留現有 Next.js 設定與依賴（均符合要求）。
- 若其他工作區警告（turbopack root）已修正，不需變更。

## 環境變數與客戶端
- 讀取 `bambigo-web/.env.local`（內含 `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ODPT_API_TOKEN`, `NEXT_PUBLIC_MAPBOX_TOKEN`, `DATABASE_URL`）。
- 新增或核對：
  - `lib/supabase.ts`（前端用）：`createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)`
  - `lib/utils.ts`：提供 `cn(...inputs)` 使用 `clsx` + `tailwind-merge`。

## 資料庫建置（依 v4.1）
- 撰寫 `scripts/init_schema.ts`：
  - 以 `pg` 連線 `process.env.DATABASE_URL`。
  - DDL 建立 `public.nodes`（嚴格符合 v4.1）：
```sql
create extension if not exists pgcrypto;
create extension if not exists postgis;
create table if not exists public.nodes (
  id uuid primary key default gen_random_uuid(),
  name jsonb not null,
  supply_tags jsonb not null default '[]'::jsonb,
  suitability_tags jsonb not null default '[]'::jsonb,
  external_links jsonb not null default '[]'::jsonb,
  parent_hub_id uuid references public.nodes(id) on delete set null,
  odpt_id text unique,
  category text,
  geom geography(Point, 4326),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint name_structure_chk check (
    jsonb_typeof(name) = 'object'
    and name ? 'ja' and name ? 'en' and name ? 'zh'
  )
);
create index if not exists nodes_geom_idx on public.nodes using gist (geom);
create index if not exists nodes_name_gin on public.nodes using gin (name);
create index if not exists nodes_supply_tags_gin on public.nodes using gin (supply_tags);
create index if not exists nodes_suitability_tags_gin on public.nodes using gin (suitability_tags);
alter table public.nodes enable row level security;
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;$$ language plpgsql;
drop trigger if exists set_nodes_updated_at on public.nodes;
create trigger set_nodes_updated_at before update on public.nodes for each row execute function set_updated_at();
```
- 腳本行為：
  - 執行以上 SQL；
  - 查驗表存在性 `select to_regclass('public.nodes')`；
  - 輸出成功/失敗訊息。

## 執行驗證
- 以 `npm run init:schema` 執行腳本。
- 成功依據：終端輸出 `nodes created` 並能 `select count(*)` 正常查詢。

## 交付清單
- `lib/utils.ts`（`cn` helper）。
- `scripts/init_schema.ts`（含 v4.1 所需欄位與約束）。
- 設定 `package.json` 腳本：`init:schema`（若已存在則保留）。

## 安全與相容
- 僅伺服端脚本使用 `DATABASE_URL`；不暴露服務端密鑰於客戶端。
- `name_structure_chk` 保障 i18n 欄位存在；如需兼容過渡資料，可暫時記錄未達標資料於 ETL 層做補全。

確認後我將新增/更新工具與腳本，執行遷移，並回報資料庫 `nodes` 表建立結果。