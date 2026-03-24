import { NextRequest, NextResponse } from "next/server";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { getJob } from "@/lib/job-store";
import { getDigestVideoPath, fileExists } from "@/lib/storage";

type RouteParams = {
  params: Promise<{ jobId: string }>;
};

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { jobId } = await params;

  const job = await getJob(jobId);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (job.status !== "completed") {
    return NextResponse.json(
      { error: "Digest video is not ready yet" },
      { status: 400 }
    );
  }

  const digestPath = getDigestVideoPath(jobId);

  if (!(await fileExists(digestPath))) {
    return NextResponse.json(
      { error: "Digest video file not found" },
      { status: 404 }
    );
  }

  const stats = await stat(digestPath);
  const stream = createReadStream(digestPath);

  // Node.js の Readable を Web ReadableStream に変換
  const webStream = new ReadableStream({
    start(controller) {
      stream.on("data", (chunk) => {
        controller.enqueue(chunk);
      });
      stream.on("end", () => {
        controller.close();
      });
      stream.on("error", (err) => {
        controller.error(err);
      });
    },
    cancel() {
      stream.destroy();
    },
  });

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="digest-${jobId}.mp4"`,
      "Content-Length": stats.size.toString(),
    },
  });
}
