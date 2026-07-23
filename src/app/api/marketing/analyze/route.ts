import { NextResponse } from "next/server";
import { generateAiText } from "@/lib/ai/server";
import { getSalonPromptContext } from "@/lib/salonProfile";
import { seoMockAnalysis } from "@/data/seoAds";
import { getEmailMetricsAnalysisContext } from "@/lib/emailMetrics";

export const runtime = "nodejs";

type AnalysisRequest = {
  context?: unknown;
  scope?: "seo" | "ads" | "integrated";
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
  const scope = body.scope === "ads" ? "ads" : body.scope === "integrated" ? "integrated" : "seo";
  const scopeLabel = scope === "ads" ? "広告管理データ" : scope === "integrated" ? "ページ統合分析データ" : "SEO管理データ";
  const supplementalEmailMetrics = getEmailMetricsAnalysisContext();

  try {
    const result = await generateAiText({
      maxOutputTokens: 1400,
      prompt: [
        `分析対象: ${scopeLabel}`,
        "以下の入力データを確認し、優先順位の高い改善提案を3〜5項目に整理してください。",
        "各提案は、理由と次に行う小さな作業が分かる文章にしてください。",
        "入力に含まれる集計値や判定結果を尊重し、元データにない数値・事例・実績を作らないでください。数値計算やしきい値判定はアプリ側の結果を前提にしてください。",
        "提案は下書き・確認用に限定し、広告の出稿・停止・予算変更・外部サービスの設定変更を行う指示は出さないでください。",
        "Google APIとの接続、広告の自動出稿、予算の自動変更、WordPressへの自動投稿は提案しないでください。",
        "データ:",
        serializeContext(body.context),
        "メール月次レポートによる補完コンテキスト（GA4・広告等へ加算禁止）:",
        serializeContext(supplementalEmailMetrics),
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
