import type { GeneratedPost } from "@/types/generatedPost";

export const dummyGeneratedPosts: GeneratedPost[] = [
  {
    id: "post-natural-bob",
    theme: "ナチュラルボブ",
    postType: "Instagram投稿文",
    tone: "やさしく提案",
    content:
      "朝のスタイリングを楽にしたい方へ。首元がきれいに見えるボブは、乾かすだけでもまとまりやすく、忙しい毎日にも取り入れやすいスタイルです。",
    usedKeywords: ["ボブ", "まとまり", "首元"],
    hashtags: ["#ボブ", "#まとまる髪", "#美容室"],
    createdAt: "2026-05-07",
  },
  {
    id: "post-hair-quality",
    theme: "髪質改善",
    postType: "お客様向け説明文",
    tone: "専門用語をかみくだく",
    content:
      "髪質改善は、広がりやうねり、艶不足が気になる方に向いているケアメニューです。髪の状態を整え、毎日の扱いやすさを目指します。",
    usedKeywords: ["髪質改善", "艶", "うねり"],
    hashtags: ["#髪質改善", "#艶髪", "#くせ毛改善"],
    createdAt: "2026-05-06",
  },
  {
    id: "post-mens-perm",
    theme: "メンズパーマ",
    postType: "サロンメニュー提案",
    tone: "来店につながる提案",
    content:
      "清潔感を残すメンズパーマは、朝のセットを短くしたい男性におすすめです。カットとセットで提案すると、再来店にもつなげやすくなります。",
    usedKeywords: ["メンズパーマ", "清潔感", "時短セット"],
    hashtags: ["#メンズパーマ", "#メンズヘア", "#清潔感"],
    createdAt: "2026-05-05",
  },
];
