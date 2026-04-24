# 燒了嗎（燒了吗）— 虛擬燒紙網站（全站繁體）

這是一個**純靜態**（HTML/CSS/JS）的網站原型：支援**手機/電腦響應式**、全站繁體字，包含：

- **首頁**：下單入口／焚化入口／上傳圖片區／「冥界空間站」入口／推薦套裝
- **下單頁**：挑選商品加入購物籃
- **結算頁**：填寫資訊並送出訂單
- **個人空間**：每位使用者的獨立空間（以本機儲存模擬登入）
- **冥界空間站**：顯示你下過單的「物品圖片牆」（不顯示金額）

## 如何在本機開啟

方式一（最簡單）：直接雙擊打開 `index.html`。

方式二（建議）：用任意靜態伺服器（避免某些瀏覽器限制）。

## 部署成公開網站（可被搜尋）

你可以用 GitHub Pages / Cloudflare Pages / 任意靜態主機。此專案不需要後端。

> 注意：目前的「使用者獨立空間」是用瀏覽器 `localStorage` 模擬，換裝置就不會同步；若要真正帳號系統，需要後端與資料庫。

## 公開分享牆（Supabase：不同使用者可互相看見 + 公開按讚）

本專案已支援 Supabase（可選）：讓「首頁公開分享牆」顯示**所有使用者**勾選為「可公開」的圖片，並且按讚數同步。

- **步驟 1：建立 Supabase 專案**
  - 到 Supabase 建新 Project
  - 進入 **SQL Editor**，把 `assets/supabase.schema.sql` 全貼上並執行

- **步驟 2：建立 Storage Bucket**
  - Storage → **New bucket**
  - bucket 名稱請用：`public-offerings`
  - bucket 設為 **Public**

- **步驟 3：填入前端金鑰**
  - 打開 `assets/supabase.config.js`
  - 把 `window.SHAOLEMA_SUPABASE_URL` 與 `window.SHAOLEMA_SUPABASE_ANON_KEY` 改成你的專案值（Project Settings → API）

完成後：
- 到「冥界空間站」把圖片切成「可公開」
- 回首頁即可在分享區看到**全站公開牆**，右下角可按讚且數字會同步


