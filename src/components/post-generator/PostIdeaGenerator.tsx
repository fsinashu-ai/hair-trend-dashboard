"use client";

import { useMemo, useState } from "react";
import { GeneratedPostCard } from "@/components/post-generator/GeneratedPostCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { dummyKeywords } from "@/data/dummyKeywords";
import { dummyTrends } from "@/data/dummyTrends";
import type { GeneratedPost } from "@/types/generatedPost";

type GenerateOutputType =
  | "instagram-caption"
  | "reel-script"
  | "customer-explanation"
  | "next-visit"
  | "retail-product"
  | "morning-brief"
  | "trend-explanation";

type AgeGroup = "20代" | "30代" | "40代" | "50代";
type GenderTarget = "女性" | "男性";
type WritingTone = "上品" | "カジュアル";
type LengthOption = "短め" | "標準" | "長め";
type StatusTone = "neutral" | "info" | "success" | "warning" | "error";

type OutputConfig = {
  type: GenerateOutputType;
  label: string;
  postType: string;
  theme: string;
  content: string;
  hashtags: string[];
};

const outputConfigs: OutputConfig[] = [
  {
    type: "instagram-caption",
    label: "Instagram投稿文",
    postType: "Instagram投稿文",
    theme: "Instagram投稿文案",
    content:
      "髪の広がりやパサつきが気になりやすい季節は、まとまりと艶を整えるケアがおすすめです。\n\nef.mayke`sでは、髪質や履歴を見ながら、くせ毛やダメージに合わせた髪質改善をご提案しています。\n\n毎朝のスタイリングを少し楽にしたい方は、今の髪の状態から一緒に見直していきましょう。",
    hashtags: ["#髪質改善", "#艶髪", "#くせ毛改善", "#美容室"],
  },
  {
    type: "reel-script",
    label: "リール動画台本",
    postType: "リール動画台本",
    theme: "髪質改善リール",
    content:
      "0〜3秒: 「広がる髪、毎朝大変ではありませんか？」\n\n4〜8秒: Beforeの毛先や表面のパサつきを見せる\n\n9〜15秒: 施術中の艶感、アイロン前後、仕上げの動きを短く見せる\n\n16〜22秒: Afterで後ろ姿と顔まわりをゆっくり見せる\n\n締め: 「髪質や履歴に合わせて、無理なく扱いやすい髪へ整えます」",
    hashtags: ["#髪質改善", "#リール動画", "#艶髪", "#美容師"],
  },
  {
    type: "customer-explanation",
    label: "カウンセリング説明",
    postType: "カウンセリング説明",
    theme: "髪質改善の説明",
    content:
      "髪質改善は、髪の広がり、うねり、パサつきが気になる方に向いているケアです。\n\nただ、髪の履歴やダメージによって合う施術は変わります。今日は髪の状態を見ながら、まとまりやすさを優先するのか、艶感を出したいのかを一緒に決めていきましょう。",
    hashtags: ["#髪質改善", "#カウンセリング", "#くせ毛", "#艶髪"],
  },
  {
    type: "next-visit",
    label: "次回来店提案",
    postType: "次回来店提案",
    theme: "次回来店の目安",
    content:
      "今日整えた艶とまとまりを保つなら、次回は6〜8週間後を目安に見せていただくのがおすすめです。\n\nその頃になると、根元の伸びや毛先の乾燥が少しずつ気になりやすくなります。次回は状態を見ながら、髪質改善ケアと毛先のメンテナンスを一緒に考えましょう。",
    hashtags: ["#次回予約", "#髪質改善", "#メンテナンス", "#艶髪"],
  },
  {
    type: "retail-product",
    label: "店販提案",
    postType: "店販提案",
    theme: "ホームケア提案",
    content:
      "今日の仕上がりを長く楽しむために、ご自宅では乾燥を防ぐケアを続けるのがおすすめです。\n\n特に毛先のパサつきが出やすい方は、洗い流さないトリートメントを中間から毛先につけてから乾かすと、まとまりが変わりやすくなります。無理に商品を増やすより、まずは毎日続けやすい1本から始めましょう。",
    hashtags: ["#店販", "#ホームケア", "#ヘアケア", "#艶髪"],
  },
  {
    type: "morning-brief",
    label: "朝礼ネタ",
    postType: "朝礼ネタ",
    theme: "今日の提案共有",
    content:
      "今日の共有テーマは、梅雨前のまとまり提案です。\n\n広がりやパサつきが気になるお客様には、いきなりメニューをすすめるより「朝のセットで一番困るところはどこですか？」と聞くと提案につなげやすくなります。\n\n仕上げでは、艶の見え方と乾かし方を一言添えてお渡ししましょう。",
    hashtags: ["#朝礼ネタ", "#美容師", "#髪質改善", "#サロンワーク"],
  },
  {
    type: "trend-explanation",
    label: "トレンド解説",
    postType: "トレンド解説",
    theme: "髪質改善トレンド",
    content:
      "髪質改善が注目されている理由は、見た目の艶だけでなく、毎日の扱いやすさを求めるお客様が増えているからです。\n\n特にくせ毛、パサつき、カラー後の乾燥が気になる方には、スタイル提案とケア提案をセットで伝えると納得感が出ます。写真では艶感、接客では続けやすさを伝えるのがポイントです。",
    hashtags: ["#トレンド解説", "#髪質改善", "#艶髪", "#美容室"],
  },
];

const ageGroups: AgeGroup[] = ["20代", "30代", "40代", "50代"];
const genderTargets: GenderTarget[] = ["女性", "男性"];
const writingTones: WritingTone[] = ["上品", "カジュアル"];
const lengthOptions: LengthOption[] = ["短め", "標準", "長め"];

