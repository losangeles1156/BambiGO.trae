-- 1. 驗證資料庫連線與基本擴展 (Database Connection & Extensions)
SELECT current_database(), current_user, version();
SELECT * FROM pg_available_extensions WHERE name = 'postgis';

-- 2. 檢查核心資料表結構 (Core Table Structure)
-- 2.1 節點表 (nodes) - 應包含空間欄位與 JSON 屬性
SELECT column_name, data_type, udt_name 
FROM information_schema.columns 
WHERE table_name = 'nodes';

-- 2.2 設施表 (facilities) - 應包含標籤化欄位 (supply_tag, suitability_tag)
SELECT column_name, data_type, udt_name 
FROM information_schema.columns 
WHERE table_name = 'facilities';

-- 2.3 城市表 (cities) - 應包含邊界資料 (bounds)
SELECT column_name, data_type, udt_name 
FROM information_schema.columns 
WHERE table_name = 'cities';

-- 3. 驗證索引 (Index Verification)
-- 確保 nodes 表有 GIST 空間索引以支援地圖查詢
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'nodes';

-- 4. 監控查詢效能 (Performance Monitoring)
-- 檢查目前活動中的查詢
SELECT pid, usename, client_addr, state, query, query_start 
FROM pg_stat_activity 
WHERE state != 'idle';

-- 5. 數據完整性抽樣 (Data Integrity Sampling)
-- 檢查是否有孤立的設施 (沒有對應節點)
SELECT count(*) as orphaned_facilities 
FROM facilities f 
LEFT JOIN nodes n ON f.node_id = n.id 
WHERE n.id IS NULL;
