import Anthropic from "@anthropic-ai/sdk";
import type { PunchlineExtractionResult, TranscriptChunk } from "@/types";
import { formatTranscript } from "./whisper";

let anthropicClient: Anthropic | null = null;

function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic();
  }
  return anthropicClient;
}

const SYSTEM_PROMPT = `あなたはセミナー動画の編集者です。
文字起こしテキストを分析し、視聴者にとって最も価値のある「パンチライン」（印象的で重要な部分）を抽出してください。

## 抽出基準
以下の基準に基づいてセグメントを選択してください：
1. 話者が強調している箇所（声のトーンや言い回しから推測）
2. 聴衆の反応が想定される発言
3. 具体的な事例・エピソード
4. 結論・まとめの部分
5. 印象的なフレーズ・名言

## 出力形式
JSON形式で出力してください。各セグメントには以下を含めてください：
- start: 開始時間（HH:MM:SS形式）
- end: 終了時間（HH:MM:SS形式）
- reason: このセグメントを選んだ理由（日本語）
- quote: このセグメントの代表的な発言（日本語）

合計時間が目標時間に近づくように調整してください。
時間の前後に少し余裕を持たせて、文脈が自然につながるようにしてください。`;

/**
 * 文字起こしからパンチラインを抽出する
 */
export async function extractPunchlines(
  chunks: TranscriptChunk[],
  targetDurationMinutes: number = 5
): Promise<PunchlineExtractionResult> {
  const transcript = formatTranscript(chunks);

  const userPrompt = `以下はセミナーの文字起こしです。
目標時間: 約${targetDurationMinutes}分

## 文字起こし
${transcript}

## 指示
上記の文字起こしから、最も重要で印象的なセグメントを抽出してください。
合計時間が約${targetDurationMinutes}分になるように選択してください。

JSONのみを出力してください。説明は不要です。

出力形式:
{
  "segments": [
    {
      "start": "HH:MM:SS",
      "end": "HH:MM:SS",
      "reason": "選択理由",
      "quote": "代表的な発言"
    }
  ],
  "totalDuration": "MM:SS"
}`;

  const response = await getAnthropic().messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: userPrompt,
      },
    ],
    system: SYSTEM_PROMPT,
  });

  // レスポンスからテキストを抽出
  const textContent = response.content.find((c) => c.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("Claude API returned no text content");
  }

  // JSONをパース（コードブロック内の場合も対応）
  let jsonText = textContent.text.trim();
  const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonText = jsonMatch[1].trim();
  }

  const result = JSON.parse(jsonText) as PunchlineExtractionResult;

  // バリデーション
  if (!result.segments || !Array.isArray(result.segments)) {
    throw new Error("Invalid response format: segments array is missing");
  }

  return result;
}
