// Mock decomposition (build spec 8.2): deterministic stage events, then the Appendix B result
// filtered by the selected card types and checks.
import { cardId, cardUri } from "../domain/ids";
import { cloneSample } from "../domain/sample";
import type { CheckKey, DecompositionResult, IssueKind } from "../domain/types";
import type { SetupState } from "../store/state";
import { delay, type DecompositionAdapter } from "./types";

/** Issue kinds each check produces. `undefined_term` follows ambiguity (spec 8.2). */
const CHECK_KINDS: Record<CheckKey, IssueKind[]> = {
  ambiguity: ["not_evaluable", "undefined_term"],
  references: ["unresolved_reference"],
  conflicts: ["conflict"],
  inferred: ["inferred"],
};

/**
 * Applies the setup to a full result:
 * 1. cards of unselected types are removed, with relations to them and issues attached only to them;
 * 2. issues from unselected checks are removed (inferred flags stay on fields as data);
 * 3. every passage left without a card and without a passage-level issue gets an info `no_card`
 *    issue, so VAL-06 / DATA-09 hold whatever was filtered (interpretation recorded as Q10).
 */
export function applySetup(full: DecompositionResult, setup: SetupState): DecompositionResult {
  const r = structuredClone(full);

  const kept = new Set(r.cards.filter((c) => setup.types[c.type]).map((c) => c.shortId));
  r.cards = r.cards.filter((c) => kept.has(c.shortId));
  for (const c of r.cards) c.relations = c.relations.filter((rel) => kept.has(rel.shortId));
  r.issues = r.issues
    .map((i) => ({ ...i, cardIds: i.cardIds.filter((id) => kept.has(id)) }))
    .filter((i) => i.cardIds.length > 0 || i.passageId !== undefined);

  const droppedKinds = new Set((Object.keys(CHECK_KINDS) as CheckKey[]).filter((k) => !setup.checks[k]).flatMap((k) => CHECK_KINDS[k]));
  r.issues = r.issues.filter((i) => !droppedKinds.has(i.kind));

  const liveIssueIds = new Set(r.issues.map((i) => i.id));
  for (const c of r.cards) c.issueIds = c.issueIds.filter((id) => liveIssueIds.has(id));

  const cited = new Set(r.cards.flatMap((c) => c.evidence.map((e) => e.passageId)));
  let next = Math.max(0, ...full.issues.map((i) => Number(i.id.replace(/\D/g, "")) || 0)) + 1;
  for (const p of r.passages) {
    if (cited.has(p.id) || r.issues.some((i) => i.passageId === p.id && i.cardIds.length === 0)) continue;
    r.issues.push({
      id: `ISS-${String(next++).padStart(2, "0")}`,
      severity: "info",
      kind: "no_card",
      title: "No card generated: card type not selected",
      detail: `Passage ${p.ref} produced no card because its card type was not selected, or its finding check was turned off.`,
      fix: "Acknowledge, or select the card type and run the decomposition again.",
      cardIds: [],
      passageId: p.id,
    });
  }
  return r;
}

export function createMockDecompose({ delayMs = 400 }: { delayMs?: number } = {}): DecompositionAdapter {
  return {
    async run(req, onEvent, signal) {
      const result = applySetup(cloneSample(), req.setup);
      const sections = new Set(req.passages.map((p) => p.sectionNo)).size;

      onEvent({ type: "stage_started", stage: "parse" });
      await delay(delayMs, signal);
      onEvent({ type: "stage_completed", stage: "parse", summary: `${sections} sections, ${req.passages.length} passages` });

      onEvent({ type: "stage_started", stage: "extract" });
      await delay(delayMs, signal);
      if (req.meta.policyId.toUpperCase().includes("FAIL")) {
        throw { code: "timeout", message: "Decomposition timed out.", retryable: true };
      }
      for (const c of result.cards) onEvent({ type: "card_extracted", shortId: c.shortId });
      onEvent({ type: "stage_completed", stage: "extract", summary: `${result.cards.length} cards` });

      onEvent({ type: "stage_started", stage: "lineage" });
      await delay(delayMs, signal);
      onEvent({ type: "stage_completed", stage: "lineage", summary: "Each card tied to its passage and quoted evidence" });

      onEvent({ type: "stage_started", stage: "check" });
      await delay(delayMs, signal);
      for (const i of result.issues) onEvent({ type: "issue_found", issueId: i.id, severity: i.severity });
      onEvent({ type: "stage_completed", stage: "check", summary: `${result.issues.length} issues` });

      onEvent({ type: "stage_started", stage: "assign_ids" });
      await delay(delayMs, signal);
      onEvent({ type: "stage_completed", stage: "assign_ids", summary: "Card ID, canonical URI, applicability and tags" });

      // DATA-02: IDs come from the pipeline, keyed on the policy metadata the reviewer confirmed.
      const policy = { ...req.meta };
      const cards = result.cards.map((c) => ({
        ...c,
        cardId: cardId(policy.policyId, c.type, c.seq),
        uri: cardUri(policy.policyId, policy.version, c.type, c.seq),
      }));
      return { ...result, policy, cards };
    },
  };
}
