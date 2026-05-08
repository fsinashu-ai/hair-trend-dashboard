import { BackupManager } from "@/components/backup/BackupManager";
import { PageHeader } from "@/components/sections/PageHeader";

export default function BackupPage() {
  return (
    <main className="py-6">
      <PageHeader
        eyebrow="Backup"
        title="データバックアップ"
        description="トレンド、キーワード、AI生成結果、最近見たトレンドをJSON/CSVで書き出し、JSONから復元できます。個人利用でも迷わないよう、復元用と確認用を分けています。"
      />

      <BackupManager />
    </main>
  );
}
