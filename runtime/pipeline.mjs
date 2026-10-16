// Pipeline re-check (docs/specs/pipeline-recheck.md): re-assess every loan in a lender's pipeline
// against the current library, re-running only what moved, and queue the loans a person must see.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { changed, diffDecisions } from "./diff.mjs";
import { checkLoan } from "./check.mjs";
import { appendReceipt, decisionFile, fullHash, readReceipts, receiptsFile, token } from "./receipts.mjs";
import { parseAdopt } from "./select.mjs";

export const PIPELINE_SCHEMA = "loan-pipeline/1.0";
export const REPORT_SCHEMA = "pipeline-report/1.0";
export const STATUSES = ["in_process", "closed", "sold"];
/** Queue reasons, most urgent first (P4). */
export const QUEUE_REASONS = ["newly_incomplete", "outcome_changed", "would_change", "result_changed", "new_assumption"];

/** Read a manifest; loan files resolve relative to it. */
export function loadPipeline(file) {
  const m = JSON.parse(readFileSync(file, "utf8"));
  if (m.schema !== PIPELINE_SCHEMA) throw new Error(`${file}: expected schema ${PIPELINE_SCHEMA}`);
  const base = dirname(file);
  return {
    lender: m.lender ?? {},
    loans: m.loans.map((l) => {
      if (!STATUSES.includes(l.status)) throw new Error(`${l.file}: status must be one of ${STATUSES.join(", ")}`);
      const path = resolve(base, l.file);
      return { file: path, status: l.status, loan: JSON.parse(readFileSync(path, "utf8")) };
    }),
  };
}

/** One fingerprint for the whole library: which bundle versions were available to the run. */
export const libraryFingerprint = (library) => token(library.map((b) => b.bundle_hash).sort());

/** The last recorded decision per policy for a loan, read before this run writes anything. */
function lastDecisions(store, loanId) {
  if (!store) return {};
  const out = {};
  for (const r of readReceipts(receiptsFile(store, loanId))) {
    if (r.status === "failed") continue;
    const f = decisionFile(store, loanId, r.fingerprints.decision);
    if (existsSync(f)) out[r.policy] = JSON.parse(readFileSync(f, "utf8"));
  }
  return out;
}

function queueReason(mode, diff) {
  if (!diff || mode === "skipped" || !changed(diff)) return null;
  if (mode === "impact") return "would_change";
  if (diff.outcome.after === "incomplete" && diff.outcome.before !== "incomplete") return "newly_incomplete";
  if (diff.outcome.before !== diff.outcome.after) return "outcome_changed";
  if (diff.steps.some((s) => s.class === "result_changed" || s.class === "added" || s.class === "removed")) return "result_changed";
  if (diff.assumptions_added.length) return "new_assumption";
  return null;
}

/**
 * Re-check a pipeline. In-process loans are checked with the store (memo: unchanged is skipped);
 * closed and sold loans are evaluated for impact only and never recorded. Returns the report and
 * appends a `pipeline-recheck` run receipt when a store is given.
 */
