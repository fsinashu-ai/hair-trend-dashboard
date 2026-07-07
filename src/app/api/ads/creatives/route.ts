import { NextResponse } from "next/server";
import {
  createAdCreative,
  deleteAdCreative,
  fetchAdCreatives,
  updateAdCreative,
} from "@/lib/supabase/adCreatives.server";
import { isServerSupabaseConfigured } from "@/lib/supabase/serverClient";
import type { AdCreative, AdCreativeStatus } from "@/types/adCreative";

export const runtime = "nodejs";

const validStatuses = new Set<AdCreativeStatus>([
  "draft",
  "reviewing",
  "approved",
  "used",
  "archived",
]);

function safeString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function isAdCreative(value: unknown): value is AdCreative {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return Boolean(
    safeString(record.platform, 60) &&
      safeString(record.campaignName, 120) &&
      record.generatedContent &&
      typeof record.generatedContent === "object",
  );
}

export async function GET() {
  if (!isServerSupabaseConfigured()) {
    return NextResponse.json({
      creatives: [],
      message: "Supabase未設定のため、この端末内の保存データで動作します。",
      mode: "local",
    });
  }

  try {
    const creatives = (await fetchAdCreatives()) ?? [];
    return NextResponse.json({ creatives, mode: "supabase" });
  } catch (error) {
    console.error("[ad-creative] fetch failed", {
      errorType: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json(
      { error: "広告案を読み込めませんでした。ad_creativesテーブル設定を確認してください。" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const creative = body.creative ?? body;

  if (!isAdCreative(creative)) {
    return NextResponse.json(
      { error: "保存する広告案が見つかりません。" },
      { status: 400 },
    );
  }

  if (!isServerSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase未設定のため、この端末内に保存してください。" },
      { status: 503 },
    );
  }

  try {
    const saved = await createAdCreative(creative);
    return NextResponse.json({ creative: saved });
  } catch (error) {
    console.error("[ad-creative] create failed", {
      errorType: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json(
      { error: "広告案を保存できませんでした。SQL設定を確認してください。" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const id = safeString(body.id, 100);
  const status = safeString(body.status, 20);
  const memo = safeString(body.memo, 1000);
  const hasMemo = Object.prototype.hasOwnProperty.call(body, "memo");

  if (!id) {
    return NextResponse.json({ error: "更新する広告案が見つかりません。" }, { status: 400 });
  }
  if (status && !validStatuses.has(status as AdCreativeStatus)) {
    return NextResponse.json({ error: "ステータスが不正です。" }, { status: 400 });
  }
  if (!isServerSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase未設定のため、この端末内で更新してください。" },
      { status: 503 },
    );
  }

  try {
    const creative = await updateAdCreative({
      id,
      input: {
        ...(hasMemo ? { memo } : {}),
        ...(status ? { status: status as AdCreativeStatus } : {}),
      },
    });
    return NextResponse.json({ creative });
  } catch (error) {
    console.error("[ad-creative] update failed", {
      errorType: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json(
      { error: "広告案を更新できませんでした。" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const id = safeString(body.id, 100);

  if (!id) {
    return NextResponse.json({ error: "削除する広告案が見つかりません。" }, { status: 400 });
  }
  if (!isServerSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase未設定のため、この端末内で削除してください。" },
      { status: 503 },
    );
  }

  try {
    await deleteAdCreative(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[ad-creative] delete failed", {
      errorType: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json(
      { error: "広告案を削除できませんでした。" },
      { status: 500 },
    );
  }
}
