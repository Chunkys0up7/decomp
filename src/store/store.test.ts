import { describe, expect, it } from "vitest";
import { cloneSample } from "../domain/sample";
import { AT, ids, reviewState, run } from "../test/fixtures";
import { createDraftWriter, DRAFT_KEY, parseDraft, serializeDraft, toDraft } from "./persistence";
import { reducer } from "./reducer";
import * as sel from "./selectors";
import { initialState } from "./state";

const card = (s: ReturnType<typeof reviewState>, id: string) => s.result!.cards.find((c) => c.shortId === id)!;
const passage = (s: ReturnType<typeof reviewState>, id: string) => s.result!.passages.find((p) => p.id === id)!;

describe("TEST-03 initial selectors", () => {
  const s = reviewState();
  it("counts and issue totals", () => {
    expect(sel.counts(s)).toEqual({ total: 8, approved: 0, rejected: 0, pending: 8 });
    expect(sel.openIssueCount(s)).toBe(5);
    expect(sel.openBlockingCount(s)).toBe(1);
    expect(sel.openIssueBreakdown(s)).toEqual({ error: 1, warning: 3, info: 1 });
  });
  it("card groups and coverage", () => {
    expect(ids(sel.cleanPendingCards(s))).toEqual(["F-001", "R-002", "C-006"]);
    expect(ids(sel.needsAttention(s))).toEqual(["R-003", "C-004", "R-005", "P-007", "R-008"]);
    expect(sel.uncoveredPassages(s).map((p) => p.id)).toEqual(["p8"]);
  });
  it("RED-09 selects the first card with an open issue", () => {
    expect(s.review.selectedCardId).toBe("R-003");
  });
});

describe("TEST-04 lineage selectors", () => {
  const s = reviewState();
  it("passage cards and used-by", () => {
    expect(ids(sel.passageCards(s, passage(s, "p5")))).toEqual(["R-005", "P-007"]);
    expect(ids(sel.passageCards(s, passage(s, "p3")))).toEqual(["R-003"]);
    expect(ids(sel.usedBy(s, card(s, "C-006")))).toEqual(["R-005", "P-007"]);
    expect(ids(sel.usedBy(s, card(s, "R-003")))).toEqual(["C-004"]);
  });
});

describe("TEST-05 RED-01 blocking guard", () => {
  it("approving R-008 is a no-op until ISS-01 is resolved", () => {
    const s = reviewState();
    expect(run(s, { type: "CARD_APPROVE", shortId: "R-008" })).toBe(s);
    const resolved = run(s, { type: "ISSUE_RESOLVE", issueId: "ISS-01", at: AT }, { type: "CARD_APPROVE", shortId: "R-008" });
    expect(resolved.review.decisions["R-008"]).toBe("approved");
  });
});

describe("TEST-06 RED-05 reopened error", () => {
  it("returns R-008 to pending with a notice", () => {
    const approved = run(reviewState(), { type: "ISSUE_RESOLVE", issueId: "ISS-01", at: AT }, { type: "CARD_APPROVE", shortId: "R-008" });
    const s = run(approved, { type: "ISSUE_UNRESOLVE", issueId: "ISS-01" });
    expect(s.review.decisions["R-008"]).toBeUndefined();
    expect(s.review.notices).toEqual(["R-008 returned to Pending because ISS-01 was reopened."]);
  });
});

describe("TEST-07 RED-06 bulk approve", () => {
  it("approves exactly the clean cards, once", () => {
    const s = run(reviewState(), { type: "BULK_APPROVE_CLEAN" });
    expect(Object.entries(s.review.decisions)).toEqual([["F-001", "approved"], ["R-002", "approved"], ["C-006", "approved"]]);
    expect(run(s, { type: "BULK_APPROVE_CLEAN" })).toBe(s);
  });
  it("skips cards whose issues are all resolved (cards with any issue are never bulk-approved)", () => {
    const s = run(reviewState(), { type: "ISSUE_RESOLVE", issueId: "ISS-02", at: AT }, { type: "BULK_APPROVE_CLEAN" });
    expect(s.review.decisions["R-003"]).toBeUndefined();
    expect(s.review.decisions["C-004"]).toBeUndefined();
  });
});

