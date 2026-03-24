# セミナーダイジェスト動画生成アプリ 実装プラン

## ファイル構成

```
otuge/seminar-digest/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # ルートレイアウト
│   │   ├── page.tsx                # トップページ（アップロード画面）
│   │   ├── jobs/
│   │   │   └── [jobId]/
│   │   │       └── page.tsx        # 処理中/完了画面
│   │   └── api/
│   │       ├── upload/
│   │       │   └── route.ts        # 動画アップロード API
│   │       ├── jobs/
│   │       │   └── [jobId]/
│   │       │       ├── route.ts    # ジョブ状態取得 API
│   │       │       └── download/
│   │       │           └── route.ts # ダイジェスト動画ダウンロード API
│   │       └── inngest/
│   │           └── route.ts        # Inngest webhook エンドポイント
│   ├── components/
│   │   ├── upload-zone.tsx         # ドラッグ&ドロップアップロード
│   │   ├── progress-display.tsx    # 進捗表示
│   │   └── video-preview.tsx       # 動画プレビュー
│   ├── inngest/
│   │   ├── client.ts               # Inngest クライアント初期化
│   │   └── functions/
│   │       └── process-video.ts    # メイン処理関数
│   ├── lib/
│   │   ├── storage.ts              # ストレージ操作（Railway Volume）
│   │   ├── whisper.ts              # Whisper API クライアント
│   │   ├── claude.ts               # Claude API クライアント
│   │   ├── ffmpeg.ts               # FFmpeg 操作
│   │   └── job-store.ts            # ジョブ状態管理
│   └── types/
│       └── index.ts                # 共通型定義
├── public/
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── Dockerfile                      # FFmpeg 込みのイメージ
└── .env.example
```

## 実装順序

### Phase 1: プロジェクト基盤

**ステップ 1-1: プロジェクト初期化**
- Next.js プロジェクト作成（App Router, TypeScript, Tailwind CSS）
- 必要パッケージのインストール
  - `inngest`: ジョブキュー
  - `fluent-ffmpeg`: FFmpeg 操作
  - `openai`: Whisper API
  - `@anthropic-ai/sdk`: Claude API
- package.json に `typecheck`, `lint`, `lint:fix`, `test` スクリプト追加

**ステップ 1-2: 型定義**
- `Job` 型（id, status, progress, createdAt, completedAt）
- `Segment` 型（start, end, reason, quote）
- `TranscriptChunk` 型（start, end, text）

**ステップ 1-3: 環境変数設定**
- `.env.example` 作成（OPENAI_API_KEY, ANTHROPIC_API_KEY, INNGEST_EVENT_KEY, STORAGE_PATH）

### Phase 2: ストレージ・ジョブ管理

**ステップ 2-1: ストレージ操作**
- `lib/storage.ts`: Railway Volume への保存・読み込み・削除
- ファイルパス規約: `/volume/jobs/{jobId}/original.mp4`, `/volume/jobs/{jobId}/digest.mp4`

**ステップ 2-2: ジョブ状態管理**
- `lib/job-store.ts`: ジョブの CRUD（JSON ファイルベース）
- ステータス: `pending` → `transcribing` → `analyzing` → `generating` → `completed` / `failed`

### Phase 3: 外部 API 連携

**ステップ 3-1: Whisper API クライアント**
- `lib/whisper.ts`
- 音声抽出（FFmpeg で mp4 → mp3）
- 25MB 制限対応: 音声を分割して送信
- タイムスタンプ付き文字起こし結果のパース

**ステップ 3-2: Claude API クライアント**
- `lib/claude.ts`
- パンチライン抽出プロンプトの実装
- 入力: タイムスタンプ付き文字起こし + 目標時間
- 出力: Segment 配列の JSON パース

**ステップ 3-3: FFmpeg 操作**
- `lib/ffmpeg.ts`
- 音声抽出（mp4 → mp3）
- 指定時間範囲の切り出し
- 複数クリップの結合

### Phase 4: Inngest ジョブ処理

