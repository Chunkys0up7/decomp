// Fingerprints and receipts (R6). Same model as the OpenProse spike's VM: a receipt says what ran,
// against which contract and input fingerprints, with what result, and links to the previous one.
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import canonicalize from "canonicalize";

const hex = (s) => createHash("sha256").update(s).digest("hex");
/** Short fingerprint, as used for facets and cards: 16 hex characters. */
export const sha = (s) => "sha256:" + hex(s).slice(0, 16);
export const token = (v) => sha(canonicalize(v ?? null));
/** Full SHA-256 of the RFC 8785 canonical form, for bundles and decisions. */
export const fullHash = (v) => "sha256:" + hex(canonicalize(v ?? null));

export function readReceipts(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

export function appendReceipt(file, node, receipt) {
  const all = readReceipts(file);
  const prev = all[all.length - 1];
  const r = { node, ...receipt, prev: prev ? prev.id : null, sig: { signer: null } };
  r.id = sha(canonicalize(r));
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, JSON.stringify(r) + "\n");
  return r;
}

const loanDir = (store, loanId) => join(store, "loans", loanId.replace(/[^A-Za-z0-9._-]/g, "_"));
export const receiptsFile = (store, loanId) => join(loanDir(store, loanId), "receipts.jsonl");
export const decisionFile = (store, loanId, hash) => join(loanDir(store, loanId), "decisions", `${hash.replace(":", "-")}.json`);

/** Input fingerprint for a loan check: the loan's facts and collections, nothing else. */
export const loanInputs = (loan) => token({ facts: loan.facts ?? {}, collections: loan.collections ?? {} });

/**
 * Memo lookup: the last non-failed receipt for this loan and policy whose bundle and inputs match.
 * Returns the stored decision when there is one, so an unchanged check is skipped, not recomputed.
 */
export function memo(store, loan, policyId, bundleHash, selection) {
  const inputs = loanInputs(loan);
  const last = [...readReceipts(receiptsFile(store, loan.loan_id))].reverse()
    .find((r) => r.policy === policyId && r.status !== "failed");
  if (!last || last.contract_fingerprint !== bundleHash || last.input_fingerprints.loan !== inputs || last.input_fingerprints.selection !== token(selection)) return null;
  const f = decisionFile(store, loan.loan_id, last.fingerprints.decision);
  return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null;
}

/** Store the decision and append a `loan-check` receipt: rendered on a new decision, skipped on a memo hit. */
export function record(store, loan, decision, { skipped = false, at = new Date().toISOString() } = {}) {
  const file = receiptsFile(store, loan.loan_id);
  const prev = [...readReceipts(file)].reverse().find((r) => r.policy === decision.policy.id && r.status !== "failed");
  const df = decisionFile(store, loan.loan_id, decision.decision_hash);
  if (!existsSync(df)) { mkdirSync(dirname(df), { recursive: true }); writeFileSync(df, JSON.stringify(decision, null, 2) + "\n"); }
  return appendReceipt(file, "loan-check", {
    loan: loan.loan_id,
    policy: decision.policy.id,
    contract_fingerprint: decision.policy.bundle_hash,
    input_fingerprints: { loan: loanInputs(loan), selection: token(decision.selection) },
    fingerprints: { decision: decision.decision_hash },
    semantic_diff: skipped || !prev ? null : {
      version: prev.version === decision.policy.version ? null : [prev.version, decision.policy.version],
      outcome: prev.outcome === decision.outcome ? null : [prev.outcome, decision.outcome],
    },
    version: decision.policy.version,
    outcome: decision.outcome,
    status: skipped ? "skipped" : "rendered",
    at,
  });
}
