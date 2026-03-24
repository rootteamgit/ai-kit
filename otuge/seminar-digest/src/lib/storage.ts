import { promises as fs } from "fs";
import path from "path";

export const STORAGE_PATH = process.env.STORAGE_PATH || "/tmp/seminar-digest";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * jobId が有効な UUID 形式か検証する
 * @throws Error 無効な形式の場合
 */
export function validateJobId(jobId: string): void {
  if (!UUID_REGEX.test(jobId)) {
    throw new Error("Invalid jobId format");
  }
}

/**
 * ジョブ用のディレクトリパスを取得する
 * @throws Error jobId が無効な形式の場合
 */
export function getJobDir(jobId: string): string {
  validateJobId(jobId);
  return path.join(STORAGE_PATH, "jobs", jobId);
}

/**
 * オリジナル動画のファイルパスを取得する
 */
export function getOriginalVideoPath(jobId: string): string {
  return path.join(getJobDir(jobId), "original.mp4");
}

/**
 * 抽出した音声ファイルのパスを取得する
 */
export function getAudioPath(jobId: string): string {
  return path.join(getJobDir(jobId), "audio.mp3");
}

/**
 * ダイジェスト動画のファイルパスを取得する
 */
export function getDigestVideoPath(jobId: string): string {
  return path.join(getJobDir(jobId), "digest.mp4");
}

/**
 * ジョブ用のディレクトリを作成する
 */
export async function createJobDir(jobId: string): Promise<void> {
  const dir = getJobDir(jobId);
  await fs.mkdir(dir, { recursive: true });
}

/**
 * ファイルを保存する
 */
export async function saveFile(filePath: string, data: Buffer): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, data);
}

/**
 * ファイルを読み込む
 */
export async function readFile(filePath: string): Promise<Buffer> {
  return fs.readFile(filePath);
}

/**
 * ファイルが存在するか確認する
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * ファイルを削除する
 */
export async function deleteFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch {
    // ファイルが存在しない場合は無視
  }
}

/**
 * ジョブ用のディレクトリを削除する
 */
export async function deleteJobDir(jobId: string): Promise<void> {
  const dir = getJobDir(jobId);
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch {
    // ディレクトリが存在しない場合は無視
  }
}

/**
 * ファイルサイズを取得する
 */
export async function getFileSize(filePath: string): Promise<number> {
  const stats = await fs.stat(filePath);
  return stats.size;
}
