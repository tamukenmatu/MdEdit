# テスト文書 (Test Document)

これは macOS 専用 Markdown ビューア＆エディタ **MdEdit** の動作確認用ファイルです。

---

## セクション1: フォーマット検証

- リスト項目 1
- リスト項目 2
  - ネストされた項目 A
  - ネストされた項目 B

### 引用テキスト
> MdEdit は爆速起動かつ超軽量なデスクトップ Markdown スイートです。

---

## セクション2: コードブロック検証

```rust
fn calculate_reading_time(words: usize) -> usize {
    (words + 399) / 400
}
```

```javascript
function greet(user) {
    return `Hello, ${user}!`;
}
```

---

## セクション3: テーブル検証

| 項目 | 値 | 状態 |
| :--- | :---: | ---: |
| 起動速度 | < 0.2s | 最適化済み |
| バイナリサイズ | ~8.7MB | 超軽量 |
| 絵文字ポリシー | 0個 | 厳格遵守 |
| テーマ | Spark Dark | 適用済み |