export function recheck(library, pipeline, { store, adopt, asOfRule, at } = {}) {
  const lender = {
    as_of_rule: asOfRule ?? pipeline.lender.as_of_rule ?? "note_date",
    adopt: adopt ?? pipeline.lender.adopt ?? [],
  };
  const opts = { asOfRule: lender.as_of_rule, adopt: parseAdopt(lender.adopt) };
  const rows = [];
  for (const { status, loan } of pipeline.loans) {
    const prev = lastDecisions(store, loan.loan_id);
    const impact = status !== "in_process";
    for (const { decision, receipt } of checkLoan(library, loan, { ...opts, store: impact ? undefined : store })) {
      const before = prev[decision.policy.id];
      const mode = impact ? "impact" : !before ? "first" : receipt.status;
      const diff = before && mode !== "skipped" ? diffDecisions(before, decision) : null;
      const reason = queueReason(mode, diff);
      rows.push({
        loan_id: loan.loan_id,
        status,
        policy: decision.policy.id,
        mode,
        version: { before: before?.policy.version ?? null, after: decision.policy.version },
        outcome: { before: before?.outcome ?? null, after: decision.outcome },
        decision: decision.decision_hash,
        ...(receipt ? { receipt: receipt.id } : {}),
        ...(diff ? { diff: { counts: diff.counts, steps: diff.steps.filter((s) => s.class !== "unchanged"), unchanged: diff.steps.filter((s) => s.class === "unchanged").map((s) => `${s.slot}${s.item !== undefined ? `[${s.item}]` : ""}`), assumptions_added: diff.assumptions_added, outstanding_added: diff.outstanding_added } } : {}),
        queue_reason: reason,
      });
    }
  }
  const rank = (r) => QUEUE_REASONS.indexOf(r.queue_reason);
  const queue = rows.filter((r) => r.queue_reason).sort((a, b) => rank(a) - rank(b) || a.loan_id.localeCompare(b.loan_id))
    .map((r) => ({ loan_id: r.loan_id, policy: r.policy, reason: r.queue_reason, outcome: r.outcome, version: r.version }));
  const count = (m) => rows.filter((r) => r.mode === m).length;
  const report = {
    schema: REPORT_SCHEMA,
    library_fingerprint: libraryFingerprint(library),
    lender,
    totals: { loans: pipeline.loans.length, checks: rows.length, first: count("first"), rendered: count("rendered"), skipped: count("skipped"), impact_only: count("impact"), queued: queue.length },
    loans: rows,
    queue,
  };
  // The report hash leaves out receipt ids, which carry timestamps; everything else is deterministic.
  report.report_hash = fullHash({ ...report, loans: rows.map(({ receipt, ...r }) => r) });
  if (store) {
    report.receipt = appendReceipt(join(store, "pipeline", "receipts.jsonl"), "pipeline-recheck", {
      contract_fingerprint: report.library_fingerprint,
      input_fingerprints: { lender: token(lender), loans: token(pipeline.loans.map((l) => [l.loan.loan_id, l.status])) },
      fingerprints: { report: report.report_hash },
      totals: report.totals,
      loan_receipts: rows.filter((r) => r.receipt).map((r) => r.receipt),
      status: "rendered",
      at: at ?? new Date().toISOString(),
    }).id;
  }
  return report;
}

/** Plain-text summary for the CLI and the agent. */
export function summarize(report) {
  const fmtV = (v) => (v.before && v.before !== v.after ? `${v.before} -> ${v.after}` : v.after ?? "none");
  const lines = [];
  const t = report.totals;
  lines.push(`Pipeline re-check · library ${report.library_fingerprint.slice(7)} · as-of ${report.lender.as_of_rule}${report.lender.adopt.length ? ` · adopted ${report.lender.adopt.join(", ")}` : ""}`);
  lines.push(`${t.loans} loans, ${t.checks} checks: ${t.first} first, ${t.rendered} re-rendered, ${t.skipped} skipped, ${t.impact_only} impact-only · ${t.queued} queued`);
  lines.push("");
  for (const r of report.loans) {
    lines.push(`${r.loan_id.padEnd(8)} ${r.status.padEnd(10)} ${r.mode.padEnd(8)} ${r.policy} ${fmtV(r.version).padEnd(24)} ${fmtV(r.outcome).padEnd(22)} ${r.queue_reason ?? ""}`.trimEnd());
  }
  if (report.queue.length) {
    lines.push("", "Review queue:");
    for (const q of report.queue) {
      const r = report.loans.find((x) => x.loan_id === q.loan_id && x.policy === q.policy);
      lines.push(`- ${q.loan_id} (${q.policy}) ${q.reason}: ${fmtV(q.outcome)}, version ${fmtV(q.version)}`);
      for (const s of r.diff?.steps ?? []) {
        const id = `${s.slot}${s.item !== undefined ? `[${s.item}]` : ""}`;
        const why = [s.card_changed ? "card changed" : null, s.inputs_changed ? "inputs changed" : null].filter(Boolean).join(", ");
        const res = (v) => (typeof v === "number" ? String(+v.toFixed(4)) : JSON.stringify(v));
        const move = s.status.before !== s.status.after ? `${s.status.before ?? "none"} -> ${s.status.after ?? "none"}` : `${res(s.result.before)} -> ${res(s.result.after)}`;
        lines.push(`    ${id}: ${s.class}${why ? ` (${why})` : ""}${["result_changed", "added", "removed"].includes(s.class) ? ` ${move}` : ""}`);
      }
      if (r.diff?.unchanged.length) lines.push(`    unchanged: ${r.diff.unchanged.join(", ")}`);
      if (r.diff?.assumptions_added.length) lines.push(`    new assumptions: ${r.diff.assumptions_added.join(", ")}`);
      for (const o of r.diff?.outstanding_added ?? []) lines.push(`    newly outstanding: ${o.slot} ${o.missing ?? o.reason ?? o.error}`);
    }
  }
  if (report.receipt) lines.push("", `Run receipt ${report.receipt.slice(7)}`);
  return lines.join("\n");
}
