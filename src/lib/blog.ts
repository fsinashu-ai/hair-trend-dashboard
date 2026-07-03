import { salonProfile } from "@/lib/salonProfile";
import type {
  BlogCategory,
  BlogFaq,
  BlogGenerateRequest,
  BlogGenerateResponse,
  BlogGeneratedBy,
  BlogHeading,
  BlogPost,
  BlogPostInput,
  BlogStatus,
  SeoBlogFields,
} from "@/types/blog";

export const blogCategories: BlogCategory[] = [
  "髪質改善",
  "縮毛矯正",
  "白髪ぼかし",
  "大人女性ヘア",
  "ショート",
  "ボブ",
  "ヘアカラー",
  "ホームケア",
  "松江市美容室",
  "SNS投稿ネタ",
];

export const blogStatuses: BlogStatus[] = [
  "idea",
  "draft",
  "ready",
  "published",
];

export const blogStatusLabels: Record<BlogStatus, string> = {
  idea: "ネタ",
  draft: "下書き",
  ready: "確認済み",
  published: "公開済み",
};

export const lineReservationUrl = salonProfile.ctaUrl;
export const lineCtaText =
  "本気で髪を綺麗にしたい方は、まずはLINEからご相談ください。";
export const lineCtaButtonText = salonProfile.ctaText;

const allowedHtmlTags = new Set([
  "A",
  "BLOCKQUOTE",
  "BR",
  "H2",
  "H3",
  "H4",
  "LI",
  "OL",
  "P",
  "STRONG",
  "UL",
]);
const blockedHtmlTags = new Set([
  "EMBED",
  "FORM",
  "IFRAME",
  "INPUT",
  "LINK",
  "META",
  "OBJECT",
  "SCRIPT",
  "STYLE",
]);

export function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function getEmptySeoBlogFields(): SeoBlogFields {
  return {
    aiModel: "",
    articleSummary: "",
    beforeAfterCaptions: [],
    bodyHtml: "",
    ctaText: lineCtaButtonText,
    ctaUrl: lineReservationUrl,
    faq: [],
    generatedBy: "manual",
    headings: [],
    internalLinkSuggestions: [],
    metaTitle: "",
    readerProblems: [],
    searchIntent: "",
    secondaryKeywords: [],
    sourceSeoKeywordId: "",
    sourceSearchConsoleImportId: "",
    targetAudience: "",
    wordpressHtml: "",
  };
}

export function withBlogSeoDefaults<T extends BlogPostInput | BlogPost>(input: T) {
  return {
    ...getEmptySeoBlogFields(),
    ...input,
    beforeAfterCaptions: input.beforeAfterCaptions ?? [],
    faq: input.faq ?? [],
    headings: input.headings ?? [],
    internalLinkSuggestions: input.internalLinkSuggestions ?? [],
    readerProblems: input.readerProblems ?? [],
    secondaryKeywords: input.secondaryKeywords ?? [],
  } as T & SeoBlogFields;
}

export function createLocalBlogPost(input: BlogPostInput): BlogPost {
  const now = new Date().toISOString();

  return withBlogSeoDefaults({
    ...input,
    createdAt: now,
    id: `blog-${Date.now()}`,
    updatedAt: now,
  });
}

export function normalizeBlogCategory(value: string): BlogCategory {
  return blogCategories.includes(value as BlogCategory)
    ? (value as BlogCategory)
    : "髪質改善";
}

export function normalizeBlogStatus(value: string): BlogStatus {
  return blogStatuses.includes(value as BlogStatus)
    ? (value as BlogStatus)
    : "draft";
}

export function normalizeBlogGeneratedBy(value: string): BlogGeneratedBy {
  return value === "gemini" || value === "mock" ? value : "manual";
}

export function splitBlogTags(value: string) {
  return textToStringList(value).slice(0, 12);
}

export function textToStringList(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[,\n、]/)
        .map((item) => item.replace(/^[-#・]\s*/, "").trim())
        .filter(Boolean),
    ),
  );
}

export function stringListToText(values: string[] | undefined) {
  return (values ?? []).join("\n");
}

export function tagsToText(tags: string[]) {
  return tags.join("、");
}

export function headingsToText(headings: BlogHeading[] | undefined) {
  return (headings ?? [])
    .flatMap((heading) => [
      `## ${heading.text}`,
      ...heading.children.map((child) => `### ${child.text}`),
    ])
    .join("\n");
}

