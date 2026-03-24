"use client";

type Props = {
  jobId: string;
};

export function VideoPreview({ jobId }: Props) {
  const videoUrl = `/api/jobs/${jobId}/download`;

  return (
    <div className="w-full">
      <video
        controls
        className="w-full rounded-lg shadow-lg"
        preload="metadata"
      >
        <source src={videoUrl} type="video/mp4" />
        お使いのブラウザは動画再生に対応していません。
      </video>

      <div className="mt-4 flex justify-center">
        <a
          href={videoUrl}
          download={`digest-${jobId}.mp4`}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          ダウンロード
        </a>
      </div>
    </div>
  );
}
