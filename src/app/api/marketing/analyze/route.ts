import { NextResponse } from "next/server";
import { generateAiText } from "@/lib/ai/server";
import { getSalonPromptContext } from "@/lib/salonProfile";
import { seoMockAnalysis } from "@/data/seoAds";

export const runtime = "nodejs";

type AnalysisRequest = {
  context?: unknown;
  scope?: "seo" | "ads";
};

function serializeContext(value: unknown) {
  try {
    return JSON.stringify(value ?? {}, null, 2).slice(0, 12000);
  } catch {
    return "{}";
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as AnalysisRequest;
  const scope = body.scope === "ads" ? "ads" : "seo";

  try {
    const result = await generateAiText({
      maxOutputTokens: 1400,
      prompt: [
        `分析対象: ${scope === "ads" ? "広告管理メモ" : "SEO管理データ"}`,
        "以下の入力データを確認し、優先順位の高い改善提案を3〜5項目に整理してください。",
        "各提案は、理由と次に行う小さな作業が分かる文章にしてください。",
        "Google APIとの接続、広告の自動出稿、予算の自動変更、WordPressへの自動投稿は提案しないでください。",
        "データ:",
        serializeContext(body.context),
      ].join("\n\n"),
      systemInstruction: [
        "あなたは美容室ef.mayke`sのSEO・広告管理を支援する日本語アシスタントです。",
        "分析、改善提案、下書き作成だけを行い、外部サービスの設定変更や広告操作は行いません。",
        "売り込みすぎず、大人女性の髪質改善、縮毛矯正、くせ毛、パサつき、白髪、松江市の美容室検索を重視してください。",
        getSalonPromptContext(),
      ].join("\n\n"),
    });

    return NextResponse.json({
      analysis: result.text,
      isMock: false,
      provider: result.provider,
      providerLabel: result.providerLabel,
    });
  } catch {
    return NextResponse.json({
      analysis: seoMockAnalysis,
      isMock: true,
      provider: "mock",
      providerLabel: "モック分析",
    });
  }
}