describe("TEST-08 publish gates", () => {
  it("needs every card decided and the uncovered passage acknowledged", () => {
    const others = ["F-001", "R-002", "R-003", "C-004", "R-005", "C-006", "P-007"];
    const s = run(
      reviewState(),
      ...others.map((shortId) => ({ type: "CARD_APPROVE" as const, shortId })),
      { type: "CARD_REJECT", shortId: "R-008" },
    );
    expect(sel.publishGates(s)).toEqual({ allDecided: true, noBlockingOnApproved: true, uncoveredAcknowledged: false });
    expect(sel.canPublish(s)).toBe(false);
    const done = run(s, { type: "ISSUE_RESOLVE", issueId: "ISS-03", at: AT });
    expect(sel.canPublish(done)).toBe(true);
    expect(sel.counts(done)).toMatchObject({ approved: 7, rejected: 1, pending: 0 });
  });
});

describe("TEST-09 warnings do not gate", () => {
  it("R-003 can be approved with ISS-02 open", () => {
    const s = run(reviewState(), { type: "CARD_APPROVE", shortId: "R-003" });
    expect(s.review.decisions["R-003"]).toBe("approved");
    expect(sel.isOpen(s, s.result!.issues.find((i) => i.id === "ISS-02")!)).toBe(true);
  });
});

describe("reducer rules", () => {
  it("RED-02 / RED-03 reject and reopen", () => {
    const s = run(reviewState(), { type: "CARD_REJECT", shortId: "R-008" });
    expect(s.review.decisions["R-008"]).toBe("rejected");
    expect(run(s, { type: "CARD_REJECT", shortId: "R-008" })).toBe(s);
    expect(run(s, { type: "CARD_REOPEN", shortId: "R-008" }).review.decisions).toEqual({});
  });
  it("RED-07 ignores unknown card IDs and never changes decisions", () => {
    const s = reviewState();
    expect(run(s, { type: "REVIEW_SELECT_CARD", shortId: "Z-999" })).toBe(s);
    const sel2 = run(s, { type: "REVIEW_SELECT_CARD", shortId: "F-001" });
    expect(sel2.review.selectedCardId).toBe("F-001");
    expect(sel2.review.decisions).toBe(s.review.decisions);
  });
  it("RED-08 RUN_STARTED clears downstream state", () => {
    const decided = run(reviewState(), { type: "BULK_APPROVE_CLEAN" }, { type: "ISSUE_RESOLVE", issueId: "ISS-03", at: AT });
    const s = run(decided, { type: "RUN_STARTED", at: AT });
    expect(s.result).toBeUndefined();
    expect(s.review.decisions).toEqual({});
    expect(s.review.resolutions).toEqual({});
    expect(s.run.status).toBe("running");
    expect(Object.values(s.run.stages).every((x) => x.status === "pending")).toBe(true);
  });
  it("RED-09 an invalid result fails the run", () => {
    const bad = cloneSample();
    bad.cards[0]!.evidence = [];
    const s = run(initialState(), { type: "RUN_STARTED", at: AT }, { type: "RUN_COMPLETED", result: bad });
    expect(s.run.status).toBe("failed");
    expect(s.run.error).toEqual({ message: "The decomposition result was invalid.", retryable: false });
    expect(s.result).toBeUndefined();
  });
  it("RED-10 metadata change after a run keeps the result and marks it stale", () => {
    const before = reviewState();
    const s = run(before, { type: "META_CHANGED", field: "owner", value: "Credit Risk" });
    expect(s.result).toBe(before.result);
    expect(s.run.stale).toBe(true);
  });
  it("RED-12 returns new objects and never mutates", () => {
    const s = reviewState();
    const frozen = JSON.stringify(s);
    const next = reducer(s, { type: "CARD_APPROVE", shortId: "F-001" });
    expect(next).not.toBe(s);
    expect(JSON.stringify(s)).toBe(frozen);
  });
  it("run events update stages and live counts; failure marks the running stage", () => {
    let s = run(initialState(), { type: "RUN_STARTED", at: AT });
    s = run(s, { type: "RUN_EVENT", event: { type: "stage_started", stage: "parse" } }, { type: "RUN_EVENT", event: { type: "stage_completed", stage: "parse", summary: "5 sections, 9 passages" } });
    s = run(s, { type: "RUN_EVENT", event: { type: "stage_started", stage: "extract" } }, { type: "RUN_EVENT", event: { type: "card_extracted", shortId: "F-001" } });
    expect(s.run.liveCounts.cards).toBe(1);
    s = run(s, { type: "RUN_FAILED", error: { message: "Decomposition timed out.", retryable: true } });
    expect(s.run.stages.parse.status).toBe("done");
    expect(s.run.stages.extract.status).toBe("failed");
  });
});

