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
gh api repos/rootteamgit/ai-kit/contents/scripts/claude-sync.sh?ref=main --jq '.content' | base64 -d > claude-sync.sh; & "C:\Program Files\Git\bin\bash.exe" claude-sync.sh
```

スクリプトは実行後に自動削除される

各プロジェクトの `.gitignore` に `.claude/skills/` と `.claude/tools/` を追加しておくこと

詳細: [`docs/skill-sync.md`](docs/skill-sync.md)


## スキル一覧

| スキル           | 用途                                                 |
| ---------------- | ---------------------------------------------------- |
| `/miko2`         | 開発パートナー。チームを作り設計からレビューまで統率 |
| `/tengi`         | 複数 AI で議論し、設計判断を支援                     |
| `/implement`     | 設計ドキュメントからプラン作成・実装                 |
| `/explain`       | 設計意図なしでコードを説明                           |
| `/design-review` | 設計とコードの照合レビュー                           |
| `/code-review`   | git diff ベースのコードレビュー                      |
| `/adversary`     | 議題・方針の穴を検出                                 |


## ディレクトリ構成

```
├── CLAUDE.md                    # プロジェクト概要（要カスタマイズ）
├── scripts/
│   └── claude-sync.sh           # スキル・ツール同期スクリプト
├── .claude/
│   ├── incidents.md             # 障害・失敗の記録
│   ├── settings.json            # hooks 設定
│   ├── hooks/                   # Bash 禁止パターン等
│   ├── rules/                   # 全 AI が読むルール
│   ├── skills/                  # スキル定義
│   └── tools/                   # ツール（append, checklist 等）
├── docs/                        # 仕様書（docs/index.md 参照）
└── otuge/                       # 実装サイクルの作業場（タスクごと）
```


## フローの育て方

このテンプレートは固定のプロセスではなく、プロジェクトに合わせて成長させるもの

- **失敗をルールに昇格させる** — `.claude/incidents.md` に同じパターンが溜まったら、`.claude/rules/` にルールとして抽出する
- **繰り返す作業をスキル化する** — プロジェクト固有の定型作業が見えたら `.claude/skills/` にスキルとして切り出す
