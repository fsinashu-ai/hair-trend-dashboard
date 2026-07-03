export const salonProfile = {
  basicMessage: "本気で綺麗になりたいあなたへ",
  businessStyle: "1日3組限定の完全予約制サロン。",
  ctaText: "LINEで相談・予約する",
  ctaUrl: "https://lin.ee/jjqQEFX",
  name: "ef.mayke`s",
  specialties: [
    "髪質改善",
    "縮毛矯正",
    "ストレート施術",
    "丁寧なカウンセリング",
    "大人女性の髪の悩み",
    "うねり、広がり、パサつきへの対応",
  ],
  summary:
    "ストレートと髪質改善に特化し、本気で髪を綺麗にしたいお客様に、特別なカウンセリングと丁寧な施術を提供する美容室。",
  targetCustomers: [
    "髪のうねりや広がりに悩んでいる人",
    "縮毛矯正を検討している人",
    "髪質改善をしたい人",
    "年齢による髪質の変化に悩んでいる人",
    "40代以降の大人女性",
    "本気で髪を綺麗にしたい人",
  ],
} as const;

export function getSalonPromptContext() {
  return [
    `店舗名: ${salonProfile.name}`,
    `店舗の特徴: ${salonProfile.summary}`,
    `営業方針: ${salonProfile.businessStyle}`,
    `主な対象客: ${salonProfile.targetCustomers.join("、")}`,
    `得意分野: ${salonProfile.specialties.join("、")}`,
    `基本メッセージ: ${salonProfile.basicMessage}`,
    `CTA文言: ${salonProfile.ctaText}`,
    `LINEリンク: ${salonProfile.ctaUrl}`,
    "提案方針: 悩みに共感し、髪質・施術履歴・生活習慣を確認して、無理のない施術とホームケアを提案する。",
    "禁止表現: 効果保証、不安をあおる表現、医療行為のような表現、実在しない口コミや施術事例、提供していないメニュー。",
  ].join("\n");
}
