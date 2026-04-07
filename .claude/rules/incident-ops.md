# 障害・失敗の記録ルール

コード作成・ビルド・設定などで問題が発生した場合、
append ツールで `.claude/incidents.md` の末尾に追記すること

```bash
node .claude/tools/append.mjs .claude/incidents.md "## {date:YYYY-mm-DD}: [問題の概要（1行）]

- **カテゴリ**: config | build | runtime | dependency | design | other
- **原因**: 何が間違っていたか
- **対策**: 具体的にどう修正したか（コード例や正しい記法を含める）
- **教訓**: この問題から得られる一般的な学び（1〜2文、他の場面にも適用できる汎用的な気づき）"
```

迷ったら記録する。不要なら後で消せるが、記録しなかった知見は失われる
