import { NextResponse } from "next/server";
import { createFinalMarketingDashboardSummary } from "@/lib/dashboard/finalMarketingDashboard.server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const summary = await createFinalMarketingDashboardSummary();
    return NextResponse.json({ summary });
  } catch (error) {
    console.warn("[dashboard-monthly] failed", {
      errorType: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json(
      { error: "集客ダッシュボードを読み込めませんでした。" },
      { status: 500 },
    );
  }
}