function createGeneratedPost(
  config: OutputConfig,
  ageGroup: AgeGroup,
  genderTarget: GenderTarget,
  writingTone: WritingTone,
  length: LengthOption,
): GeneratedPost {
  return {
    id: `${config.type}-${Date.now()}`,
    theme: config.theme,
    postType: config.postType,
    tone: `${writingTone} / ${ageGroup}${genderTarget} / ${length}`,
    content: config.content,
    usedKeywords: dummyKeywords.slice(0, 7).map((keyword) => keyword.name),
    hashtags: config.hashtags,
    createdAt: new Date().toISOString().slice(0, 10),
  };
}

function OptionButtons<T extends string>({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: T[];
  selected: T;
  onSelect: (option: T) => void;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-stone-700">{label}</p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {options.map((option) => (
          <button
            className={`min-h-10 rounded-md border px-3 text-sm font-semibold ${
              selected === option
                ? "border-teal-700 bg-teal-50 text-teal-800"
                : "border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
            }`}
            key={option}
            onClick={() => onSelect(option)}
            type="button"
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PostIdeaGenerator() {
  const [selectedType, setSelectedType] =
    useState<GenerateOutputType>("instagram-caption");
  const [ageGroup, setAgeGroup] = useState<AgeGroup>("30代");
  const [genderTarget, setGenderTarget] = useState<GenderTarget>("女性");
  const [writingTone, setWritingTone] = useState<WritingTone>("上品");
  const [length, setLength] = useState<LengthOption>("標準");
  const [generatedPost, setGeneratedPost] = useState<GeneratedPost | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusTone, setStatusTone] = useState<StatusTone>("neutral");
  const [message, setMessage] = useState("条件を選んで生成すると、実務向けの文章が表示されます。");

  const selectedTrendTitles = useMemo(
    () => dummyTrends.slice(0, 5).map((trend) => trend.title),
    [],
  );

  const selectedKeywords = useMemo(
    () => dummyKeywords.slice(0, 10).map((keyword) => keyword.name),
    [],
  );

  async function handleGenerate(type: GenerateOutputType) {
    const output =
      outputConfigs.find((item) => item.type === type) ?? outputConfigs[0];
    setSelectedType(type);
    setIsGenerating(true);
    setStatusTone("info");
    setMessage("AI APIで生成中です。");

    try {
      const response = await fetch("/api/generate-post", {
        body: JSON.stringify({
          ageGroup,
          genderTarget,
          keywords: selectedKeywords,
          label: output.label,
          length,
          trendTitles: selectedTrendTitles,
          type,
          writingTone,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to generate post idea.");
      }

      const data = (await response.json()) as Omit<GeneratedPost, "id"> & {
        providerLabel?: string;
      };
      setGeneratedPost({
        id: `${type}-${data.createdAt}`,
        ...data,
      });
      setStatusTone("success");
      setMessage(`${data.providerLabel ?? "AI API"}で生成しました。`);
    } catch {
      setGeneratedPost(
        createGeneratedPost(output, ageGroup, genderTarget, writingTone, length),
      );
      setStatusTone("warning");
      setMessage(
        "AI APIで生成できなかったため、実務用のモックレスポンスを表示しています。AI_PROVIDERとAPIキーを確認してください。",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-stone-950">生成メニュー</h2>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {outputConfigs.map((output) => (
            <button
              className={`min-h-12 rounded-md border px-4 text-left text-sm font-semibold transition ${
                selectedType === output.type
                  ? "border-teal-700 bg-teal-50 text-teal-800"
                  : "border-stone-300 bg-white text-stone-800 hover:bg-stone-50"
              }`}
              disabled={isGenerating}
              key={output.type}
              onClick={() => handleGenerate(output.type)}
              type="button"
            >
              {isGenerating && selectedType === output.type
                ? "生成中"
                : output.label}
            </button>
          ))}
        </div>

        <div className="mt-6 grid gap-5">
          <OptionButtons
            label="年代"
            options={ageGroups}
            selected={ageGroup}
            onSelect={setAgeGroup}
          />
          <OptionButtons
            label="対象"
            options={genderTargets}
            selected={genderTarget}
            onSelect={setGenderTarget}
          />
          <OptionButtons
            label="文体"
            options={writingTones}
            selected={writingTone}
            onSelect={setWritingTone}
          />
          <OptionButtons
            label="文字数"
            options={lengthOptions}
            selected={length}
            onSelect={setLength}
          />
        </div>

        <div className="mt-6">
          <p className="text-sm font-medium text-stone-700">参照トレンド</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {selectedTrendTitles.map((title) => (
              <Badge key={title} tone="info">
                {title}
              </Badge>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <p className="text-sm font-medium text-stone-700">使用キーワード</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {selectedKeywords.map((keyword) => (
              <Badge key={keyword} tone="success">
                {keyword}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-stone-950">生成結果</h2>
          <Badge tone="neutral">AI API Route経由</Badge>
        </div>
        <div className="mb-4">
          <StatusMessage isLoading={isGenerating} tone={statusTone}>
            {message}
          </StatusMessage>
        </div>
        {isGenerating ? (
          <EmptyState
            description="選んだメニュー、年代、対象、文体、文字数に合わせて文章を作っています。"
            title="生成中です"
          />
        ) : generatedPost ? (
          <GeneratedPostCard post={generatedPost} />
        ) : (
          <EmptyState
            description="Instagram投稿文、リール台本、カウンセリング説明など、毎日のサロンワークで使う文章を作れます。"
            title="生成結果はまだありません"
          />
        )}
      </div>
    </section>
  );
}
