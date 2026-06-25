# 漢字源流 · 字形演變探索

> 追溯漢字從甲骨文、金文、戰國文字到現代的千年演變軌跡

## 功能

- **字形查詢**：輸入任意漢字，即時展示其在各歷史時期的字形演變
- **題庫練習**：學習模式 + 測驗模式，4 個詞庫規模可選
- **實時加載**：圖片直接從中央研究院小學堂服務器在線加載（需網絡）

## 技術架構

```
靜態前端 (HTML / CSS / JS)
    ↓ POST /api/proxy
Cloudflare Pages Function (代理)
    ↓ POST
中央研究院小學堂 xiaoxue.iis.sinica.edu.tw
    ↓ 字形圖片 URL 嵌入 HTML
瀏覽器直接請求圖片 (實時加載)
```

## 本地開發

```bash
npm install -g wrangler
wrangler pages dev . --compatibility-date=2024-01-01
```

## 部署

推送到 GitHub，在 Cloudflare Pages 中連接倉庫即可自動部署。

## 數據來源

字形數據及圖片版權歸 [中央研究院語言學研究所](https://xiaoxue.iis.sinica.edu.tw/yanbian) 所有。  
本工具僅供學習與交流使用。
