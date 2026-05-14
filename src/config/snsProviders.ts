import type { SnsType } from "@/types/snsPost";

export type SnsProviderConfig = {
  type: SnsType;
  label: string;
  manualUrlEnabled: boolean;
  officialApiReady: boolean;
  note: string;
};

export const snsProviderConfigs: SnsProviderConfig[] = [
  {
    type: "Instagram",
    label: "Instagram",
    manualUrlEnabled: true,
    officialApiReady: false,
    note: "まずは手動URL登録のみ。将来は公式API連携を追加できる想定です。",
  },
  {
    type: "YouTube",
    label: "YouTube",
    manualUrlEnabled: true,
    officialApiReady: false,
    note: "将来はYouTube Data APIで公式に取得する設計です。",
  },
  {
    type: "Pinterest",
    label: "Pinterest",
    manualUrlEnabled: true,
    officialApiReady: false,
    note: "まずは手動URL登録のみ。将来は公式API連携を追加できる想定です。",
  },
  {
    type: "TikTok",
    label: "TikTok",
    manualUrlEnabled: true,
    officialApiReady: false,
    note: "非公式スクレイピングは禁止。手動URL登録のみで扱います。",
  },
  {
    type: "X",
    label: "X",
    manualUrlEnabled: true,
    officialApiReady: false,
    note: "非公式スクレイピングは禁止。手動URL登録のみで扱います。",
  },
  {
    type: "Other",
    label: "Other",
    manualUrlEnabled: true,
    officialApiReady: false,
    note: "公開許可されたURLや公式情報だけを登録します。",
  },
];
