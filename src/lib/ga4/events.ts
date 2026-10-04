export const topLineEventName = "line_click";
export const lpLineEventName = "LINE_click_ad";
export const lpLinePagePath = "/lp/";

const automaticMeasurementEventNames = new Set([
  "click",
  "first_visit",
  "page_view",
  "scroll",
  "session_start",
  "user_engagement",
]);
const phoneEventNames = new Set(["TEL", "tel_click"]);

type EventClassificationInput = {
  eventCount: number;
  eventName: string;
  linkUrl: string;
};

function normalizeCount(value: number) {
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

function includesAny(value: string, keywords: string[]) {
  const normalized = value.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword));
}

export function isTelephoneLink(linkUrl: string) {
  return linkUrl.trim().toLowerCase().startsWith("tel:");
}

export function isAutomaticMeasurementEvent(eventName: string) {
  return automaticMeasurementEventNames.has(eventName);
}

export function classifyGa4Event({
  eventCount,
  eventName,
  linkUrl,
}: EventClassificationInput) {
  const count = normalizeCount(eventCount);

  return {
    lineClicks: eventName === topLineEventName ? count : 0,
    lpLineTaps: eventName === lpLineEventName ? count : 0,
    phoneTaps:
      phoneEventNames.has(eventName) || isTelephoneLink(linkUrl) ? count : 0,
    reservationClicks: includesAny(eventName, [
      "reserve",
      "reservation",
      "booking",
      "yoyaku",
      "予約",
    ])
      ? count
      : 0,
  };
}

export function countGa4RowActions({
  conversions,
  eventName = "",
  lineClicks,
  lpLineTaps,
  phoneTaps,
  reservationClicks,
}: {
  conversions: number;
  eventName?: string;
  lineClicks: number;
  lpLineTaps: number;
  phoneTaps: number;
  reservationClicks: number;
}) {
  const classifiedActions =
    lineClicks + lpLineTaps + phoneTaps + reservationClicks;

  // 汎用キーイベントは相談クリックや予約確定とは別の指標です。
  void conversions;
  void eventName;
  return classifiedActions;
}
