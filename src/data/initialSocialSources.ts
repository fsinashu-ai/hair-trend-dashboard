import type {
  SocialPriority,
  SocialSource,
  SocialSourceCategory,
  SocialSourceMode,
} from "@/types/social";

type InstagramSourceInput = {
  accountName: string;
  handle: string;
  category: SocialSourceCategory;
  isActive?: boolean;
  memo: string;
  priority?: SocialPriority;
  sourceMode?: SocialSourceMode;
};

function createInstagramSource({
  accountName,
  handle,
  category,
  isActive = false,
  memo,
  priority = "medium",
  sourceMode = "manual_url",
}: InstagramSourceInput): SocialSource {
  const normalizedHandle = handle.trim().replace(/^@/, "").toLowerCase();

  return {
    accountName,
    category,
    handle: `@${normalizedHandle}`,
    id: `instagram-${normalizedHandle.replace(/[^a-z0-9]+/g, "-")}`,
    isActive,
    lastError: "",
    memo,
    priority,
    profileUrl: `https://www.instagram.com/${normalizedHandle}/`,
    snsType: "Instagram",
    sourceMode,
  };
}

export const socialSourceCategories: SocialSourceCategory[] = [
  "自社Instagram",
  "髪質改善美容師",
  "縮毛矯正専門美容師",
  "白髪ぼかし美容師",
  "大人女性向け美容師",
  "美容メーカー公式",
  "美容ディーラー公式",
  "海外ヘアトレンド",
  "その他",
];

