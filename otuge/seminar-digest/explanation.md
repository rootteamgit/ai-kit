# seminar-digest コード説明

## 概要

このコードは Next.js 上で動作する Web アプリケーションで、動画ファイルをアップロードすると、AIが文字起こしと分析を行い、重要な部分を抽出したダイジェスト動画を生成する。

## 処理フロー

1. ユーザーがトップページで動画をアップロード
2. バックグラウンドジョブ（Inngest）が以下の処理を順次実行
   - Whisper API による文字起こし
   - Claude API によるパンチライン抽出
   - ffmpeg によるダイジェスト動画生成
3. ユーザーはジョブページで進捗を確認し、完了後に動画をダウンロード

## ファイル構成と各ファイルの処理内容

### 型定義 (`src/types/index.ts`)

- `JobStatus`: ジョブの状態を表す文字列リテラル型（pending, transcribing, analyzing, generating, completed, failed）
- `Job`: ジョブ情報の型。ID、状態、進捗（0-100）、エラーメッセージ、作成日時、完了日時を持つ
- `Segment`: 抽出されたパンチラインのセグメント。開始・終了時間（HH:MM:SS形式）、選択理由、引用テキストを持つ
- `TranscriptChunk`: 文字起こしの1単位。開始・終了時間（秒）とテキストを持つ
- `PunchlineExtractionResult`: Claude API からの抽出結果。セグメント配列と合計時間を持つ

### ストレージ操作 (`src/lib/storage.ts`)

- 環境変数 `STORAGE_PATH`（デフォルト `/tmp/seminar-digest`）配下にファイルを保存
- ジョブごとに `jobs/{jobId}/` ディレクトリを作成
- 各関数はパス取得、ディレクトリ作成、ファイル保存・読込・削除・存在確認・サイズ取得を行う
- ファイル名は固定: `original.mp4`（アップロード動画）、`audio.mp3`（抽出音声）、`digest.mp4`（出力動画）

### ジョブ管理 (`src/lib/job-store.ts`)

- ジョブ情報を JSON ファイル（`job.json`）として保存・読込
- `createJob`: 新規ジョブを pending 状態で作成
- `getJob`: ジョブ ID から情報を取得。ファイルがなければ null を返す
- `updateJobStatus`: 状態と進捗を更新。completed または failed の場合は完了日時も設定
- `setJobError`: エラー状態に更新し、エラーメッセージを記録
- `deleteJob`: ジョブディレクトリごと削除

### ffmpeg 操作 (`src/lib/ffmpeg.ts`)

- `timeToSeconds` / `secondsToTime`: 時間文字列（HH:MM:SS）と秒数の相互変換
- `extractAudio`: 動画から音声を MP3（128kbps）で抽出
- `getVideoDuration`: 動画の長さを秒数で取得
- `splitAudio`: 音声を指定秒数（デフォルト600秒=10分）ごとに分割。Whisper API の 25MB 制限対応用
- `cutVideo`: 動画の一部を切り出し。コーデックコピーで高速処理
- `concatenateVideos`: 複数クリップを concat demuxer で結合
- `generateDigest`: セグメントリストを元に切り出し→結合を行い、一時ファイルを削除

### Whisper 連携 (`src/lib/whisper.ts`)

- OpenAI クライアントをシングルトンで管理
- `transcribeAudioFile`: 単一音声ファイルを Whisper API で文字起こし。verbose_json 形式でセグメントごとのタイムスタンプを取得。オフセット秒数を加算して返す
- `transcribeVideo`: 動画から音声を抽出し、25MB 以下ならそのまま、超える場合は 10 分ごとに分割して順次処理。分割処理では各チャンクの長さを取得してオフセットを累積
- `formatTranscript`: チャンク配列をタイムスタンプ付きテキストに整形

### Claude 連携 (`src/lib/claude.ts`)

- Anthropic クライアントをシングルトンで管理
- システムプロンプトでパンチライン抽出の基準を定義（強調箇所、聴衆反応、事例、結論、名言）
- `extractPunchlines`: 文字起こしテキストと目標時間（デフォルト5分）を Claude に送信。JSON 形式でセグメント情報を返却させ、コードブロック内の JSON にも対応してパース

### Inngest クライアント (`src/inngest/client.ts`)

- ID "seminar-digest" で Inngest クライアントを生成

### バックグラウンド処理 (`src/inngest/functions/process-video.ts`)

- "video/uploaded" イベントをトリガーに `processVideo` 関数を実行
- Step 1: 文字起こし（進捗 10→40%）
- Step 2: パンチライン分析（進捗 50→70%）。目標 5 分
- Step 3: ダイジェスト生成（進捗 80→100%）
- エラー発生時は `setJobError` でジョブをエラー状態にして再スロー

### API エンドポイント

#### `/api/upload` (POST)

- FormData から "video" ファイルを取得
- バリデーション: video/* または .mp4 拡張子、最大 500MB
- UUID でジョブ ID 生成
- ディレクトリ作成、ファイル保存、ジョブ作成
- Inngest に "video/uploaded" イベントを送信
- ジョブ ID を返却

#### `/api/jobs/[jobId]` (GET)

- ジョブ ID からジョブ情報を取得して返却
- 存在しなければ 404

#### `/api/jobs/[jobId]/download` (GET)

- ジョブが completed でない場合は 400
- ダイジェスト動画ファイルが存在しない場合は 404
- ファイルを読み込み、Content-Disposition 付きで返却

#### `/api/inngest`

- Inngest の serve 関数で GET/POST/PUT を処理
- `processVideo` 関数を登録

### フロントエンド

#### レイアウト (`src/app/layout.tsx`)

- 日本語設定（lang="ja"）
- ヘッダーに "Seminar Digest" タイトル
- 最大幅 4xl でコンテンツを中央配置
- Tailwind CSS によるスタイリング

#### トップページ (`src/app/page.tsx`)

- クライアントコンポーネント
- `UploadZone` コンポーネントでアップロード UI を表示
- アップロード完了時に `/jobs/{jobId}` へ遷移
- 使い方と抽出基準の説明を表示

#### ジョブページ (`src/app/jobs/[jobId]/page.tsx`)

- クライアントコンポーネント
- `use(params)` で jobId を取得
- `useEffect` で 2 秒ごとにジョブ情報をポーリング
- completed/failed 以外の場合はポーリング継続
- AbortController でアンマウント時にリクエストをキャンセル
- 状態に応じて表示を切り替え:
  - completed: 完成メッセージ + VideoPreview
  - failed: エラーメッセージ
  - それ以外: ProgressDisplay で進捗表示

#### UploadZone (`src/components/upload-zone.tsx`)

- ドラッグ&ドロップまたはクリックでファイル選択
- クライアント側バリデーション: video/* または .mp4、最大 500MB
- XMLHttpRequest でアップロード進捗を表示
- アップロード中は UI を無効化（pointer-events-none）

#### ProgressDisplay (`src/components/progress-display.tsx`)

- プログレスバーと 4 ステップ表示（文字起こし、分析、生成、完了）
- 現在のステップを `findIndex` で特定
- 完了ステップはチェックマーク、現在ステップは「処理中...」アニメーション

#### VideoPreview (`src/components/video-preview.tsx`)

- `/api/jobs/{jobId}/download` を video タグの src に設定
- ダウンロードボタンで download 属性付きリンクを提供
