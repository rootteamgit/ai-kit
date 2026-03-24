"use client";

import { useRouter } from "next/navigation";
import { UploadZone } from "@/components/upload-zone";

export default function Home() {
  const router = useRouter();

  const handleUploadComplete = (jobId: string) => {
    router.push(`/jobs/${jobId}`);
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          セミナー動画からダイジェストを自動生成
        </h2>
        <p className="text-gray-600">
          AIが動画から重要なパンチラインを抽出し、約5分のダイジェスト動画を作成します
        </p>
      </div>

      <UploadZone onUploadComplete={handleUploadComplete} />

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">使い方</h3>
        <ol className="list-decimal list-inside space-y-2 text-gray-600">
          <li>mp4形式のセミナー動画をアップロード</li>
          <li>AIが自動で文字起こしを行い、重要な部分を抽出</li>
          <li>約5分のダイジェスト動画が生成されます</li>
          <li>完成した動画をダウンロード</li>
        </ol>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">抽出基準</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>・話者が強調している箇所</li>
            <li>・具体的な事例・エピソード</li>
            <li>・結論・まとめの部分</li>
            <li>・印象的なフレーズ・名言</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
