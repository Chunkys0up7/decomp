// Result validation (build spec 8.5), run on RUN_COMPLETED and on draft restore.
import { isEvidenceVerified } from "./evidence";
import { cardId, cardUri, shortId } from "./ids";
import type { DecompositionResult } from "./types";

export interface ValidationFailure {
  code: `VAL-0${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;
  message: string;
}

export function validateResult(result: DecompositionResult): ValidationFailure[] {
  const { cards, issues, passages, policy } = result;
  const failures: ValidationFailure[] = [];
  const fail = (code: ValidationFailure["code"], message: string) => failures.push({ code, message });
  const byShortId = new Map(cards.map((c) => [c.shortId, c]));
  const issueIds = new Set(issues.map((i) => i.id));

  const seqs = new Set<number>();
  for (const c of cards) {
    for (const e of c.evidence) {
      if (!isEvidenceVerified(e, passages)) fail("VAL-01", `${c.shortId}: evidence on ${e.passageId} does not match the passage text`);
    }
    if (c.evidence.length === 0) fail("VAL-02", `${c.shortId}: no evidence`);
    if (c.shortId !== shortId(c.type, c.seq) || c.cardId !== cardId(policy.policyId, c.type, c.seq) || c.uri !== cardUri(policy.policyId, policy.version, c.type, c.seq)) {
      fail("VAL-03", `${c.shortId}: IDs do not follow the ID rules`);
    }
    if (seqs.has(c.seq)) fail("VAL-04", `${c.shortId}: duplicate seq ${c.seq}`);
    seqs.add(c.seq);
    for (const r of c.relations) if (!byShortId.has(r.shortId)) fail("VAL-05", `${c.shortId}: relation to unknown card ${r.shortId}`);
    for (const i of c.issueIds) if (!issueIds.has(i)) fail("VAL-05", `${c.shortId}: unknown issue ${i}`);
    if (!(c.confidence >= 0 && c.confidence <= 1)) fail("VAL-08", `${c.shortId}: confidence ${c.confidence} outside [0, 1]`);
  }

  const cited = new Set(cards.flatMap((c) => c.evidence.map((e) => e.passageId)));
  for (const p of passages) {
    if (!cited.has(p.id) && !issues.some((i) => i.passageId === p.id && i.cardIds.length === 0)) {
      fail("VAL-06", `${p.id}: no card and no passage-level issue`);
    }
  }

  // VAL-07: depth-first search for a cycle in depends_on edges.
  const state = new Map<string, "visiting" | "done">();
  const visit = (id: string): boolean => {
    if (state.get(id) === "done") return false;
    if (state.get(id) === "visiting") return true;
    state.set(id, "visiting");
    const cycle = (byShortId.get(id)?.relations ?? []).some((r) => byShortId.has(r.shortId) && visit(r.shortId));
    state.set(id, "done");
    return cycle;
  };
  for (const c of cards) if (visit(c.shortId)) { fail("VAL-07", `relation cycle through ${c.shortId}`); break; }

  return failures;
}
