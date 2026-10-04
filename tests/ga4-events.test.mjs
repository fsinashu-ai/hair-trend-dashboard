import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyGa4Event,
  countGa4RowActions,
  lpLineEventName,
  topLineEventName,
} from "../src/lib/ga4/events.ts";

test("TOPとLPのLINEイベントを完全一致で分離する", () => {
  assert.deepEqual(
    classifyGa4Event({ eventCount: 3, eventName: topLineEventName, linkUrl: "" }),
    { lineClicks: 3, lpLineTaps: 0, phoneTaps: 0, reservationClicks: 0 },
  );
  assert.deepEqual(
    classifyGa4Event({ eventCount: 6, eventName: lpLineEventName, linkUrl: "" }),
    { lineClicks: 0, lpLineTaps: 6, phoneTaps: 0, reservationClicks: 0 },
  );
  assert.equal(
    classifyGa4Event({ eventCount: 16, eventName: "line_click_ad", linkUrl: "" })
      .lpLineTaps,
    0,
  );
  assert.equal(
    classifyGa4Event({ eventCount: 25, eventName: "LINEタップ", linkUrl: "" })
      .lpLineTaps,
    0,
  );
});

test("TELまたはtelリンクだけを電話タップにする", () => {
  assert.equal(
    classifyGa4Event({ eventCount: 2, eventName: "TEL", linkUrl: "" }).phoneTaps,
    2,
  );
  assert.equal(
    classifyGa4Event({
      eventCount: 4,
      eventName: "click",
      linkUrl: "tel:0852-00-1994",
    }).phoneTaps,
    4,
  );
});

test("汎用clickのキーイベント数を成果へ加えず、電話だけを残す", () => {
  assert.equal(
    countGa4RowActions({
      conversions: 25,
      eventName: "click",
      lineClicks: 0,
      lpLineTaps: 0,
      phoneTaps: 0,
      reservationClicks: 0,
    }),
    0,
  );
  assert.equal(
    countGa4RowActions({
      conversions: 1,
      eventName: "click",
      lineClicks: 0,
      lpLineTaps: 0,
      phoneTaps: 1,
      reservationClicks: 0,
    }),
    1,
  );
});

test("同じキーイベントとクリックを二重加算しない", () => {
  assert.equal(
    countGa4RowActions({
      conversions: 6,
      eventName: lpLineEventName,
      lineClicks: 0,
      lpLineTaps: 6,
      phoneTaps: 0,
      reservationClicks: 0,
    }),
    6,
  );
});

test("tel_clickを電話として集計し、汎用キーイベントをクリックへ混ぜない", () => {
  assert.equal(classifyGa4Event({ eventCount: 3, eventName: "tel_click", linkUrl: "" }).phoneTaps, 3);
  assert.equal(countGa4RowActions({ conversions: 179, lineClicks: 3, lpLineTaps: 17, phoneTaps: 19, reservationClicks: 0 }), 39);
  assert.equal(countGa4RowActions({ conversions: 10, lineClicks: 0, lpLineTaps: 0, phoneTaps: 0, reservationClicks: 0 }), 0);
});
