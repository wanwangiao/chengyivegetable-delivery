# Web App

Next.js 13 App Router，統一提供：

- 客戶前台（商品瀏覽、購物車、結帳）
- 管理後台（儀表板、訂單處理、商品管理）
- LINE LIFF 嵌入入口

架構亮點：

- SWR + Server Actions 提供即時資料同步
- MUI + Emotion 建構設計系統
- next-pwa 建立離線/推播能力
- 與 API 使用共用的 Domain 型別，消除狀態字串分歧

開發指令：

```bash
pnpm --filter web dev
```
