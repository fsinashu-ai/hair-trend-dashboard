"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { uploadHairImageToSupabase } from "@/lib/supabase/images";
import type {
  HairImageAnalysisResult,
  UploadedHairImage,
} from "@/types/hairImageAnalysis";

type StatusTone = "neutral" | "info" | "success" | "warning" | "error";

const maxImageSize = 8 * 1024 * 1024;
const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];
const supabaseEnabled = isSupabaseConfigured();

function createMockAnalysis(fileName?: string): HairImageAnalysisResult {
  return {
    estimatedCategory: "レディース",
    styleClassification:
      "顔まわりに動きが出るミディアム〜レイヤー系のスタイルとして提案しやすい印象です。",
    bobShortLayerJudgement:
      "ボブやショートよりも、顔まわりと毛先に軽さを出すレイヤースタイル寄りです。",
    grayBlendingJudgement:
      "白髪ぼかしの有無は画像だけでは断定できません。明るさやハイライトの入り方はカウンセリングで確認してください。",
    confidence: "中",
    features: [
      "顔まわりに動きが出やすいシルエットです。",
      "毛先の軽さを活かしたスタイリング提案と相性がよいです。",
      "艶感を足すとSNS投稿で仕上がりが伝わりやすくなります。",
    ],
    glossDescription:
      "毛流れに沿って艶が出ると、顔まわりの動きとまとまりが伝わりやすくなります。投稿では光の当たる角度で仕上がりを見せると効果的です。",
    tags: ["#レイヤーカット", "#顔まわり", "#艶髪", "#美容室"],
    snsDescription: `${fileName ?? "アップロード画像"}の雰囲気をもとに、顔まわりの動きと扱いやすさが伝わる投稿文を作れます。来店前のお客様には、普段のセット方法や髪質に合わせて調整できることを添えると相談につながりやすいです。`,
    reelDescription:
      "冒頭は「顔まわりで印象を変えたい方へ」。Beforeで重さや毛先の動きを見せ、Afterで艶と毛流れが分かる角度をゆっくり見せる構成がおすすめです。",
    menuSuggestion: "顔まわりカット + 艶トリートメント + スタイリングレクチャー",
    customerExplanation:
      "画像だけの推定ですが、毛先の軽さやまとまりを見ながら、普段の扱いやすさを重視して提案できます。",
    caution:
      "これはモック分析です。実際の髪質、履歴、ダメージ状態はカウンセリングで確認してください。",
  };
}

function validateImage(file: File) {
  if (!allowedImageTypes.includes(file.type)) {
    return "JPEG、PNG、WebP形式の画像を選択してください。";
  }

  if (file.size > maxImageSize) {
    return "画像サイズは8MB以下にしてください。";
  }

  return "";
}

