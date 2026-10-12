import { describe, expect, it } from "vitest";
import { cloneSample } from "../domain/sample";
import { validateResult } from "../domain/validate";
import { initialState } from "../store/state";
import { applySetup, createMockDecompose } from "./mock-decompose";
import { createMockIngest } from "./mock-ingest";
import type { RunEvent } from "./types";

const setup = () => initialState().setup;
const signal = () => new AbortController().signal;

describe("TEST-14 mock decompose type filtering", () => {
  it("with rules off: no rule cards, no relations to them, uncovered passages carry an issue", () => {
    const s = setup();
    s.types.rule = false;
    const r = applySetup(cloneSample(), s);
    expect(r.cards.some((c) => c.type === "rule")).toBe(false);
    expect(r.cards.flatMap((c) => c.relations).every((rel) => r.cards.some((c) => c.shortId === rel.shortId))).toBe(true);
    const cited = new Set(r.cards.flatMap((c) => c.evidence.map((e) => e.passageId)));
    for (const p of r.passages.filter((x) => !cited.has(x.id))) {
      expect(r.issues.some((i) => i.passageId === p.id && i.cardIds.length === 0), p.id).toBe(true);
    }
    const newlyUncovered = ["p2", "p3", "p9"];
    for (const pid of newlyUncovered) {
      expect(r.issues.find((i) => i.passageId === pid)).toMatchObject({ kind: "no_card", severity: "info" });
    }
    expect(r.issues.some((i) => i.id === "ISS-01")).toBe(false); // attached only to R-008
    expect(validateResult(r)).toEqual([]);
  });
});

describe("TEST-15 mock decompose check filtering", () => {
  it("with ambiguity off: ISS-01 and ISS-04 are absent and cards no longer reference them", () => {
    const s = setup();
    s.checks.ambiguity = false;
    const r = applySetup(cloneSample(), s);
    const issueIds = r.issues.map((i) => i.id);
    expect(issueIds).not.toContain("ISS-01");
    expect(issueIds).not.toContain("ISS-04");
    expect(r.cards.flatMap((c) => c.issueIds)).not.toContain("ISS-04");
    expect(validateResult(r)).toEqual([]);
  });
  it("with references off the uncovered passage still has an issue (VAL-06)", () => {
    const s = setup();
    s.checks.references = false;
    const r = applySetup(cloneSample(), s);
    expect(r.issues.find((i) => i.passageId === "p8")).toMatchObject({ kind: "no_card" });
    expect(validateResult(r)).toEqual([]);
  });
});

describe("mock adapters", () => {
  const meta = cloneSample().policy;
  const req = { meta, setup: setup(), passages: cloneSample().passages, extraDocuments: [] };

  it("decompose emits five stages in order and returns a valid result", async () => {
    const events: RunEvent[] = [];
    const r = await createMockDecompose({ delayMs: 0 }).run(req, (e) => events.push(e), signal());
    expect(events.filter((e) => e.type === "stage_completed").map((e) => e.type === "stage_completed" && e.stage)).toEqual(["parse", "extract", "lineage", "check", "assign_ids"]);
    expect(events.filter((e) => e.type === "card_extracted")).toHaveLength(8);
    expect(validateResult(r)).toEqual([]);
  });

  it("assigns IDs from the confirmed metadata", async () => {
    const r = await createMockDecompose({ delayMs: 0 }).run({ ...req, meta: { ...meta, version: "4.0" } }, () => {}, signal());
    expect(r.cards[0]!.uri).toBe("pc://hl/pol-0142/v4.0/fact/001");
    expect(validateResult(r)).toEqual([]);
  });

  it("fails with a retryable timeout for a FAIL policy ID", async () => {
    await expect(createMockDecompose({ delayMs: 0 }).run({ ...req, meta: { ...meta, policyId: "POL-FAIL-0001" } }, () => {}, signal()))
      .rejects.toEqual({ code: "timeout", message: "Decomposition timed out.", retryable: true });
  });

  it("can be cancelled", async () => {
    const ac = new AbortController();
    const p = createMockDecompose({ delayMs: 50 }).run(req, () => {}, ac.signal);
    ac.abort();
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
  });

  it("ingest returns the sample passages and rejects bad files", async () => {
    const ingest = createMockIngest({ delayMs: 0 });
    const ok = await ingest.ingest(new File(["x"], "policy.pdf"), signal());
    expect(ok).toMatchObject({ fileName: "policy.pdf", pageCount: 14 });
    expect(ok.sections.map((x) => [x.no, x.passageCount])).toEqual([["1", 1], ["2", 3], ["3", 2], ["4", 2], ["5", 1]]);
    await expect(ingest.ingest(new File(["x"], "fail.pdf"), signal())).rejects.toMatchObject({ code: "unreadable", retryable: false });
    await expect(ingest.ingest(new File(["x"], "policy.txt"), signal())).rejects.toMatchObject({ code: "unsupported_type" });
  });
});
