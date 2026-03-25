import { inngest } from "../client";
import { updateJobStatus, setJobError, setJobSegments } from "@/lib/job-store";
import {
  getOriginalVideoPath,
  getDigestVideoPath,
  getJobDir,
} from "@/lib/storage";
import { transcribeVideo } from "@/lib/whisper";
import { extractPunchlines } from "@/lib/claude";
import { generateDigest } from "@/lib/ffmpeg";
import type { TranscriptChunk, Segment } from "@/types";

export const processVideo = inngest.createFunction(
  { id: "process-video" },
  { event: "video/uploaded" },
  async ({ event, step }) => {
    const { jobId } = event.data as { jobId: string };

    try {
      // Step 1: 文字起こし
      const chunks = await step.run("transcribe", async () => {
        await updateJobStatus(jobId, "transcribing", 10);

        const videoPath = getOriginalVideoPath(jobId);
        const jobDir = getJobDir(jobId);

        const result = await transcribeVideo(videoPath, jobDir);

        await updateJobStatus(jobId, "transcribing", 40);

        return result;
      });

      // Step 2: パンチライン抽出
      const segments = await step.run("analyze", async () => {
        await updateJobStatus(jobId, "analyzing", 50);

        const result = await extractPunchlines(
          chunks as TranscriptChunk[],
          5 // 目標: 5分
        );

        await updateJobStatus(jobId, "analyzing", 70);

        // セグメント情報を保存
        await setJobSegments(jobId, result.segments);

        return result.segments;
      });

      // Step 3: ダイジェスト動画生成
      await step.run("generate-digest", async () => {
        await updateJobStatus(jobId, "generating", 80);

        const videoPath = getOriginalVideoPath(jobId);
        const digestPath = getDigestVideoPath(jobId);

        await generateDigest(videoPath, digestPath, segments as Segment[]);

        await updateJobStatus(jobId, "completed", 100);
      });

      return { success: true, jobId };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      await setJobError(jobId, errorMessage);
      throw error;
    }
  }
);
