// Plain-language trace of a decision (R7). The agent answers from this, never from its own math.
const fmt = (v) => {
  if (v === null || v === undefined) return "none";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(+v.toFixed(4));
  return typeof v === "string" ? v : JSON.stringify(v);
};
const short = (h) => (h ? h.replace("sha256:", "").slice(0, 12) : "none");

const OUTCOME = {
  pass: "meets the policy",
  condition: "meets the policy with conditions",
  fail: "does not meet the policy",
  incomplete: "cannot be decided yet",
  not_applicable: "is not subject to any pass or fail requirement in this policy (outside its scope, or only informational cards applied)",
  no_policy_in_force: "has no policy version in force",
};

/**
 * Explain a decision against the bundle it was made with. Returns `{ text, lines }`.
 * With `quotes`, evidence is printed from the bundle; decisions themselves never hold policy text.
 */
export function explain(decision, bundle, { quotes = false } = {}) {
  const lines = [];
  const sel = decision.selection;
  lines.push(`Loan ${decision.loan_id} · ${decision.policy.id} ${decision.policy.version ?? "(none)"} · bundle ${short(decision.policy.bundle_hash)}`);
  if (sel) lines.push(`Version: ${sel.reason}${sel.rule ? ` (as-of rule: ${sel.rule})` : ""}`);
  lines.push(`Outcome: ${decision.outcome.toUpperCase()} — the loan ${OUTCOME[decision.outcome] ?? decision.outcome}`);
  lines.push(`Decision ${short(decision.decision_hash)}`);
  if (!bundle) return { text: lines.join("\n"), lines };

  const cards = new Map(bundle.cards.map((c) => [c.slot, c]));
  lines.push("");
  for (const s of decision.steps) {
    const c = cards.get(s.slot);
    const id = `${s.slot}${s.item !== undefined ? `[${s.item}]` : ""}`;
    const head = `- ${id} (${c?.title ?? "unknown card"}) · card ${short(s.card_fingerprint)}`;
    let body;
    switch (s.status) {
      case "evaluated": {
        const ins = Object.entries(s.inputs_used).map(([k, v]) => `${k}=${fmt(v)}`).join(", ");
        const prm = Object.entries(s.params_used).map(([k, v]) => `${k}=${fmt(v)}`).join(", ");
        body = `result ${fmt(s.result)}${s.severity && s.severity !== "info" ? ` [${s.severity}]` : ""} from ${ins || "no inputs"}${prm ? `; parameters ${prm}` : ""}`;
        break;
      }
      case "not_applicable": body = "does not apply to this loan"; break;
      case "needs_input": body = s.blocked_by ? `not run: ${s.missing} comes from ${s.blocked_by}, which did not produce it` : `needs input ${s.missing}`; break;
      case "refer_to_person":
        body = s.reason === "blocking_issue" ? `a person must decide: open blocking issue ${s.blocking_issues.join(", ")}`
          : s.reason === "procedure" ? "a person must carry out this procedure"
          : s.reason === "fact" ? "for information"
          : "a person must decide: the card is not machine-evaluable";
        break;
      case "error": body = `error: ${s.error}`; break;
      default: body = s.status;
    }
    lines.push(head, `    ${body}`);
    if (s.assumptions?.length) for (const a of s.assumptions) lines.push(`    assumes: ${a} ${bundle.issues[a]?.title ?? ""}`.trimEnd());
    if (s.discrepancy) lines.push(`    discrepancy: the file says ${s.discrepancy.path}=${fmt(s.discrepancy.supplied)}, the card computed ${fmt(s.discrepancy.computed)}`);
    lines.push(`    evidence: passages ${s.evidence.join(", ")}`);
    if (quotes && c) for (const e of c.evidence) lines.push(`      ${e.passageId}: "${e.quote}"`);
  }
  if (decision.outstanding.length) {
    lines.push("", "Outstanding:");
    for (const o of decision.outstanding) {
      const id = `${o.slot}${o.item !== undefined ? `[${o.item}]` : ""}`;
      lines.push(`- ${id}: ${o.status === "needs_input" ? `supply ${o.missing}` : o.status === "error" ? `fix error: ${o.error}` : `person to ${o.reason === "procedure" ? "carry out the procedure" : "decide"}`}`);
    }
  }
  return { text: lines.join("\n"), lines };
}
