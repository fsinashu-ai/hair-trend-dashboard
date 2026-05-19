import type {
  BlogCategory,
  BlogGenerateRequest,
  BlogGenerateResponse,
  BlogLength,
  BlogPost,
  BlogPostInput,
  BlogStatus,
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

export const lineReservationUrl = "https://lin.ee/jjqQEFX";
export const lineCtaText =
  "本気で髪を綺麗にしたい方は、まずはLINEからご相談ください。";

export function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function createLocalBlogPost(input: BlogPostInput): BlogPost {
  const now = new Date().toISOString();

  return {
    ...input,
    createdAt: now,
    id: `blog-${Date.now()}`,
    updatedAt: now,
  };
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

export function splitBlogTags(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[,\n、]/)
        .map((tag) => tag.replace(/^#/, "").trim())
        .filter(Boolean),
    ),
  ).slice(0, 12);
}

export function tagsToText(tags: string[]) {
  return tags.join("、");
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

export function createWordPressPreviewHtml(content: string) {
  return [
    blogContentToWordPressHtml(content),
    `<p><a href="${lineReservationUrl}" class="wp-block-button__link">${escapeHtml(
      lineCtaText,
    )}</a></p>`,
  ].join("\n\n");
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

function getLengthGuide(length: BlogLength) {
  if (length === "3000文字") {
    return "詳しく";
  }

  if (length === "2000文字") {
    return "丁寧に";
  }

  if (length === "800文字") {
    return "短く読みやすく";
  }

  return "読みやすく";
}

export function createMockBlogArticle(
  request: BlogGenerateRequest,
): BlogGenerateResponse {
  const keyword = request.mainKeyword.trim() || "髪質改善";
  const category = getCategoryFromKeyword(keyword);
  const title = `松江市で${keyword}を考えている大人女性へ。髪をきれいに見せるために大切なこと`;
  const slug = createSlug(`matsue-${keyword}-hair-care`);
  const referenceLine = request.referenceTitles?.length
    ? `\n\n参考にしたトレンド: ${request.referenceTitles.slice(0, 3).join("、")}`
    : "";
  const content = [
    `松江市で${keyword}を検討している方の中には、「今の髪をもっと扱いやすくしたい」「年齢とともに髪のツヤが出にくくなった」と感じている方も多いと思います。ef.mayke\`sでは、髪質改善やストレートの考え方を大切にしながら、無理に変えるのではなく、毎日きれいに見える髪を一緒に目指します。`,
    `## ${request.concern}が気になる時にまず確認したいこと`,
    `${request.concern}が気になる時は、髪質だけでなく、これまでのカラーや縮毛矯正の履歴、毎日の乾かし方、使っているホームケアも関係します。カウンセリングでは、仕上がりの理想だけでなく、朝のセット時間や苦手なスタイリングも確認すると、提案がずれにくくなります。`,
    "### 髪質改善と縮毛矯正は目的で選びます",
    "髪質改善は手触りやまとまり、ツヤ感を整えたい時に向いています。縮毛矯正はくせや広がりをしっかり扱いやすくしたい時に選びやすいメニューです。どちらが良いかは髪の状態によって変わるため、自己判断よりも髪を見ながら相談するのがおすすめです。",
    "## 白髪ぼかしや大人女性ヘアとの相性",
    "大人女性の髪は、白髪、乾燥、うねり、パサつきが重なって見えることがあります。白髪ぼかしをする場合も、ベースの髪が整っているとツヤが出やすく、カラーの見え方もやわらかくなります。髪質改善やストレートの土台づくりは、白髪ぼかしとも相性の良い考え方です。",
    `## ${getLengthGuide(request.length)}伝えたいホームケアのポイント`,
    "サロンで整えた髪を長く楽しむには、家での乾かし方とシャンプー後のケアが大切です。強くこすらず、根元からしっかり乾かし、毛先には必要な保湿を足すだけでも見え方は変わります。無理なく続けられる方法を選ぶことが、きれいな髪を保つ近道です。",
    "## まとめ",
    `${keyword}は、今の髪の悩みと理想の仕上がりを整理してから選ぶと失敗しにくくなります。売り込みではなく、髪の状態を見ながら必要なことを一緒に決めていくことを大切にしています。${lineCtaText}${referenceLine}`,
  ].join("\n\n");

  return {
    category,
    content,
    excerpt: `${keyword}を考えている大人女性向けに、髪質改善・縮毛矯正・白髪ぼかしとの考え方をやさしく整理しました。`,
    instagramCaption: `${keyword}で悩んでいる方へ。\n髪の状態によって、髪質改善が合う場合も、縮毛矯正が合う場合もあります。\nまずは今の髪の悩みを一緒に整理しましょう。\n#髪質改善 #縮毛矯正 #松江市美容室`,
    beforeAfterCaption: `${keyword}でまとまりやツヤ感を整えたい大人女性向けのBefore/After紹介に使えます。`,
    lineCta: lineCtaText,
    metaDescription: `松江市で${keyword}を検討している大人女性へ。髪質改善・縮毛矯正・白髪ぼかしとの違いや相談前に知っておきたいポイントを美容室目線で解説します。`,
    providerLabel: "モック記事",
    relatedSnsPostIds: [],
    relatedTrendIds: [],
    relatedYoutubeUrls: [],
    slug,
    status: "draft",
    tags: Array.from(
      new Set([keyword, "髪質改善", "縮毛矯正", "白髪ぼかし", "松江市美容室"]),
    ),
    targetKeyword: keyword,
    title,
  };
}
