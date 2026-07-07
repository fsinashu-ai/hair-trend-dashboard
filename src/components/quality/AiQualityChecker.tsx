"use client";

import { FormEvent, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { StatusMessage } from "@/components/ui/StatusMessage";
import type {
  QualityCheckResult,
  QualityContentType,
  QualityIssue,
  QualityVerdict,
} from "@/types/qualityCheck";

type StatusTone = "neutral" | "info" | "success" | "warning" | "error";

const contentTypeOptions: Array<{ label: string; value: QualityContentType }> = [
  { label: "ブログ", value: "blog" },
  { label: "広告文", value: "ad" },
  { label: "レポート", value: "report" },
  { label: "その他", value: "other" },
];

const verdictLabels: Record<QualityVerdict, string> = {
  blocked: "修正が必要",
  needs_review: "確認が必要",
  ok: "大きな注意点なし",
};

const verdictTones: Record<QualityVerdict, "danger" | "warning" | "success"> = {
  blocked: "danger",
  needs_review: "warning",
  ok: "success",
};

const severityLabels = {
  high: "高",
  low: "低",
  medium: "中",
};

const severityTones = {
  high: "danger",
  low: "info",
  medium: "warning",
} as const;

const sampleText = [
  "松江で髪質改善をお探しの大人女性へ。",
  "ef.mayke`sでは、髪の状態を丁寧に確認し、髪質改善やストレート施術をご提案しています。",
  "本気で髪を綺麗にしたい方は、まずはLINEでご相談ください。",
].join("\n\n");

function resultTone(result: QualityCheckResult | null): StatusTone {
  if (!result) return "neutral";
  if (result.verdict === "ok") return "success";
  if (result.verdict === "blocked") return "error";
  return "warning";
}

function issueTone(issue: QualityIssue) {
  return severityTones[issue.severity];
}

export function AiQualityChecker() {
  const [contentType, setContentType] = useState<QualityContentType>("blog");
  const [title, setTitle] = useState("");
  const [sourceLabel, setSourceLabel] = useState("AI生成文");
  const [content, setContent] = useState("");
  const [result, setResult] = useState<QualityCheckResult | null>(null);
  const [message, setMessage] = useState("AI生成文を貼り付けて、公開前チェックを実行してください。");
  const [tone, setTone] = useState<StatusTone>("neutral");
  const [isChecking, setIsChecking] = useState(false);

  const groupedIssues = useMemo(() => {
    const groups = new Map<string, QualityIssue[]>();
    for (const issue of result?.issues ?? []) {
      const current = groups.get(issue.label) ?? [];
      current.push(issue);
      groups.set(issue.label, current);
    }
    return Array.from(groups.entries());
  }, [result]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!content.trim()) {
      setTone("warning");
      setMessage("チェックする本文を入力してください。");
      return;
    }

    setIsChecking(true);
    setTone("info");
    setMessage("AI生成文をチェックしています。");
    setResult(null);

    try {
      const response = await fetch("/api/quality-check", {
        body: JSON.stringify({ content, contentType, sourceLabel, title }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = (await response.json()) as {
        error?: string;
        result?: QualityCheckResult;
      };

      if (!response.ok || !data.result) {
        throw new Error(data.error || "AI品質チェックに失敗しました。");
      }

      setResult(data.result);
      setTone(resultTone(data.result));
      setMessage(data.result.summary);
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "AI品質チェックに失敗しました。");
    } finally {
      setIsChecking(false);
    }
  }

  function useSampleText() {
    setTitle("髪質改善ブログ下書き");
    setContent(sampleText);
    setSourceLabel("サンプル");
    setResult(null);
    setTone("neutral");
    setMessage("サンプル文を入力しました。必要に応じて編集してチェックしてください。");
  }

  return (
    <div className="space-y-5 pb-10">
      <StatusMessage isLoading={isChecking} tone={tone}>
        {message}
      </StatusMessage>

      <form
        className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5"
        onSubmit={handleSubmit}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-stone-700">
            種類
            <select
              className="min-h-11 rounded-md border border-stone-300 bg-white px-3 font-normal"
              onChange={(event) =>
                setContentType(event.target.value as QualityContentType)
              }
              value={contentType}
            >
              {contentTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm font-semibold text-stone-700">
            出典メモ
            <input
              className="min-h-11 rounded-md border border-stone-300 px-3 font-normal"
              onChange={(event) => setSourceLabel(event.target.value)}
              placeholder="例: ブログ生成、広告案、月次レポート"
              value={sourceLabel}
            />
          </label>

          <label className="grid gap-2 text-sm font-semibold text-stone-700 sm:col-span-2">
            タイトル
            <input
              className="min-h-11 rounded-md border border-stone-300 px-3 font-normal"
              onChange={(event) => setTitle(event.target.value)}
              placeholder="例: 松江市で髪質改善を相談したい方へ"
              value={title}
            />
          </label>

          <label className="grid gap-2 text-sm font-semibold text-stone-700 sm:col-span-2">
            チェックする本文
            <textarea
              className="min-h-72 rounded-md border border-stone-300 p-3 font-normal leading-7"
              onChange={(event) => setContent(event.target.value)}
              placeholder="AIが作ったブログ本文、広告文、レポート文を貼り付けます。"
              value={content}
            />
          </label>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button
            className="min-h-11 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
            disabled={isChecking}
            type="submit"
          >
            {isChecking ? "チェック中" : "公開前チェック"}
          </button>
          <button
            className="min-h-11 rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-700 hover:bg-stone-50"
            onClick={useSampleText}
            type="button"
          >
            サンプルを入れる
          </button>
        </div>
      </form>

      {result ? (
        <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-teal-700">
                {result.checkedBy === "gemini" ? "Gemini + ルールチェック" : "ルールチェック"}
              </p>
              <h2 className="mt-1 text-lg font-semibold text-stone-950">
                チェック結果
              </h2>
            </div>
            <Badge tone={verdictTones[result.verdict]}>
              {verdictLabels[result.verdict]}
            </Badge>
          </div>

          {result.safePoints.length > 0 ? (
            <div className="mt-4 rounded-md bg-teal-50 p-3">
              <p className="text-sm font-semibold text-teal-900">問題なさそうな点</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-teal-800">
                {result.safePoints.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {groupedIssues.length > 0 ? (
            <div className="mt-5 space-y-4">
              {groupedIssues.map(([label, issues]) => (
                <section
                  className="rounded-lg border border-stone-200 bg-stone-50 p-4"
                  key={label}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-stone-950">{label}</h3>
                    <Badge tone="neutral">{issues.length}件</Badge>
                  </div>
                  <div className="mt-3 space-y-3">
                    {issues.map((issue, index) => (
                      <article
                        className="rounded-md border border-stone-200 bg-white p-3"
                        key={`${issue.category}-${issue.excerpt}-${index}`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={issueTone(issue)}>
                            重要度 {severityLabels[issue.severity]}
                          </Badge>
                        </div>
                        <p className="mt-3 text-sm font-semibold text-stone-700">
                          該当箇所
                        </p>
                        <p className="mt-1 whitespace-pre-wrap rounded-md bg-stone-50 p-3 text-sm leading-6 text-stone-700">
                          {issue.excerpt || "該当文の特定はできませんでした。"}
                        </p>
                        <p className="mt-3 text-sm leading-6 text-stone-600">
                          {issue.reason}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-teal-800">
                          修正案: {issue.suggestion}
                        </p>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <p className="mt-5 rounded-md bg-stone-50 p-4 text-sm leading-6 text-stone-600">
              注意表現は検出されませんでした。ただし、価格・メニュー・口コミ・実績は公開前に必ず実データと照合してください。
            </p>
          )}
        </section>
      ) : null}
    </div>
  );
}
