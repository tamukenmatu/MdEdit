# Project Context & Antigravity Playbook (AGENTS.md)

本ドキュメントは、本プロジェクトを担当する自律 AI エージェント（Antigravity）がプロジェクトの文脈を把握し、自律的に運用・開発を進めるための実行手引書です。

## 1. Autonomous Project Notes
Antigravity はプロジェクトの進行に伴い、判明した仕様、アーキテクチャ設計、ポート番号、起動手順などをここに自律的に追記・更新してコンテキストを維持すること。

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
