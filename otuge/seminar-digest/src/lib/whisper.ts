import OpenAI from "openai";
import { promises as fs } from "fs";
import path from "path";
import type { TranscriptChunk } from "@/types";
import {
  extractAudio,
  splitAudio,
  getVideoDuration,
  secondsToTime,
} from "./ffmpeg";
import { getFileSize } from "./storage";

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI();
  }
  return openaiClient;
}

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const CHUNK_DURATION = 600; // 10分（25MB以下に収まるよう余裕を持たせる）

/**
 * Whisper API で文字起こしを行う（タイムスタンプ付き）
 */
async function transcribeAudioFile(
  audioPath: string,
  offsetSeconds: number = 0
): Promise<TranscriptChunk[]> {
  const file = await fs.readFile(audioPath);
  const blob = new Blob([file], { type: "audio/mp3" });
  const fileObj = new File([blob], path.basename(audioPath), {
    type: "audio/mp3",
  });

  const response = await getOpenAI().audio.transcriptions.create({
    file: fileObj,
    model: "whisper-1",
    response_format: "verbose_json",
    timestamp_granularities: ["segment"],
  });

  // レスポンスからセグメントを抽出
  const segments = response.segments || [];

  return segments.map((segment) => ({
    start: segment.start + offsetSeconds,
    end: segment.end + offsetSeconds,
    text: segment.text,
  }));
}

/**
 * 動画ファイルを文字起こしする
 * 長い動画は自動的に分割して処理する
 */
export async function transcribeVideo(
  videoPath: string,
  jobDir: string
): Promise<TranscriptChunk[]> {
  const audioPath = path.join(jobDir, "audio.mp3");

  // 音声を抽出
  await extractAudio(videoPath, audioPath);

  // ファイルサイズをチェック
  const fileSize = await getFileSize(audioPath);

  if (fileSize <= MAX_FILE_SIZE) {
    // 25MB以下ならそのまま送信
    return transcribeAudioFile(audioPath);
  }

  // 25MBを超える場合は分割して処理
  const chunksDir = path.join(jobDir, "audio_chunks");
  await fs.mkdir(chunksDir, { recursive: true });

  const chunkPaths = await splitAudio(audioPath, chunksDir, CHUNK_DURATION);

  const allChunks: TranscriptChunk[] = [];
  let offsetSeconds = 0;

  for (const chunkPath of chunkPaths) {
    const chunks = await transcribeAudioFile(chunkPath, offsetSeconds);
    allChunks.push(...chunks);

    // 次のチャンクのオフセットを計算
    const chunkDuration = await getVideoDuration(chunkPath);
    offsetSeconds += chunkDuration;

    // 一時ファイルを削除
    await fs.unlink(chunkPath).catch(() => {});
  }

  // チャンクディレクトリを削除
  await fs.rm(chunksDir, { recursive: true, force: true }).catch(() => {});

  return allChunks;
}

/**
 * 文字起こし結果をタイムスタンプ付きテキストに変換する
 */
export function formatTranscript(chunks: TranscriptChunk[]): string {
  return chunks
    .map((chunk) => {
      const startTime = secondsToTime(chunk.start);
      const endTime = secondsToTime(chunk.end);
      return `[${startTime} - ${endTime}] ${chunk.text}`;
    })
    .join("\n");
}
