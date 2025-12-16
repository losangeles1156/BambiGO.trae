## 問題
- 缺少 `pg` 型別宣告：`app/api/nodes/route.ts:2`、`scripts/init_schema.ts:2`。
- `values` 陣列型別推斷為 `number[]`，在加入 `categoryParam: string` 時觸發「string 不能賦給 number」錯誤：`app/api/nodes/route.ts:52`。

## 修復方案
- 安裝 `@types/pg` 作為 dev 依賴，解決 `pg` 型別缺失。
- 更新 `route.ts` 中 `values` 宣告為聯合型別：`const values: (number | string)[] = [...]`，以容納 bbox 數值與類別字串。

## 驗證
- 重新執行型別檢查與診斷，確認錯誤消失。
- 保持開發伺服器運行，無需中斷。

確認後我將套用上述修復並回報結果。