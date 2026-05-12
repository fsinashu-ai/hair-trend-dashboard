import { dummySettings } from "@/data/dummySettings";

export function getSalonPromptContext() {
  return [
    `サロン名: ${dummySettings.salonName}`,
    `得意技術: ${dummySettings.specialty}`,
    `基本トーン: ${dummySettings.defaultTone}`,
    `想定客層: ${dummySettings.targetCustomer}`,
    `投稿・接客の目的: ${dummySettings.postingGoal}`,
    "優先して扱う悩み: くせ毛、うねり、広がり、パサつき、艶不足、白髪、縮毛矯正やカラーによるダメージ",
    "提案の方針: まず悩みに共感し、髪質や履歴を確認し、無理のない施術・ホームケア・次回来店につなげる",
    "避ける表現: 断定しすぎる表現、不安をあおる表現、過度な効果保証、安売り感の強い表現",
  ].join("\n");
}
