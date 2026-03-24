"use client";

import type { JobStatus } from "@/types";

type Props = {
  status: JobStatus;
  progress: number;
};

const STEPS = [
  { status: "transcribing" as const, label: "文字起こし中" },
  { status: "analyzing" as const, label: "パンチライン分析中" },
  { status: "generating" as const, label: "ダイジェスト生成中" },
  { status: "completed" as const, label: "完了" },
];

function getStepIndex(status: JobStatus): number {
  const index = STEPS.findIndex((step) => step.status === status);
  return index >= 0 ? index : 0;
}

export function ProgressDisplay({ status, progress }: Props) {
  const currentStepIndex = getStepIndex(status);

  return (
    <div className="w-full">
      {/* プログレスバー */}
      <div className="w-full bg-gray-200 rounded-full h-3 mb-6">
        <div
          className="bg-blue-600 h-3 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* ステップ表示 */}
      <div className="space-y-3">
        {STEPS.map((step, index) => {
          const isCompleted = index < currentStepIndex;
          const isCurrent = index === currentStepIndex && status !== "completed";
          const isPending = index > currentStepIndex;

          return (
            <div
              key={step.status}
              className={`flex items-center gap-3 ${
                isPending ? "text-gray-400" : "text-gray-700"
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${
                  isCompleted
                    ? "bg-green-500 text-white"
                    : isCurrent
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 text-gray-400"
                }`}
              >
                {isCompleted ? "✓" : index + 1}
              </div>
              <span
                className={`${
                  isCurrent ? "font-medium" : ""
                } ${isCompleted ? "line-through" : ""}`}
              >
                {step.label}
              </span>
              {isCurrent && (
                <span className="animate-pulse text-blue-600 text-sm">
                  処理中...
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* 進捗率表示 */}
      <div className="mt-6 text-center text-gray-500">
        進捗: {progress}%
      </div>
    </div>
  );
}
