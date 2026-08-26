# オーダーメーカー (order-maker)

合唱などの並び順(座席表)を作成・共有できるWebアプリ。

## 開発

```bash
npm install
npm run dev
```

## ビルド

```bash
npm run build
```

## 主な機能

- パターン(タブ)ごとの並び順管理
- 行ごとの人数・すき間を柔軟に指定できるグリッド配置(段違いの合唱隊形に対応)
- パートごとの自動色分け
- ガイド線・指揮者マークの表示
- CSV/JSON書き出し・読み込み、PNG画像として保存
- Firebase Firestoreによるリアルタイム共有リンク

## 構成

- `src/` — Vite + React + TypeScript製アプリ本体
- `legacy/` — 旧バージョン(素のHTML/CSS/JS)。参照用に残しています
