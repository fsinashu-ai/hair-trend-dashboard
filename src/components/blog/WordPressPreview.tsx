"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { createWordPressPreviewHtml, lineReservationUrl } from "@/lib/blog";
import type { BlogPostInput } from "@/types/blog";

type WordPressPreviewProps = {
  post: BlogPostInput;
};

async function copyText(value: string) {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    return false;
  }

  await navigator.clipboard.writeText(value);
  return true;
}

export function WordPressPreview({ post }: WordPressPreviewProps) {
  const [message, setMessage] = useState("");
  const html = createWordPressPreviewHtml(post.content, post.wordpressHtml);

  async function handleCopy(label: string, value: string) {
    const copied = await copyText(value);
    setMessage(copied ? `${label}をコピーしました。` : "コピーできませんでした。");
  }

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-stone-950">
            WordPress貼り付け用プレビュー
          </h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            タイトル、スラッグ、メタディスクリプション、本文HTMLを分けて確認できます。
          </p>
        </div>
        <Badge tone="info">HTML</Badge>
      </div>

      {message ? (
        <p className="mt-4 rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-800">
          {message}
        </p>
      ) : null}

      <div className="mt-5 grid gap-4">
        <PreviewField
          label="タイトル"
          value={post.title}
          onCopy={() => handleCopy("タイトル", post.title)}
        />
        <PreviewField
          label="スラッグ"
          value={post.slug}
          onCopy={() => handleCopy("スラッグ", post.slug)}
        />
        <PreviewField
          label="メタディスクリプション"
          value={post.metaDescription}
          onCopy={() =>
            handleCopy("メタディスクリプション", post.metaDescription)
          }
        />
        <PreviewField
          label="メタタイトル"
          value={post.metaTitle ?? ""}
          onCopy={() => handleCopy("メタタイトル", post.metaTitle ?? "")}
        />
        <div>
          <p className="text-sm font-semibold text-stone-700">表示プレビュー</p>
          <div
            className="mt-2 rounded-md border border-stone-200 bg-white p-4 text-sm leading-7 text-stone-800 [&_a]:font-semibold [&_a]:text-teal-700 [&_blockquote]:border-l-4 [&_blockquote]:border-teal-200 [&_blockquote]:pl-3 [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_ul]:list-disc"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-stone-700">本文HTML</p>
            <button
              className="min-h-9 rounded-md border border-teal-200 px-3 text-xs font-semibold text-teal-700 hover:bg-teal-50"
              onClick={() => handleCopy("本文HTML", html)}
              type="button"
            >
              コピー
            </button>
          </div>
          <textarea
            className="mt-2 min-h-80 w-full rounded-md border border-stone-300 bg-stone-50 px-3 py-2 font-mono text-xs leading-6 text-stone-800 outline-none"
            readOnly
            value={html}
          />
        </div>
      </div>

      <div className="mt-5 rounded-md border border-teal-100 bg-teal-50 p-3">
        <p className="text-xs font-semibold text-teal-900">CTAリンク</p>
        <p className="mt-1 break-words text-sm leading-6 text-teal-900">
          {lineReservationUrl}
        </p>
      </div>
    </section>
  );
}

function PreviewField({
  label,
  onCopy,
  value,
}: {
  label: string;
  onCopy: () => void;
  value: string;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-stone-700">{label}</p>
        <button
          className="min-h-9 rounded-md border border-teal-200 px-3 text-xs font-semibold text-teal-700 hover:bg-teal-50"
          onClick={onCopy}
          type="button"
        >
          コピー
        </button>
      </div>
      <div className="mt-2 rounded-md border border-stone-200 bg-stone-50 p-3 text-sm leading-6 text-stone-800">
        {value || "未入力"}
      </div>
    </div>
  );
}
