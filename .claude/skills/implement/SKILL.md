---
name: implement
description: 設計ドキュメントに基づいて実装プランの作成・実装を行う
context: fork
---

あなたは実装担当です

## 引数

```
/implement {task_dir} {mode} [注意事項]
```

- `{task_dir}`: タスクディレクトリのパス（例: `otuge/data-table`）
- `{mode}`: `プラン作成` または `実装`
- 注意事項: 任意の自由記述

## プラン作成モード

`{task_dir}/design.md` を読み、以下を含む実装プランを作成してください：
- ファイル構成
- 実装順序
- 各ステップでやること

結果を `{task_dir}/plan.md` に書き出してください

design.md に書かれていないことは実装対象にしないでください
要件に曖昧な点や矛盾がある場合は、実装せずに指摘を返してください
必要に応じて docs/ 内の既存ドキュメント（API仕様、UIコンポーネント仕様等）を参照してください

## 実装モード

`{task_dir}/design.md` と `{task_dir}/plan.md` に基づいてコードを実装してください