export const initialInstagramSources: SocialSource[] = [
  createInstagramSource({
    accountName: "ef mayke's",
    category: "自社Instagram",
    handle: "@ef_maykes",
    isActive: true,
    memo:
      "ef.mayke`sの投稿確認と改善に使う最優先アカウント。髪質改善・ストレート・くせ毛・艶髪の自社発信を整理します。",
    priority: "high",
  }),
  createInstagramSource({
    accountName: "中本翔大",
    category: "髪質改善美容師",
    handle: "@nakasyoex",
    isActive: true,
    memo:
      "髪質改善の見せ方や施術説明を、ef.mayke`sの艶髪提案と投稿づくりの参考にします。",
    priority: "high",
  }),
  createInstagramSource({
    accountName: "島野伊央汰",
    category: "髪質改善美容師",
    handle: "@iota_shimano",
    isActive: true,
    memo:
      "髪質改善の仕上がり表現やお客様への伝え方を、ef.mayke`sのカウンセリング改善に活用します。",
    priority: "high",
  }),
  createInstagramSource({
    accountName: "長門政和",
    category: "縮毛矯正専門美容師",
    handle: "@mnagato0724",
    isActive: true,
    memo:
      "縮毛矯正の技術発信や薬剤・ダメージへの考え方を、ef.mayke`sのストレート提案の参考にします。",
    priority: "high",
  }),
  createInstagramSource({
    accountName: "左近研人",
    category: "縮毛矯正専門美容師",
    handle: "@sakon.kento_nex",
    isActive: true,
    memo:
      "くせ毛と縮毛矯正の専門的な発信を、ef.mayke`sの施術説明やブログテーマに活用します。",
    priority: "high",
  }),
  createInstagramSource({
    accountName: "A・One",
    category: "縮毛矯正専門美容師",
    handle: "@hair_clinic_aone",
    isActive: true,
    memo:
      "ヘアクリニック型の髪質改善・ストレート提案を、ef.mayke`sの専門性の見せ方に活用します。",
    priority: "high",
  }),
  createInstagramSource({
    accountName: "Dears",
    category: "髪質改善美容師",
    handle: "@dears.tuyagami",
    isActive: true,
    memo:
      "艶髪と髪質改善のビジュアル・説明構成を、ef.mayke`sの大人女性向け発信の参考にします。",
    priority: "high",
  }),
  createInstagramSource({
    accountName: "松田政也",
    category: "白髪ぼかし美容師",
    handle: "@good_by_graycolor_masayan",
    isActive: true,
    memo:
      "白髪ぼかしのデザインと説明を、ef.mayke`sの大人女性向けカラー提案に活用します。",
    priority: "high",
  }),
  createInstagramSource({
    accountName: "金子圭介",
    category: "白髪ぼかし美容師",
    handle: "@keisuke_redeal_balayage",
    isActive: true,
    memo:
      "白髪ぼかしとバレイヤージュの表現を、ef.mayke`sの上品なカラー提案の参考にします。",
    priority: "high",
  }),
  createInstagramSource({
    accountName: "伊熊奈美",
    category: "大人女性向け美容師",
    handle: "@namiikuma_hairista",
    isActive: true,
    memo:
      "大人女性の髪悩みに寄り添う言葉選びを、ef.mayke`sのカウンセリングや記事づくりに活用します。",
    priority: "high",
  }),
  createInstagramSource({
    accountName: "大野道寛",
    category: "大人女性向け美容師",
    handle: "@michi1011ohno",
    isActive: true,
    memo:
      "大人女性向けヘアの提案や見せ方を、ef.mayke`sのショート・ボブ提案に活用します。",
    priority: "high",
  }),
  createInstagramSource({
    accountName: "横井拓徹",
    category: "大人女性向け美容師",
    handle: "@yokkoi_beautician",
    memo:
      "大人女性向けのスタイル提案を、ef.mayke`sの髪質改善後のデザイン提案の参考にします。",
  }),
  createInstagramSource({
    accountName: "くせ毛マイスター",
    category: "縮毛矯正専門美容師",
    handle: "@kusegemeister",
    isActive: true,
    memo:
      "くせ毛診断と扱い方の説明を、ef.mayke`sのくせ毛カウンセリングとホームケア提案に活用します。",
    priority: "high",
  }),
  createInstagramSource({
    accountName: "ミルボン",
    category: "美容メーカー公式",
    handle: "@milbon.japan",
    isActive: true,
    memo:
      "ヘアケア・店販・美容市場の公式情報を、ef.mayke`sの商品提案と季節記事に活用します。",
    priority: "high",
    sourceMode: "metadata_only",
  }),
  createInstagramSource({
    accountName: "ミルボン美容師向け",
    category: "美容メーカー公式",
    handle: "@milbon.education",
    memo:
      "美容師向け技術・教育情報を、ef.mayke`sの技術整理や朝礼ネタの参考にします。",
    sourceMode: "metadata_only",
  }),
  createInstagramSource({
    accountName: "ミルボンカラー",
    category: "美容メーカー公式",
    handle: "@milboncolor_official",
    memo:
      "公式カラー情報を、ef.mayke`sの艶カラー・白髪対応カラー提案の参考にします。",
    sourceMode: "metadata_only",
  }),
  createInstagramSource({
    accountName: "アリミノ",
    category: "美容メーカー公式",
    handle: "@arimino_official",
    memo:
      "新商品やスタイリング情報を、ef.mayke`sのメニュー・店販提案の候補として確認します。",
    sourceMode: "metadata_only",
  }),
  createInstagramSource({
    accountName: "アリミノプロ",
    category: "美容メーカー公式",
    handle: "@arimino_professional",
    memo:
      "美容師向けの技術・商品情報を、ef.mayke`sのサロンワーク改善に活用します。",
    sourceMode: "metadata_only",
  }),
  createInstagramSource({
    accountName: "ナプラ",
    category: "美容メーカー公式",
    handle: "@napla_official",
    memo:
      "カラー・ヘアケア・スタイリングの公式情報を、ef.mayke`sの提案材料として確認します。",
    sourceMode: "metadata_only",
  }),
  createInstagramSource({
    accountName: "オージュア",
    category: "美容メーカー公式",
    handle: "@aujua.official",
    isActive: true,
    memo:
      "髪悩み別のケア情報を、ef.mayke`sの髪質改善後のホームケア・店販提案に活用します。",
    priority: "high",
    sourceMode: "metadata_only",
  }),
  createInstagramSource({
    accountName: "ガモウ広島",
    category: "美容ディーラー公式",
    handle: "@gamo_hiroshima",
    memo:
      "中国地方のセミナー・商材情報を、松江市のef.mayke`sで導入を検討する材料にします。",
    sourceMode: "metadata_only",
  }),
  createInstagramSource({
    accountName: "ガモニュー",
    category: "美容ディーラー公式",
    handle: "@gamonew_official",
    memo:
      "美容業界の新商品・新着情報を、ef.mayke`sの店販やメニュー企画の参考にします。",
    sourceMode: "metadata_only",
  }),
  createInstagramSource({
    accountName: "ガモウセミナー",
    category: "美容ディーラー公式",
    handle: "@gamo_seminar",
    memo:
      "美容師向けセミナー情報を、ef.mayke`sの技術学習とスタッフ共有の候補にします。",
    sourceMode: "metadata_only",
  }),
  createInstagramSource({
    accountName: "ガモウ関西",
    category: "美容ディーラー公式",
    handle: "@gamokansai",
    memo:
      "関西圏の美容トレンド・イベント情報を、ef.mayke`sの情報収集の補助に使います。",
    sourceMode: "metadata_only",
  }),
  createInstagramSource({
    accountName: "ガモウ関西商材情報",
    category: "美容ディーラー公式",
    handle: "@gamokansai_gselect",
    memo:
      "サロン商材の新着情報を、ef.mayke`sの店販候補や施術商材の比較に活用します。",
    sourceMode: "metadata_only",
  }),
  createInstagramSource({
    accountName: "ミツイ東京",
    category: "美容ディーラー公式",
    handle: "@mitsui_tokyo",
    memo:
      "美容商材・イベントの情報を、ef.mayke`sの新しい提案候補として確認します。",
    sourceMode: "metadata_only",
  }),
  createInstagramSource({
    accountName: "きくや美粧堂福岡",
    category: "美容ディーラー公式",
    handle: "@kikuya_fukuoka",
    memo:
      "九州エリアの美容商材・講習情報を、ef.mayke`sの業界動向確認に使います。",
    sourceMode: "metadata_only",
  }),
  createInstagramSource({
    accountName: "Behind The Chair",
    category: "海外ヘアトレンド",
    handle: "@behindthechair_com",
    isActive: true,
    memo:
      "海外美容師のカラー・カット・質感表現を、ef.mayke`sのトレンド提案や投稿構成に活用します。",
    priority: "high",
    sourceMode: "metadata_only",
  }),
  createInstagramSource({
    accountName: "MODERN SALON",
    category: "海外ヘアトレンド",
    handle: "@modernsalon",
    memo:
      "海外サロンの技術・経営・商品動向を、ef.mayke`sの幅広い情報収集に使います。",
    sourceMode: "metadata_only",
  }),
  createInstagramSource({
    accountName: "Hairbrained",
    category: "海外ヘアトレンド",
    handle: "@hairbrained_official",
    memo:
      "海外美容師コミュニティの技術表現を、ef.mayke`sのクリエイティブな投稿案に活用します。",
    sourceMode: "metadata_only",
  }),
  createInstagramSource({
    accountName: "Allure",
    category: "海外ヘアトレンド",
    handle: "@allure",
    memo:
      "海外の一般向け美容トレンドを、ef.mayke`sの大人女性向け提案へ自然に翻訳する材料にします。",
    sourceMode: "metadata_only",
  }),
];

export const recommendedInstagramSourceCount = initialInstagramSources.filter(
  (source) => source.isActive,
).length;
