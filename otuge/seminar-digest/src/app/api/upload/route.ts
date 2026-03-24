import { NextRequest, NextResponse } from "next/server";
import { createJob } from "@/lib/job-store";
import { createJobDir, getOriginalVideoPath, saveFile } from "@/lib/storage";
import { inngest } from "@/inngest/client";

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("video") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No video file provided" },
        { status: 400 }
      );
    }

    // ファイル形式のバリデーション
    if (!file.type.startsWith("video/") && !file.name.endsWith(".mp4")) {
      return NextResponse.json(
        { error: "Invalid file format. Only mp4 is supported." },
        { status: 400 }
      );
    }

    // ファイルサイズのバリデーション
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 500MB." },
        { status: 400 }
      );
    }

    // ジョブIDを生成
    const jobId = crypto.randomUUID();

    // ジョブディレクトリを作成
    await createJobDir(jobId);

    // ファイルを保存
    const buffer = Buffer.from(await file.arrayBuffer());
    const videoPath = getOriginalVideoPath(jobId);
    await saveFile(videoPath, buffer);

    // ジョブを作成
    await createJob(jobId);

    // Inngest イベントを発火
    await inngest.send({
      name: "video/uploaded",
      data: { jobId },
    });

    return NextResponse.json({ jobId });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload video" },
      { status: 500 }
    );
  }
}