export function HairImageAnalyzer() {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const previewUrlRef = useRef("");
  const [uploadedImage, setUploadedImage] = useState<UploadedHairImage | null>(
    null,
  );
  const [analysis, setAnalysis] = useState<HairImageAnalysisResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusTone, setStatusTone] = useState<StatusTone>(
    supabaseEnabled ? "neutral" : "warning",
  );
  const [message, setMessage] = useState(
    supabaseEnabled
      ? "ヘア画像を選択すると、Supabase Storageへ保存してからAI分析できます。"
      : "Supabase環境変数が未設定のため、画像保存は行わずモック分析で動作します。",
  );

  useEffect(
    () => () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    },
    [],
  );

  const storageLabel = useMemo(() => {
    if (uploadedImage) {
      return `保存済み: ${uploadedImage.path}`;
    }

    return supabaseEnabled ? "Storage保存待ち" : "Storage未設定";
  }, [uploadedImage]);

  function updatePreviewUrl(file: File | null) {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }

    const nextPreviewUrl = file ? URL.createObjectURL(file) : "";
    previewUrlRef.current = nextPreviewUrl;
    setPreviewUrl(nextPreviewUrl);
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setUploadedImage(null);
    setAnalysis(null);

    if (!file) {
      setSelectedImage(null);
      updatePreviewUrl(null);
      setStatusTone(supabaseEnabled ? "neutral" : "warning");
      setMessage("ヘア画像を選択してください。");
      return;
    }

    const errorMessage = validateImage(file);

    if (errorMessage) {
      setSelectedImage(null);
      updatePreviewUrl(null);
      setStatusTone("error");
      setMessage(errorMessage);
      return;
    }

    setSelectedImage(file);
    updatePreviewUrl(file);
    setStatusTone("info");
    setMessage("画像を選択しました。分析ボタンを押してください。");
  }

  async function handleAnalyze() {
    if (!selectedImage) {
      setStatusTone("warning");
      setMessage("先にヘア画像を選択してください。");
      return;
    }

    setIsProcessing(true);
    setUploadedImage(null);
    setAnalysis(null);

    try {
      if (!supabaseEnabled) {
        setAnalysis(createMockAnalysis(selectedImage.name));
        setStatusTone("warning");
        setMessage(
          "Supabase Storageが未設定のため、画像は保存せずモック分析を表示しています。",
        );
        return;
      }

      setStatusTone("info");
      setMessage("画像をSupabase Storageへ保存しています。");
      const uploaded = await uploadHairImageToSupabase(selectedImage);

      if (!uploaded) {
        throw new Error("Storage upload is not configured.");
      }

      setUploadedImage(uploaded);
      setMessage("画像を保存しました。AI APIで分析しています。");

      const formData = new FormData();
      formData.append("image", selectedImage);
      formData.append("storagePath", uploaded.path);

      const response = await fetch("/api/analyze-hair-image", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to analyze hair image.");
      }

      const data = (await response.json()) as HairImageAnalysisResult;
      setAnalysis(data);
      setStatusTone("success");
      setMessage("画像保存とAI分析が完了しました。");
    } catch {
      setAnalysis(createMockAnalysis(selectedImage.name));
      setStatusTone("warning");
      setMessage(
        "画像保存またはGemini分析に失敗したため、モック分析を表示しています。Supabase Storageを確認し、時間をおいてもう一度お試しください。",
      );
    } finally {
      setIsProcessing(false);
    }
  }

  function handleReset() {
    setSelectedImage(null);
    updatePreviewUrl(null);
    setUploadedImage(null);
    setAnalysis(null);
    setStatusTone(supabaseEnabled ? "neutral" : "warning");
    setMessage(
      supabaseEnabled
        ? "ヘア画像を選択すると、Supabase Storageへ保存してからAI分析できます。"
        : "Supabase環境変数が未設定のため、画像保存は行わずモック分析で動作します。",
    );
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="grid content-start gap-5">
        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-stone-950">
              ヘア画像アップロード
            </h2>
            <Badge tone={supabaseEnabled ? "success" : "warning"}>
              {supabaseEnabled ? "Storage保存" : "モック動作"}
            </Badge>
          </div>

          <label className="mt-5 grid gap-2 text-sm font-medium text-stone-700">
            画像ファイル
            <input
              accept="image/jpeg,image/png,image/webp"
              className="min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none file:mr-3 file:rounded-md file:border-0 file:bg-stone-950 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white focus:border-teal-600"
              onChange={handleImageChange}
              type="file"
            />
          </label>

          <p className="mt-3 text-xs leading-5 text-stone-500">
            JPEG、PNG、WebPに対応。8MB以下の画像を選択してください。SNS投稿の自動取得やスクレイピングは行いません。
          </p>

          <div className="mt-5 overflow-hidden rounded-lg border border-stone-200 bg-stone-50">
            {previewUrl ? (
              <div
                aria-label="選択したヘア画像のプレビュー"
                className="aspect-[4/3] bg-cover bg-center"
                role="img"
                style={{ backgroundImage: `url(${previewUrl})` }}
              />
            ) : (
              <div className="grid aspect-[4/3] place-items-center px-6 text-center">
                <p className="text-sm leading-6 text-stone-500">
                  ここに選択したヘア画像のプレビューが表示されます。
                </p>
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              className="min-h-11 rounded-md bg-stone-950 px-4 text-sm font-semibold text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
              disabled={!selectedImage || isProcessing}
              onClick={handleAnalyze}
              type="button"
            >
              {isProcessing ? "保存・分析中" : "画像を保存してAI分析"}
            </button>
            <button
              className="min-h-11 rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-700 hover:bg-stone-50"
              onClick={handleReset}
              type="button"
            >
              リセット
            </button>
          </div>
        </div>

        <StatusMessage isLoading={isProcessing} tone={statusTone}>
          {message}
        </StatusMessage>

        <div className="rounded-lg border border-stone-200 bg-white p-4 text-sm shadow-sm sm:p-5">
          <p className="font-semibold text-stone-950">保存先</p>
          <p className="mt-2 break-words leading-6 text-stone-600">
            {storageLabel}
          </p>
        </div>
      </div>

      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-stone-950">AI分析結果</h2>
          <Badge tone="neutral">AI API Route経由</Badge>
        </div>

        {analysis ? (
          <article className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="success">推定カテゴリ {analysis.estimatedCategory}</Badge>
              <Badge tone="info">信頼度 {analysis.confidence}</Badge>
            </div>

            <section className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="rounded-md border border-stone-100 p-4">
                <h3 className="text-sm font-semibold text-stone-950">
                  ヘアスタイル分類
                </h3>
                <p className="mt-2 text-sm leading-6 text-stone-700">
                  {analysis.styleClassification}
                </p>
              </div>
              <div className="rounded-md border border-stone-100 p-4">
                <h3 className="text-sm font-semibold text-stone-950">
                  ボブ/ショート/レイヤー判定
                </h3>
                <p className="mt-2 text-sm leading-6 text-stone-700">
                  {analysis.bobShortLayerJudgement}
                </p>
              </div>
              <div className="rounded-md border border-stone-100 p-4">
                <h3 className="text-sm font-semibold text-stone-950">
                  白髪ぼかし判定
                </h3>
                <p className="mt-2 text-sm leading-6 text-stone-700">
                  {analysis.grayBlendingJudgement}
                </p>
              </div>
            </section>

            <section className="mt-5">
              <h3 className="text-sm font-semibold text-stone-950">
                ヘアスタイル特徴
              </h3>
              <ul className="mt-3 grid gap-2 text-sm leading-6 text-stone-700">
                {analysis.features.map((feature) => (
                  <li key={feature}>・{feature}</li>
                ))}
              </ul>
            </section>

            <section className="mt-5 rounded-md bg-teal-50 p-4">
              <h3 className="text-sm font-semibold text-teal-950">
                艶感説明
              </h3>
              <p className="mt-3 text-sm leading-6 text-teal-900">
                {analysis.glossDescription}
              </p>
            </section>

            <section className="mt-5">
              <h3 className="text-sm font-semibold text-stone-950">
                SNS向けタグ
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {analysis.tags.map((tag) => (
                  <Badge key={tag} tone="info">
                    {tag}
                  </Badge>
                ))}
              </div>
            </section>

            <section className="mt-5 rounded-md bg-stone-50 p-4">
              <h3 className="text-sm font-semibold text-stone-950">
                投稿文生成
              </h3>
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-stone-700">
                {analysis.snsDescription}
              </p>
            </section>

            <section className="mt-5 rounded-md bg-stone-50 p-4">
              <h3 className="text-sm font-semibold text-stone-950">
                リール説明生成
              </h3>
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-stone-700">
                {analysis.reelDescription}
              </p>
            </section>

            <section className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-md border border-stone-100 p-4">
                <h3 className="text-sm font-semibold text-stone-950">
                  メニュー提案
                </h3>
                <p className="mt-2 text-sm leading-6 text-stone-700">
                  {analysis.menuSuggestion}
                </p>
              </div>
              <div className="rounded-md border border-stone-100 p-4">
                <h3 className="text-sm font-semibold text-stone-950">
                  お客様向け説明生成
                </h3>
                <p className="mt-2 text-sm leading-6 text-stone-700">
                  {analysis.customerExplanation}
                </p>
              </div>
            </section>

            <p className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
              {analysis.caution}
            </p>
          </article>
        ) : (
          <EmptyState
            description="ヘア画像を選択して分析すると、特徴、推定カテゴリ、SNS投稿向け説明がここに表示されます。"
            title="分析結果はまだありません"
          />
        )}
      </div>
    </section>
  );
}
