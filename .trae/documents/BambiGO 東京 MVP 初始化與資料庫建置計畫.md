## 現況檢查
- 目前目錄包含規格文件與資料檔，未找到 `package.json` 或 Next.js 專案結構。
- 發現 `.env.local.txt`，內容鍵名與分隔符需要轉為 `.env.local` 的 `KEY=VALUE` 格式；未見 `MAPBOX_TOKEN`，`ODPT_API_TOKEN`出現重複條目。
- 架構書 v4.0 與 v4.1 Schema 文件已就緒；ODPT 公開數據檔存在於目錄，後續可做導入。

## 專案初始化
- 若無既有 Next.js 專案：建立 Next.js 14 App Router、TypeScript 與 TailwindCSS 基礎。
- 安裝依賴：`mapbox-gl`、`react-map-gl`、`@supabase/supabase-js`、`lucide-react`、`next-intl`、`clsx`、`tailwind-merge`。
- 開發輔助（用於腳本與執行）：`pg`、`dotenv`、`tsx`、`typescript`、`ts-node`（二選一，建議 `tsx`）。

## 環境變數設定
- 轉換 `.env.local.txt` 為 `.env.local` 並改為 `KEY=VALUE`。
- 建議鍵名：`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`ODPT_API_TOKEN`、`NEXT_PUBLIC_MAPBOX_TOKEN`、`SUPABASE_SERVICE_ROLE_KEY`、`DATABASE_URL`。
- `SERVICE_ROLE_KEY` 與 `DATABASE_URL` 僅用於伺服端與遷移腳本；前端僅使用 `NEXT_PUBLIC_*` 變數。

## 建立 Supabase 客戶端
- 新增 `lib/supabase.ts`：
```ts
import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```
- 伺服端腳本可另建 `lib/supabaseAdmin.ts` 使用 `SUPABASE_SERVICE_ROLE_KEY`。

## 資料庫建置：`scripts/init_schema.ts`
- 以 `pg` 連線 `process.env.DATABASE_URL`，執行 DDL 與索引建立。
- SQL（依 v4.1 需求並包含注意事項）：
```sql
create extension if not exists pgcrypto;
create extension if not exists postgis;
create table if not exists public.nodes (
  id uuid primary key default gen_random_uuid(),
  name jsonb not null,
  supply_tags jsonb not null default '[]'::jsonb,
  suitability_tags jsonb not null default '[]'::jsonb,
  external_links jsonb not null default '[]'::jsonb,
  odpt_id text,
  category text,
  geom geography(Point, 4326),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists nodes_geom_idx on public.nodes using gist (geom);
create index if not exists nodes_name_gin on public.nodes using gin (name);
create index if not exists nodes_supply_tags_gin on public.nodes using gin (supply_tags);
create index if not exists nodes_suitability_tags_gin on public.nodes using gin (suitability_tags);
alter table public.nodes enable row level security;
```
- 觸發器（更新 `updated_at`）：
```sql
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;$$ language plpgsql;
create trigger set_nodes_updated_at before update on public.nodes
for each row execute function set_updated_at();
```
- 初始 RLS 策略（MVP 可視需求追加）：只讀公開查詢、受限寫入。

## 腳本內容（TypeScript）
```ts
import 'dotenv/config'
import { Client } from 'pg'

const sql = `...上方 SQL 片段...`

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    await client.query(sql)
    const res = await client.query("select to_regclass('public.nodes') as exists")
    console.log(res.rows[0].exists ? 'nodes created' : 'nodes missing')
  } finally {
    await client.end()
  }
}
main().catch(err => { console.error(err); process.exit(1) })
```
- 套件腳本：`"init:schema": "tsx scripts/init_schema.ts"`。

## 驗證流程
- 執行 `npm run init:schema`，印出 `nodes created` 視為成功。
- 以 `select * from public.nodes limit 1;` 檢查表存在性與欄位。

## ODPT 與地圖整合（後續）
- 以 `ODPT_API_TOKEN` 拉取 東京地鐵車站與路線資料，轉為 `nodes` 以便地圖展示。
- `react-map-gl` 以 `NEXT_PUBLIC_MAPBOX_TOKEN` 顯示底圖與車站標記；多語名稱使用 `name` 的 `jsonb`。

請確認以上計畫；確認後我將依序執行初始化、環境設定、腳本建立與資料庫遷移，並回報結果。