**ステップ 4-1: Inngest 初期化**
- `inngest/client.ts`: クライアント設定
- `app/api/inngest/route.ts`: webhook エンドポイント

**ステップ 4-2: メイン処理関数**
- `inngest/functions/process-video.ts`
- ステップ関数として実装（step.run で各処理を分離）
  1. 文字起こし
  2. パンチライン抽出
  3. 動画切り出し・結合
- 各ステップ完了時にジョブ状態を更新

### Phase 5: API エンドポイント

**ステップ 5-1: アップロード API**
- `app/api/upload/route.ts`
- POST: mp4 受信 → ストレージ保存 → ジョブ作成 → Inngest イベント発火 → jobId 返却
- バリデーション: ファイル形式、サイズ上限

**ステップ 5-2: ジョブ状態取得 API**
- `app/api/jobs/[jobId]/route.ts`
- GET: ジョブの現在状態・進捗を返却

**ステップ 5-3: ダウンロード API**
- `app/api/jobs/[jobId]/download/route.ts`
- GET: ダイジェスト動画をストリーミング返却

### Phase 6: フロントエンド

**ステップ 6-1: 共通レイアウト**
- `app/layout.tsx`: シンプルなヘッダー + コンテンツ領域

**ステップ 6-2: アップロードコンポーネント**
- `components/upload-zone.tsx`
- ドラッグ&ドロップ対応
- ファイル選択ダイアログ
- アップロード中のプログレス表示

**ステップ 6-3: トップページ**
- `app/page.tsx`
- アップロードエリア + 使い方説明
- アップロード完了後に `/jobs/{jobId}` へリダイレクト

**ステップ 6-4: 進捗表示コンポーネント**
- `components/progress-display.tsx`
- ステータスに応じたステップ表示（文字起こし中 → 分析中 → 動画生成中）
- 進捗バー

**ステップ 6-5: 動画プレビューコンポーネント**
- `components/video-preview.tsx`
- HTML5 video 要素でプレビュー再生

**ステップ 6-6: 処理中/完了画面**
- `app/jobs/[jobId]/page.tsx`
- ポーリングでジョブ状態を取得
- 処理中: 進捗表示
- 完了: プレビュー + ダウンロードボタン
- 失敗: エラーメッセージ

### Phase 7: デプロイ準備

**ステップ 7-1: Dockerfile**
- Node.js ベースイメージに FFmpeg インストール
- Next.js スタンドアロンビルド

**ステップ 7-2: 設定ファイル**
- `next.config.ts`: スタンドアロン出力設定
- Railway 用の環境変数ドキュメント

## 各ステップの詳細

### ステップ 1-1: プロジェクト初期化

- `npx create-next-app@latest` で作成
- Tailwind CSS, TypeScript, App Router を有効化
- 依存パッケージ追加:
  ```
  inngest
  fluent-ffmpeg
  @types/fluent-ffmpeg
  openai
  @anthropic-ai/sdk
  ```

### ステップ 3-1: Whisper API 25MB 制限対応

- FFmpeg で音声を抽出（128kbps mp3）
- ファイルサイズが 25MB を超える場合は時間で分割
- 分割した各ファイルを順次 Whisper API に送信
- タイムスタンプを調整して結合

### ステップ 3-2: Claude パンチライン抽出プロンプト

design.md の抽出基準をプロンプトに組み込む:
- 話者が強調している箇所
- 聴衆の反応が想定される発言
- 具体的な事例・エピソード
- 結論・まとめの部分
- 印象的なフレーズ・名言

出力は JSON 形式で、合計時間が目標（約5分）に収まるようにする。

### ステップ 4-2: Inngest ステップ関数

Inngest の step.run を使い、各処理を分離:
```
step.run("transcribe", ...) → TranscriptChunk[]
step.run("analyze", ...) → Segment[]
step.run("generate", ...) → digest.mp4 path
```

これにより、途中で失敗してもリトライが容易になる。

### ステップ 6-6: ポーリング実装

- 2秒間隔でジョブ状態を取得
- 処理完了/失敗でポーリング停止
- AbortController でアンマウント時にキャンセル
