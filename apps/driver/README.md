# Driver App

以 Expo Router 建構的外送員專用介面，支援 Web 與原生 App。主要功能：

- 接收 READY 訂單通知並顯示地圖路線
- 切換狀態（接單、配送、完成、回報問題）
- 顯示推薦批次、預估距離與時間，支援一鍵領取整批訂單
- 上傳送達照片與簽收紀錄
- GPS 定位回報給後台與離線排程補送
- 登入憑證透過 AsyncStorage 持久化，原生端重啟後仍可保留會話

開發指令：

```bash
pnpm install
pnpm --filter driver dev
```

> 若要直接呼叫受保護 API，請在 `.env` 中設定 `EXPO_PUBLIC_DRIVER_EMAIL` 和 `EXPO_PUBLIC_DRIVER_PASSWORD`，並先透過 `/api/v1/auth/register` 建立對應的 DRIVER 角色帳號。
