"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import type { Job } from "@/types";
import { ProgressDisplay } from "@/components/progress-display";
import { VideoPreview } from "@/components/video-preview";

type Props = {
  params: Promise<{ jobId: string }>;
};

export default function JobPage({ params }: Props) {
  const { jobId } = use(params);
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const fetchJob = async () => {
      try {
        const response = await fetch(`/api/jobs/${jobId}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          if (response.status === 404) {
            setError("ジョブが見つかりませんでした");
            return;
          }
          throw new Error("Failed to fetch job");
        }

        const data = await response.json();
        setJob(data);

        // 処理中の場合はポーリングを継続
        if (data.status !== "completed" && data.status !== "failed") {
          setTimeout(fetchJob, 2000);
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        setError("ジョブ情報の取得に失敗しました");
      }
    };

    fetchJob();

    return () => {
      controller.abort();
    };
  }, [jobId]);

  if (error) {
    return (
      <div className="text-center">
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-700 mb-4">
          {error}
        </div>
        <Link href="/" className="text-blue-600 hover:underline">
          トップに戻る
        </Link>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="text-center">
        <div className="animate-pulse text-gray-500">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {job.status === "completed" ? (
        <>
          <div className="text-center">
            <div className="text-4xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-gray-900">
              ダイジェスト動画が完成しました！
            </h2>
          </div>

          <VideoPreview jobId={jobId} />

          {/* 抽出されたセグメント一覧 */}
          {job.segments && job.segments.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                抽出されたシーン
              </h3>
              <div className="space-y-4">
                {job.segments.map((segment, index) => (
                  <div
                    key={index}
                    className="border-l-4 border-blue-500 pl-4 py-2"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                        {segment.start} - {segment.end}
                      </span>
                    </div>
                    <p className="text-gray-800 font-medium mb-1">
                      「{segment.quote}」
                    </p>
                    <p className="text-sm text-gray-600">
                      → {segment.reason}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-center">
            <Link
              href="/"
              className="text-blue-600 hover:underline"
            >
              別の動画を処理する
            </Link>
          </div>
        </>
      ) : job.status === "failed" ? (
        <div className="text-center">
          <div className="text-4xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            処理に失敗しました
          </h2>
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 mb-4">
            {job.errorMessage || "不明なエラーが発生しました"}
          </div>
          <Link href="/" className="text-blue-600 hover:underline">
            もう一度試す
          </Link>
        </div>
      ) : (
        <>
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              動画を処理中です
            </h2>
            <p className="text-gray-600">
              しばらくお待ちください（数分〜十数分かかる場合があります）
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <ProgressDisplay status={job.status} progress={job.progress} />
          </div>
        </>
      )}
    </div>
  );
}
