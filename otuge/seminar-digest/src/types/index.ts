/** ジョブのステータス */
export type JobStatus =
  | "pending"
  | "transcribing"
  | "analyzing"
  | "generating"
  | "completed"
  | "failed";

/** ジョブ情報 */
export type Job = {
  id: string;
  status: JobStatus;
  progress: number; // 0-100
  errorMessage?: string;
  createdAt: string; // ISO 8601
  completedAt?: string; // ISO 8601
  segments?: Segment[]; // 抽出されたセグメント
};

/** パンチライン抽出結果のセグメント */
export type Segment = {
  start: string; // "HH:MM:SS" format
  end: string; // "HH:MM:SS" format
  reason: string;
  quote: string;
};

/** 文字起こしチャンク */
export type TranscriptChunk = {
  start: number; // seconds
  end: number; // seconds
  text: string;
};

/** Claude API のレスポンス */
export type PunchlineExtractionResult = {
  segments: Segment[];
  totalDuration: string; // "MM:SS" format
};