export function textToHeadings(value: string): BlogHeading[] {
  const headings: BlogHeading[] = [];

  value.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();

    if (trimmed.startsWith("## ")) {
      headings.push({
        children: [],
        level: "h2",
        text: trimmed.replace(/^##\s+/, "").slice(0, 140),
      });
    } else if (trimmed.startsWith("### ") && headings.length > 0) {
      headings[headings.length - 1].children.push({
        level: "h3",
        text: trimmed.replace(/^###\s+/, "").slice(0, 140),
      });
    }
  });

  return headings.slice(0, 12);
}

export function faqToText(faq: BlogFaq[] | undefined) {
  return (faq ?? [])
    .map((item) => `Q: ${item.question}\nA: ${item.answer}`)
    .join("\n\n");
}

export function textToFaq(value: string): BlogFaq[] {
  return value
    .split(/\n{2,}/)
    .map((block) => {
      const question = block.match(/^Q[:：]\s*(.+)$/m)?.[1]?.trim() ?? "";
      const answer = block.match(/^A[:：]\s*([\s\S]+)$/m)?.[1]?.trim() ?? "";
      return { answer, question };
    })
    .filter((item) => item.question && item.answer)
    .slice(0, 8);
}

export function createSlug(value: string) {
  const normalizedValue = value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[`'"“”‘’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9ぁ-んァ-ヶ一-龠ー]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return normalizedValue || `hair-blog-${getTodayIsoDate()}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paragraphToHtml(paragraph: string) {
  const lines = paragraph
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return "";
  }

  if (lines.every((line) => /^[-・]\s*/.test(line))) {
    return `<ul>${lines
      .map((line) => `<li>${escapeHtml(line.replace(/^[-・]\s*/, ""))}</li>`)
      .join("")}</ul>`;
  }

  return `<p>${lines.map(escapeHtml).join("<br>")}</p>`;
}

export function blogContentToWordPressHtml(content: string) {
  const blocks = content
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks
    .map((block) => {
      if (block.startsWith("#### ")) {
        return `<h4>${escapeHtml(block.replace(/^####\s+/, ""))}</h4>`;
      }

      if (block.startsWith("### ")) {
        return `<h3>${escapeHtml(block.replace(/^###\s+/, ""))}</h3>`;
      }

      if (block.startsWith("## ")) {
        return `<h2>${escapeHtml(block.replace(/^##\s+/, ""))}</h2>`;
      }

      return paragraphToHtml(block);
    })
    .filter(Boolean)
    .join("\n\n");
}

function sanitizeHtmlFallback(value: string) {
  return value
    .replace(/<(script|iframe|object|embed|style|form)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<(script|iframe|object|embed|style|form|input|meta|link)[^>]*\/?\s*>/gi, "")
    .replace(/\s(on\w+|style)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
}

export function sanitizeWordPressHtml(value: string) {
  if (typeof document === "undefined") {
    return sanitizeHtmlFallback(value);
  }

  const template = document.createElement("template");
  template.innerHTML = value;

  Array.from(template.content.querySelectorAll("*")).forEach((element) => {
    if (blockedHtmlTags.has(element.tagName)) {
      element.remove();
      return;
    }

    if (!allowedHtmlTags.has(element.tagName)) {
      element.replaceWith(...Array.from(element.childNodes));
      return;
    }

    Array.from(element.attributes).forEach((attribute) => {
      if (
        element.tagName !== "A" ||
        !["href", "rel", "target"].includes(attribute.name)
      ) {
        element.removeAttribute(attribute.name);
      }
    });

    if (element.tagName === "A") {
      const href = element.getAttribute("href") ?? "";
      const isSafeHref =
        href.startsWith("/") ||
        href.startsWith("https://ef-mayke-s.com/") ||
        href === lineReservationUrl;

      if (!isSafeHref) {
        element.removeAttribute("href");
      }

      if (element.getAttribute("target") === "_blank") {
        element.setAttribute("rel", "noopener noreferrer");
      } else {
        element.removeAttribute("target");
        element.removeAttribute("rel");
      }
    }
  });

  return template.innerHTML.trim();
}

export function createWordPressPreviewHtml(
  content: string,
  storedWordPressHtml?: string,
) {
  const html = storedWordPressHtml?.trim()
    ? storedWordPressHtml
    : [
        blogContentToWordPressHtml(content),
        `<p><a href="${lineReservationUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(
          lineCtaButtonText,
        )}</a></p>`,
      ].join("\n\n");

  return sanitizeWordPressHtml(html);
}

function getCategoryFromKeyword(keyword: string): BlogCategory {
  if (keyword.includes("縮毛") || keyword.includes("ストレート")) {
    return "縮毛矯正";
  }

  if (keyword.includes("白髪")) {
    return "白髪ぼかし";
  }

  if (keyword.includes("松江")) {
    return "松江市美容室";
  }

  if (keyword.includes("ショート")) {
    return "ショート";
  }

  if (keyword.includes("ボブ")) {
    return "ボブ";
  }

  if (keyword.includes("カラー")) {
    return "ヘアカラー";
  }

  if (keyword.includes("ホームケア") || keyword.includes("店販")) {
    return "ホームケア";
  }

  return "髪質改善";
}

export function createMockBlogArticle(
  request: BlogGenerateRequest,
): BlogGenerateResponse {
  const keyword = request.mainKeyword.trim() || "松江 髪質改善";
  const category = getCategoryFromKeyword(keyword);
  const title =
    request.preferredTitle?.trim() ||
    `松江市で髪質改善を考えている大人女性へ。髪をきれいに見せるために大切なこと`;
  const metaTitle = `${title} | ef.mayke\`s`.slice(0, 60);
  const slug = createSlug(`matsue-${keyword}-hair-care`);
  const secondaryKeywords = request.secondaryKeywords?.length
    ? request.secondaryKeywords.slice(0, 8)
    : ["松江 縮毛矯正", "40代 髪質改善", "松江 美容室"];
  const readerProblems = request.readerProblems?.length
    ? request.readerProblems.slice(0, 8)
    : ["髪のうねり", "広がり", "パサつき", "年齢による艶不足"];
  const headings: BlogHeading[] = [
    {
      children: [{ level: "h3", text: "うねり・広がり・パサつきが重なる理由" }],
      level: "h2",
      text: "大人女性によくある髪の悩みと原因",
    },
    {
      children: [{ level: "h3", text: "髪質改善と縮毛矯正の考え方" }],
      level: "h2",
      text: "自宅ケアだけでは難しい時に美容室でできること",
    },
    {
      children: [{ level: "h3", text: "施術履歴まで確認する理由" }],
      level: "h2",
      text: "ef.mayke`sのカウンセリングと施術方針",
    },
    {
      children: [],
      level: "h2",
      text: "施術後のホームケアとよくある質問",
    },
  ];
  const faq: BlogFaq[] = [
    {
      answer:
        "目的が異なります。髪の状態やくせの強さ、過去の施術履歴を確認したうえで、必要な方法をご提案します。",
      question: "髪質改善と縮毛矯正はどう違いますか？",
    },
    {
      answer:
        "髪の状態によって異なります。カラーや縮毛矯正の履歴も含め、まずはLINEまたはカウンセリングでご相談ください。",
      question: "ダメージがあっても相談できますか？",
    },
  ];
  const bodyHtml = [
    `<p>松江市で${escapeHtml(keyword)}を検討している方の中には、髪のうねりや広がり、パサつきが重なり、毎朝のスタイリングに時間がかかると感じている方も多いと思います。</p>`,
    "<h2>大人女性によくある髪の悩み</h2>",
    "<p>年齢による髪質の変化、カラーや縮毛矯正の履歴、乾かし方など、悩みの原因は一つとは限りません。まずは今の状態を整理することが大切です。</p>",
    "<h3>うねり・広がり・パサつきが重なる理由</h3>",
    "<p>髪内部の水分バランスやダメージ、根元と毛先の状態の違いによって、同じケアでも仕上がりに差が出ます。</p>",
    "<h2>自宅ケアだけでは改善が難しい時</h2>",
    "<p>ホームケアは大切ですが、強いくせや施術履歴による扱いにくさは、髪の状態を見ながら美容室で方法を選ぶ必要があります。</p>",
    "<h2>美容室でできる解決方法</h2>",
    "<p>髪質改善、縮毛矯正、ストレート施術は、それぞれ目的が異なります。効果を断定せず、髪の状態と希望に合わせて無理のない施術を考えます。</p>",
    "<h2>ef.mayke`sでのカウンセリングと施術方針</h2>",
    `<p>${escapeHtml(salonProfile.summary)}施術前に髪質、履歴、普段のお手入れを確認します。</p>`,
    "<blockquote>Before／After画像をここに挿入</blockquote>",
    "<p>画像は同じ照明や角度を意識し、実際の施術結果だけを掲載してください。仕上がりには個人差があります。</p>",
    "<h2>施術後の注意点とホームケア</h2>",
    "<ul><li>強くこすらずに乾かす</li><li>根元から順に乾かす</li><li>髪の状態に合う保湿を続ける</li></ul>",
    "<h2>よくある質問</h2>",
    ...faq.flatMap((item) => [
      `<h3>${escapeHtml(item.question)}</h3>`,
      `<p>${escapeHtml(item.answer)}</p>`,
    ]),
  ].join("\n");
  const content = [
    `松江市で${keyword}を検討している大人女性へ向け、髪の悩みと美容室でできることを整理します。`,
    ...headings.flatMap((heading) => [
      `## ${heading.text}`,
      ...heading.children.map((child) => `### ${child.text}`),
    ]),
    `Before／After画像をここに挿入\n\n${lineCtaText}`,
  ].join("\n\n");
  const wordpressHtml = createWordPressPreviewHtml(content, [
    bodyHtml,
    `<p><a href="${lineReservationUrl}" target="_blank" rel="noopener noreferrer">${lineCtaButtonText}</a></p>`,
  ].join("\n\n"));

  return {
    aiModel: "mock",
    articleSummary:
      request.articleSummary ??
      "大人女性の髪の悩みを整理し、髪質改善や縮毛矯正を選ぶ際の考え方をやさしく解説します。",
    beforeAfterCaption: `${keyword}の施術前後を同じ角度で比較します。仕上がりには個人差があります。`,
    beforeAfterCaptions: [
      "施術前：うねりや広がりが気になる状態",
      "施術後：乾かした状態のまとまりと艶感。仕上がりには個人差があります。",
    ],
    blogValue:
      "来店前に髪質改善と縮毛矯正の違いを知りたいお客様の疑問に答えられるため、ブログ化する価値があります。",
    bodyHtml,
    category,
    content,
    ctaText: lineCtaButtonText,
    ctaUrl: lineReservationUrl,
    excerpt: `${keyword}を考えている大人女性向けに、髪質改善・縮毛矯正の考え方をやさしく整理しました。`,
    faq,
    generatedBy: "mock",
    generationMode: "mock",
    headings,
    instagramCaption: `${keyword}で悩んでいる方へ。髪の状態に合わせて、必要な方法を一緒に整理しましょう。`,
    internalLinkSuggestions: [
      "https://ef-mayke-s.com/blog_toppage/",
      request.sourceTargetPage || "https://ef-mayke-s.com/",
    ],
    lineCta: lineCtaButtonText,
    metaDescription: `松江市で${keyword}を検討している大人女性へ。髪質改善や縮毛矯正の違い、カウンセリング、ホームケアを美容室目線で解説します。`.slice(
      0,
      160,
    ),
    metaTitle,
    providerLabel: "モック生成",
    readerProblems,
    relatedSnsPostIds: [],
    relatedTrendIds: request.sourceTrendId ? [request.sourceTrendId] : [],
    relatedYoutubeUrls: [],
    salonRelevance:
      "髪質改善、縮毛矯正、大人女性の悩みと直接関係し、ef.mayke`sの専門性を自然に伝えられます。",
    searchIntent:
      request.searchIntent ||
      "松江市で髪質改善や縮毛矯正を相談できる美容室と、施術前に知っておくべきことを探している。",
    secondaryKeywords,
    slug,
    sourceSeoKeywordId: request.sourceSeoKeywordId ?? "",
    sourceSearchConsoleImportId:
      request.sourceSearchConsoleImportId ?? "",
    status: "draft",
    tags: Array.from(
      new Set([keyword, ...secondaryKeywords, "髪質改善", "松江市美容室"]),
    ).slice(0, 12),
    targetAudience:
      request.targetAudience ||
      `${request.targetAge}の、うねり・広がり・パサつきに悩む大人女性`,
    targetKeyword: keyword,
    title,
    trendSummary:
      request.referenceMemos?.[0] ||
      "髪質改善と縮毛矯正を検討する大人女性に役立つテーマです。",
    wordpressHtml,
  };
}
