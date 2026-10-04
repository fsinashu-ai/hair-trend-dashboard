import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/lib/ga4/metrics.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exports = {};
vm.runInNewContext(compiled, { exports, require: () => ({}) });
const record = (id, periodStart, periodEnd) => ({ id, periodStart, periodEnd, createdAt: "2026-10-04" });

test("30日と31日の完了月を比較し、部分月と重複期間を除外する", () => {
  const current = record("sep", "2026-09-01", "2026-09-30");
  const august = record("aug", "2026-08-01", "2026-08-31");
  const partial = record("partial", "2026-08-02", "2026-08-31");
  const overlapping = record("mixed", "2026-09-01", "2026-10-02");
  assert.equal(exports.findComparablePreviousImport([current, august, partial, overlapping], current)?.id, "aug");
  assert.equal(exports.findComparablePreviousImport([partial], current), undefined);
});

test("部分期間は同じ日数だけ比較し、不正期間は比較しない", () => {
  const current = record("current", "2026-09-01", "2026-09-07");
  assert.equal(exports.findComparablePreviousImport([record("previous", "2026-08-25", "2026-08-31")], current)?.id, "previous");
  assert.equal(exports.findComparablePreviousImport([], record("bad", "invalid", "invalid")), undefined);
});

test("相談クリック集計はキーイベント179件を39クリックへ混ぜない", () => {
  const conversionSource = readFileSync(new URL("../src/lib/conversions/metrics.ts", import.meta.url), "utf8");
  const conversionCompiled = ts.transpileModule(conversionSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const conversionExports = {};
  vm.runInNewContext(conversionCompiled, { exports: conversionExports, require: () => ({ isAutomaticMeasurementEvent: () => false }) });
  const result = conversionExports.summarizeConversionRows([{ conversions: 179, lineClicks: 3, lpLineTaps: 17, phoneTaps: 19, reservationClicks: 0, sessions: 47, users: 10, views: 94, eventName: "" }]);
  assert.equal(result.totalActions, 39);
  assert.equal(result.keyEvents, 179);
  assert.equal(result.genericKeyEvents, 140);
  assert.equal(result.conversionRate, 39 / 47);
});
