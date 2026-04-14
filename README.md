# ai-kit

Claude Code で AI 駆動開発を行うためのスキル・ツール・ルール集


## スキル同期

各プロジェクトで以下を実行すると、ai-kit から最新のスキル・ツールを同期する:

```bash
# Linux
gh api repos/rootteamgit/ai-kit/contents/scripts/claude-sync.sh?ref=main --jq '.content' | base64 -d > claude-sync.sh && bash claude-sync.sh

# macOS
gh api repos/rootteamgit/ai-kit/contents/scripts/claude-sync.sh?ref=main --jq '.content' | base64 -D > claude-sync.sh && bash claude-sync.sh

# Windows
& "C:\Program Files\Git\bin\bash.exe" -c "gh api repos/rootteamgit/ai-kit/contents/scripts/claude-sync.sh?ref=main --jq '.content' | base64 -d > claude-sync.sh && bash claude-sync.sh"
```

スクリプトは実行後に自動削除される

各プロジェクトの `.gitignore` に `.claude/skills/` と `.claude/tools/` を追加しておくこと

詳細: [`docs/skill-sync.md`](docs/skill-sync.md)


## スキル一覧

| スキル           | 用途                                                             |
| ---------------- | ---------------------------------------------------------------- |
| `/miko3`         | 開発パートナー。knowledge/ 参照、チーム管理、設計〜レビューまで |
| `/miko2`         | 開発パートナー（旧版、docs/ 依存）                               |
| `/tengi`         | 複数 AI で議論し、設計判断を支援                                 |
| `/implement`     | 設計ドキュメントからプラン作成・実装                             |
| `/explain`       | 設計意図なしでコードを説明                                       |
| `/design-review` | 設計とコードの照合レビュー                                       |
| `/code-review`   | git diff ベースのコードレビュー                                  |
| `/adversary`     | 議題・方針の穴を検出                                             |


## ディレクトリ構成

```
├── CLAUDE.md                    # プロジェクト概要（要カスタマイズ）
├── scripts/
│   └── claude-sync.sh           # スキル・ツール同期スクリプト
├── knowledge/
│   ├── domain.jsonl             # ドメイン知識・設計判断
│   └── pitfalls.jsonl           # AI の実装ミス記録
├── .claude/
│   ├── settings.json            # hooks 設定
│   ├── hooks/                   # Bash 禁止パターン等
│   ├── rules/                   # 全 AI が読むルール
│   ├── skills/                  # スキル定義
│   └── tools/                   # ツール（append, checklist, knowledge 等）
└── otuge/                       # 実装サイクルの作業場（タスクごと）
```


## フローの育て方

このテンプレートは固定のプロセスではなく、プロジェクトに合わせて成長させるもの

- **pitfalls をルールに昇格させる** — `knowledge/pitfalls.jsonl` に同じパターンが溜まったら、`.claude/rules/` にコーディング規約として抽出する
- **繰り返す作業をスキル化する** — プロジェクト固有の定型作業が見えたら `.claude/skills/` にスキルとして切り出す
