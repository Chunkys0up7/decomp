// @vitest-environment node
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { diffDecisions, evaluate, loadLibrary, loadPipeline, readReceipts, receiptsFile, recheck, summarize } from "./index.mjs";

const LIB = "runtime/fixtures/library";
const read = (f) => JSON.parse(readFileSync(f, "utf8"));
const strip = (r) => ({ ...r, receipt: undefined, loans: r.loans.map(({ receipt, ...x }) => x) });

let dir, lib, store;
const library = () => loadLibrary(lib);
const pipeline = (statuses = {}) => {
  const p = loadPipeline("runtime/fixtures/pipeline.json");
  for (const l of p.loans) if (statuses[l.loan.loan_id]) l.status = statuses[l.loan.loan_id];
  return p;
};
const row = (r, id) => r.loans.find((x) => x.loan_id === id);
const add32 = () => copyFileSync(`${LIB}/pol-hl-0142-3.2.bundle.json`, join(lib, "pol-hl-0142-3.2.bundle.json"));

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "pc-pipeline-"));
  lib = join(dir, "lib"); store = join(dir, "store");
  mkdirSync(lib);
  copyFileSync(`${LIB}/pol-hl-0142-3.1.bundle.json`, join(lib, "pol-hl-0142-3.1.bundle.json"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("pipeline manifest", () => {
  it("loads loans relative to the manifest with their status and the lender settings", () => {
    const p = loadPipeline("runtime/fixtures/pipeline.json");
    expect(p.loans.map((l) => [l.loan.loan_id, l.status])).toEqual([["L-2001", "in_process"], ["L-2002", "in_process"], ["L-2003", "in_process"], ["L-2004", "in_process"], ["L-2005", "sold"]]);
    expect(p.lender).toEqual({ as_of_rule: "note_date", adopt: [] });
  });
});

describe("re-check runs", () => {
  it("first run records every in-process loan; a repeat skips them all with an empty queue", () => {
    const presale = { "L-2005": "in_process" };
    const a = recheck(library(), pipeline(presale), { store });
    expect(a.totals).toMatchObject({ loans: 5, first: 5, rendered: 0, skipped: 0, queued: 0 });
    const b = recheck(library(), pipeline(presale), { store });
    expect(b.totals).toMatchObject({ first: 0, rendered: 0, skipped: 5, queued: 0 });
    const runs = readReceipts(join(store, "pipeline", "receipts.jsonl"));
    expect(runs).toHaveLength(2);
    expect(runs[1].prev).toBe(runs[0].id);
    expect(runs[1].contract_fingerprint).toBe(runs[0].contract_fingerprint);
  });

  it("when 3.2 arrives, only loans whose note date selects it re-render; cards that did not move are unchanged", () => {
    recheck(library(), pipeline({ "L-2005": "in_process" }), { store });
    add32();
    const r = recheck(library(), pipeline({ "L-2005": "in_process" }), { store });
    expect(row(r, "L-2001").mode).toBe("skipped"); // note date 2026-03-01: still 3.1
    const l2 = row(r, "L-2002"); // note date 2026-08-15: now 3.2
    expect(l2).toMatchObject({ mode: "rendered", version: { before: "3.1", after: "3.2" }, outcome: { before: "condition", after: "condition" }, queue_reason: null });
    expect(l2.diff.steps.map((s) => [s.slot, s.class])).toEqual([["dti-max", "card_changed"], ["dti-above-max", "card_changed"]]);
    expect(l2.diff.unchanged).toEqual(["scope", "variable-income-calc", "dti-ratio"]);
  });

  it("adopting 3.2 early re-renders and queues the loan whose outcome flips, with the reason", () => {
    recheck(library(), pipeline({ "L-2005": "in_process" }), { store });
    add32();
    const r = recheck(library(), pipeline(), { store, adopt: ["POL-HL-0142@3.2"] });
    expect(r.lender.adopt).toEqual(["POL-HL-0142@3.2"]);
    const l1 = row(r, "L-2001");
    expect(l1).toMatchObject({ mode: "rendered", outcome: { before: "pass", after: "fail" }, queue_reason: "outcome_changed" });
    const dtiMax = l1.diff.steps.find((s) => s.slot === "dti-max");
    expect(dtiMax).toMatchObject({ class: "result_changed", card_changed: true, result: { before: "within_limit", after: "exceeds_limit" } });
    expect(r.queue.map((q) => [q.loan_id, q.reason])).toEqual([["L-2005", "would_change"], ["L-2001", "outcome_changed"]].sort((a, b) => (a[1] === "outcome_changed" ? -1 : 1)));
  });

  it("evaluates a sold loan for impact only and never touches its receipts", () => {
    recheck(library(), pipeline({ "L-2005": "in_process" }), { store });
    const before = readReceipts(receiptsFile(store, "L-2005"));
    add32();
    const r = recheck(library(), pipeline(), { store, adopt: ["POL-HL-0142@3.2"] });
    expect(row(r, "L-2005")).toMatchObject({ status: "sold", mode: "impact", outcome: { before: "pass", after: "fail" }, queue_reason: "would_change" });
    expect(row(r, "L-2005").receipt).toBeUndefined();
    expect(readReceipts(receiptsFile(store, "L-2005"))).toEqual(before);
  });

  it("queues a loan that a new version leaves incomplete ahead of the others", () => {
    recheck(library(), pipeline({ "L-2005": "in_process" }), { store });
    const p = pipeline();
    delete p.loans[0].loan.facts.borrower.qualifying_income; // L-2001 loses its income
    const r = recheck(library(), p, { store });
    expect(row(r, "L-2001")).toMatchObject({ mode: "rendered", queue_reason: "newly_incomplete" });
    expect(r.queue[0]).toMatchObject({ loan_id: "L-2001", reason: "newly_incomplete" });
    expect(row(r, "L-2001").diff.outstanding_added).toEqual([{ slot: "dti-ratio", status: "needs_input", missing: "borrower.qualifying_income" }]);
  });

  it("is deterministic apart from receipt ids", () => {
    const a = recheck(library(), pipeline(), {});
    const b = recheck(library(), pipeline(), {});
    expect(strip(a)).toEqual(strip(b));
    expect(a.report_hash).toBe(b.report_hash);
  });

  it("summarises the run and the queue in plain text", () => {
    recheck(library(), pipeline({ "L-2005": "in_process" }), { store });
    add32();
    const text = summarize(recheck(library(), pipeline(), { store, adopt: ["POL-HL-0142@3.2"] }));
    expect(text).toMatch(/Review queue:/);
    expect(text).toMatch(/L-2001 \(POL-HL-0142\) outcome_changed: pass -> fail, version 3.1 -> 3.2/);
    expect(text).toMatch(/dti-max: result_changed \(card changed, inputs changed\) "within_limit" -> "exceeds_limit"/);
    expect(text).toMatch(/dti-above-max: result_changed \(card changed\) not_applicable -> refer_to_person/);
  });
});

describe("decision diff", () => {
  const b31 = () => loadLibrary(LIB).find((b) => b.policy.version === "3.1");
  const loan = () => read("runtime/fixtures/loans/L-2001.json");
  it("classifies an identical re-evaluation as all unchanged", () => {
    const d = diffDecisions(evaluate(b31(), loan()), evaluate(b31(), loan()));
    expect(d.counts.unchanged).toBe(d.steps.length);
  });
  it("separates an input change from a result change", () => {
    const l = loan(); l.facts.borrower.monthly_obligations = 2650; // ratio moves, still within limit
    const d = diffDecisions(evaluate(b31(), loan()), evaluate(b31(), l));
    const cls = Object.fromEntries(d.steps.map((s) => [s.slot, s.class]));
    expect(cls).toMatchObject({ scope: "unchanged", "dti-ratio": "result_changed", "dti-max": "inputs_changed" });
  });
  it("reports added steps and new assumptions", () => {
    const prev = evaluate(b31(), loan());
    const next = structuredClone(prev);
    next.steps.push({ ...prev.steps[0], slot: "extra", assumptions: ["ISS-9"] });
    const d = diffDecisions(prev, next);
    expect(d.steps.find((s) => s.slot === "extra").class).toBe("added");
    expect(d.assumptions_added).toEqual(["ISS-9"]);
  });
});
