# MdEdit プロジェクト開発・デザイン規約 (AGENTS.md)

本ドキュメントは、MdEdit プロジェクトにおけるアーキテクチャ、デザイン規約、動的 CSS ローディング仕様、および全ノード（Mac / Linux / Windows）への決定論的ビルド手順を定義する公式ルールです。AI エージェントおよび開発者は本規約を遵守して開発を行ってください。

---

## 1. プロジェクト概要 & アーキテクチャ

* **Tauri v2 + Vite フロントエンド**:
  - Rust による軽量・セキュアなネイティブバックエンドと、Vanilla JS / Modern CSS による高速な Markdown ビューア＆エディタ。
  - Obsidian Vault（保管庫）とのシームレスな連携、目次（TOC）自動生成、Markdown リアルタイムレンダリング、コードシンタックスハイライト、数式（KaTeX）、作図（Mermaid）を内蔵。

---

## 2. デザイン & ビューワー改修規約 (再ビルド不要の動的 CSS)

### 2.1 CSS / スタイリング資産の配置場所
* **本体組み込み CSS**: [`src/style.css`](file:///Users/km1/.gemini/antigravity/scratch/MdEdit/src/style.css)
* **保管庫ごとの動的カスタム CSS**:
  - **Mac (iCloud 直結)**: `/Users/km1/Library/Mobile Documents/iCloud~md~obsidian/Documents/01KEN/.mdedit/style.css`
  - **Windows (WebDAV マウント)**: `Z:\.mdedit\style.css`
  - **Linux (WebDAV マウント)**: `~/Obsidian/.mdedit/style.css`

### 2.2 再ビルド不要のデザイン更新サイクル
* **ビューワーの見た目（テーブル幅、コールアウト、フォントサイズ、ダークテーマ調整等）を改修する際は、アプリケーションの再ビルドは不要**。
* 保管庫直下の `.mdedit/style.css` または `src/style.css` を編集・保存するだけで、次回 Vault 読み込み時（または起動時）に即時適用されます。

---

## 3. UI / アイコンデザイン原則 (Design Requirements)

* **絵文字（Emoji）使用の禁止**:
  - ボタン、バッジ、ステータス表示、メニュー、ナビゲーション等において絵文字（🚀, 🌐, 🛡️, ❌ 等）を使用しないこと。
  - すべてのアイコン装飾には **SVG アイコン** を使用すること（`fill: none; stroke: currentColor; stroke-width: 2;`）。

---

## 4. 全 OS 決定論的ビルド & デプロイコマンド (Distributed Native Build)

本プロジェクトは GitHub Actions のクラウドビルドに依存せず、Tailscale 経由で各実機ノードに接続してネイティブビルドを実行します。

### 4.1 ワンクリック全プラットフォーム同時ビルド
```bash
./scripts/build-all.sh
```

### 4.2 OS 単体ビルドスクリプト

| プラットフォーム | 実行スクリプト | 動作内容 | 成果物の配置先 |
| :--- | :--- | :--- | :--- |
| **macOS (`k-m1` & `air`)** | `./scripts/build-mac.sh` | ローカルで Vite + Cargo ビルドを実行後、ローカルおよび SSH 経由で MacBook Air (`air`) に配布 | `/Applications/MdEdit.app`<br>`air:/Applications/MdEdit.app` |
| **Linux (`k-gmk`)** | `./scripts/build-linux.sh` | rsync で同期後、SSH 経由で Wayland / GTK3 ネイティブビルド | `k-gmk:/home/ken/Apps/mdedit` |
| **Windows (`msi`)** | `./scripts/build-windows.sh` | rsync で同期後、SSH 経由で MSVC ポータブルビルド | `msi:C:\Users\makke\Documents\Myapplication\MdEdit.exe` |

---

## 5. モード初期化仕様 (View / Edit モード決定論)

* **レンダリング対象ファイル (`.md`, `.markdown`, `.html`, `.htm`, `.svg`)**:
  - 直前の編集状態に関わらず、**必ず `view` モードで開く**。
* **プレーンテキスト / コード (`.txt`, `.py`, `.js`, `.json`, `.csv`, `.log` 等)**:
  - 開いた瞬間に即座に編集できる **`edit` モードで開く**。

<!-- === RPROXY TOOL SEARCH HARNESS: START === -->
## 2. Local Machine Tools & Capabilities
```yaml
local_tool_search:
  policy: "Tier-1 (rg, jq, fd, uv等) は直接最優先で使用可能。tool-search はリモート機（msi等）連携や特殊ツールの逆引き辞書として使用すること"
  command: "tool-search"
  usage:
    lookup_by_keyword: "tool-search [keyword]"
    list_active_tools: "tool-search"
  description: "用途・カテゴリ・キーワードから利用可能なローカルCLIと日本語用途を逆引き"
```
<!-- === RPROXY TOOL SEARCH HARNESS: END === -->