describe("TEST-16 stepper statuses", () => {
  it("follows spec 5.2", () => {
    const empty = initialState();
    expect(sel.furthestStep(empty)).toBe(1);
    expect(sel.stepStatus(empty, 1, 1)).toBe("current");
    expect(sel.isStepNavigable(empty, 2)).toBe(false);

    const loaded = run(empty, {
      type: "DOC_LOADED",
      ingest: { fileName: "p.pdf", sizeBytes: 1, sections: [], passages: cloneSample().passages, suggestedMeta: cloneSample().policy },
    });
    expect(sel.stepComplete(loaded, 1)).toBe(true);
    expect(sel.furthestStep(loaded)).toBe(2);

    const reviewing = reviewState();
    const withDoc = { ...reviewing, document: loaded.document, meta: loaded.meta };
    expect(sel.furthestStep(withDoc)).toBe(3);
    expect(sel.stepStatus(withDoc, 2, 3)).toBe("complete");
    expect(sel.isStepNavigable(withDoc, 4)).toBe(false);

    const decided = run(withDoc,
      ...withDoc.result!.cards.map((c) => ({ type: "CARD_REJECT" as const, shortId: c.shortId })),
      { type: "ISSUE_RESOLVE", issueId: "ISS-03", at: AT },
    );
    expect(sel.furthestStep(decided)).toBe(4);
    expect(sel.stepComplete(decided, 4)).toBe(false);
    expect(sel.stepComplete(run(decided, { type: "PUBLISH_EXPORTED" }), 4)).toBe(true);
  });
});

describe("TEST-13 persistence round trip", () => {
  it("restores an equal state minus transient fields", () => {
    const s = run(reviewState(), { type: "BULK_APPROVE_CLEAN" }, { type: "ISSUE_RESOLVE", issueId: "ISS-01", at: AT }, { type: "CARD_APPROVE", shortId: "R-008" }, { type: "ISSUE_UNRESOLVE", issueId: "ISS-01" });
    expect(s.review.notices.length).toBe(1);
    const restored = parseDraft(serializeDraft(s, AT), 1)!;
    expect(restored).toEqual({ ...toDraft(s), save: { status: "idle", lastSavedAt: AT } });
    expect(restored.review.notices).toEqual([]);
    expect(restored.review.decisions).toEqual(s.review.decisions);
  });
  it("stores a running run as cancelled", () => {
    const s = run(initialState(), { type: "RUN_STARTED", at: AT });
    expect(parseDraft(serializeDraft(s, AT), 1)!.run.status).toBe("cancelled");
  });
  it("discards a different schemaVersion and unreadable drafts", () => {
    const raw = serializeDraft(reviewState(), AT).replace('"schemaVersion":1', '"schemaVersion":2');
    expect(parseDraft(raw, 1)).toBeNull();
    expect(parseDraft("{not json", 1)).toBeNull();
    expect(parseDraft(null, 1)).toBeNull();
  });
  it("debounces writes and reports failures (PER-02, PER-04)", () => {
    const writes: string[] = [];
    const statuses: string[] = [];
    const writer = createDraftWriter({ setItem: (k, v) => { writes.push(k); void v; } }, (st) => statuses.push(st), () => AT, 10_000);
    writer.schedule(initialState());
    writer.schedule(initialState());
    expect(writes).toEqual([]);
    expect(writer.flush()).toBe(true);
    expect(writes).toEqual([DRAFT_KEY]);
    expect(statuses).toEqual(["saving", "idle"]);

    const failing = createDraftWriter({ setItem: () => { throw new Error("quota"); } }, (st) => statuses.push(st), () => AT, 10_000);
    failing.schedule(initialState());
    expect(failing.flush()).toBe(false);
    expect(statuses.at(-1)).toBe("failed");
  });
});
