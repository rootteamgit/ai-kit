"use client";

import { useState, useCallback, useRef } from "react";

type Props = {
  onUploadComplete: (jobId: string) => void;
};

export function UploadZone({ onUploadComplete }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const uploadFile = useCallback(
    async (file: File) => {
      setError(null);
      setIsUploading(true);
      setUploadProgress(0);

      // バリデーション
      if (!file.type.startsWith("video/") && !file.name.endsWith(".mp4")) {
        setError("mp4形式の動画ファイルをアップロードしてください");
        setIsUploading(false);
        return;
      }

      const maxSize = 500 * 1024 * 1024; // 500MB
      if (file.size > maxSize) {
        setError("ファイルサイズは500MB以下にしてください");
        setIsUploading(false);
        return;
      }

      const formData = new FormData();
      formData.append("video", file);

      try {
        // XMLHttpRequest を使って進捗を取得
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100);
            setUploadProgress(progress);
          }
        });

        const response = await new Promise<{ jobId: string }>(
          (resolve, reject) => {
            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                resolve(JSON.parse(xhr.responseText));
              } else {
                try {
                  const errorData = JSON.parse(xhr.responseText);
                  reject(new Error(errorData.error || "Upload failed"));
                } catch {
                  reject(new Error("Upload failed"));
                }
              }
            };
            xhr.onerror = () => reject(new Error("Network error"));
            xhr.open("POST", "/api/upload");
            xhr.send(formData);
          }
        );

        onUploadComplete(response.jobId);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "アップロードに失敗しました"
        );
      } finally {
        setIsUploading(false);
      }
    },
    [onUploadComplete]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        uploadFile(file);
      }
    },
    [uploadFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        uploadFile(file);
      }
    },
    [uploadFile]
  );

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full">
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors
          ${isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"}
          ${isUploading ? "pointer-events-none opacity-60" : ""}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,.mp4"
          onChange={handleFileSelect}
          className="hidden"
        />

        {isUploading ? (
          <div>
            <div className="text-lg font-medium text-gray-700 mb-4">
              アップロード中...
            </div>
            <div className="w-full max-w-xs mx-auto bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <div className="text-sm text-gray-500 mt-2">{uploadProgress}%</div>
          </div>
        ) : (
          <>
            <div className="text-4xl mb-4">📹</div>
            <div className="text-lg font-medium text-gray-700">
              動画をドラッグ&ドロップ
            </div>
            <div className="text-sm text-gray-500 mt-2">
              またはクリックしてファイルを選択
            </div>
            <div className="text-xs text-gray-400 mt-4">
              mp4形式、最大500MB、90分まで
            </div>
          </>
        )}
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
