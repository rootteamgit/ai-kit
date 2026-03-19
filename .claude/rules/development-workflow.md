# 開発ワークフロー ルール

## Doc 駆動開発

機能の追加・変更は仕様書（`docs/`）を起点に進める。コードを書く前に仕様で合意する

1. 要件を話す — やりたいことを伝えてもらう
2. 仕様書を書く/更新する — `docs/template.md` を元に記述
3. 議論する — 方針を詰め、Decision Log に記録（末尾に追記、既存は変更しない）
4. 実装する — 仕様書を元にコードを書く
5. レビュー — `/code-review` でコードレビュー
6. 仕様変更が必要になったら — コードを変える前に仕様書で議論し、更新してから修正

## ブランチ命名

- すべて小文字、kebab-case
- フォーマット: `type/description`
- type 例: `feature`, `fix`, `refactor`, `setup`

## パッケージ必須スクリプト

すべてのパッケージに `typecheck`, `lint`, `lint:fix`, `test` を定義する

## Bash 実行

常にリポジトリルートから直接コマンドを実行する。以下はセキュリティプロンプトが発生するため禁止:
- `cd path && command`
- `git -C path ...`

## Git コミット

- 複数行メッセージは `-m` を複数回使う（heredoc は使わない）

```bash
git commit -m "本文" -m "Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

## コミット前の確認

- 機能追加・変更 → 対応する `docs/` の仕様書も変更に含まれているか確認
- バグ修正・リファクタ → 確認不要
