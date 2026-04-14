# knowledge ルール

## 構造

- `knowledge/domain.jsonl` — コードからは読み取れないドメイン知識・設計判断。詳細は `knowledge-domain.md`
- `knowledge/pitfalls.jsonl` — AI が実装で犯したミスの記録。再発防止が目的。詳細は `knowledge-pitfalls.md`

## JSONL フィールド

```jsonl
{"key":"識別名","insight":"知見の内容","source":"user-stated","tags":["auth","session"],"date":"2026-04-14","refs":["src/path.ts"]}
```

| フィールド | 必須 | 内容                                                  |
| ---------- | ---- | ----------------------------------------------------- |
| key        | ○    | 短い識別名（kebab-case、削除時に使用）                |
| insight    | ○    | 知見の内容                                            |
| source     | ○    | `user-stated` / `observed` / `inferred`               |
| tags       | ○    | 機能名やカテゴリ、トピックなど（kebab-case、最低1つ） |
| date       | ○    | 記録日（YYYY-MM-DD）                                  |
| refs       | △    | 関連ファイルパス（陳腐化検出用）                      |

## source の意味と優先度

読み取り時、source の優先度 → 日付の新しい順でソートされる

| source        | 意味                        | 優先度 |
| ------------- | --------------------------- | ------ |
| `user-stated` | 人間が教えた                | 最高   |
| `observed`    | AI がコードから確認した事実 | 中     |
| `inferred`    | AI が推測した               | 低     |

## 読み書きはスクリプト経由

パスはリポジトリルートからの相対パス（`knowledge/` から始まる）

```bash
# 追加
# -key: 識別名（kebab-case）  -insight: 知見  -source: 上記参照  -tags: 必須  -refs: 任意
node .claude/tools/knowledge.mjs add knowledge/domain.jsonl -key "session-method" -insight "JWT ではなくサーバーサイドセッションを採用" -source "user-stated" -tags "auth,session" -refs "src/auth/session.ts"

# 読み取り
# デフォルト上限10件  -tags: 完全一致優先、部分一致も含む  -refs: ファイルパスでフィルタ  -limit 0: 無制限（デフォルト10件）
node .claude/tools/knowledge.mjs read knowledge/domain.jsonl -tags "auth"

# 削除
# -key: 削除対象の識別名
node .claude/tools/knowledge.mjs delete knowledge/domain.jsonl -key "session-method"
```
