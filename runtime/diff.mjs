// Step-level diff of two decisions for the same loan and policy (pipeline re-check, P3).
// Says which cards moved, which only saw different inputs, and which results changed.
import { token } from "./receipts.mjs";

const key = (s) => `${s.slot}#${s.item ?? ""}`;
const same = (a, b) => (typeof a === "number" && typeof b === "number" ? Math.abs(a - b) < 1e-9 : token(a) === token(b));
const outKey = (o) => `${o.slot}#${o.item ?? ""}#${o.status}#${o.missing ?? o.reason ?? o.error ?? ""}`;

export const STEP_CLASSES = ["result_changed", "card_changed", "inputs_changed", "unchanged", "added", "removed"];

/**
 * Compare `prev` and `next` decisions. Each step gets one class, in priority order:
 * result_changed (result or status differs), card_changed (fingerprint moved), inputs_changed
 * (same card, different inputs), unchanged, added or removed. `card_changed` and
 * `inputs_changed` are also reported as flags on result_changed steps.
 */
export function diffDecisions(prev, next) {
  const before = new Map(prev.steps.map((s) => [key(s), s]));
  const after = new Map(next.steps.map((s) => [key(s), s]));
  const steps = [];
  for (const [k, n] of after) {
    const p = before.get(k);
    if (!p) { steps.push({ slot: n.slot, ...(n.item !== undefined ? { item: n.item } : {}), class: "added", result: { before: null, after: n.result }, status: { before: null, after: n.status } }); continue; }
    const cardChanged = p.card_fingerprint !== n.card_fingerprint;
    const inputsChanged = token(p.inputs_used) !== token(n.inputs_used);
    const resultChanged = p.status !== n.status || !same(p.result, n.result);
    steps.push({
      slot: n.slot,
      ...(n.item !== undefined ? { item: n.item } : {}),
      class: resultChanged ? "result_changed" : cardChanged ? "card_changed" : inputsChanged ? "inputs_changed" : "unchanged",
      card_changed: cardChanged,
      inputs_changed: inputsChanged,
      card: { before: p.card_fingerprint, after: n.card_fingerprint },
      result: { before: p.result, after: n.result },
      status: { before: p.status, after: n.status },
    });
  }
  for (const [k, p] of before) if (!after.has(k)) steps.push({ slot: p.slot, ...(p.item !== undefined ? { item: p.item } : {}), class: "removed", result: { before: p.result, after: null }, status: { before: p.status, after: null } });

  const assumptions = (d) => new Set(d.steps.flatMap((s) => s.assumptions ?? []));
  const prevA = assumptions(prev);
  const prevOut = new Set(prev.outstanding.map(outKey));
  const counts = Object.fromEntries(STEP_CLASSES.map((c) => [c, steps.filter((s) => s.class === c).length]));
  return {
    version: { before: prev.policy.version, after: next.policy.version },
    outcome: { before: prev.outcome, after: next.outcome },
    counts,
    steps,
    assumptions_added: [...assumptions(next)].filter((a) => !prevA.has(a)).sort(),
    outstanding_added: next.outstanding.filter((o) => !prevOut.has(outKey(o))),
  };
}

/** Did anything move at all? */
export const changed = (diff) => diff.outcome.before !== diff.outcome.after || diff.version.before !== diff.version.after || diff.steps.some((s) => s.class !== "unchanged");
