// Check one loan against a library (R4 + R3 + R6): select, memo, evaluate, record.
import { evaluate, noPolicyDecision, LOAN_SCHEMA } from "./evaluate.mjs";
import { memo, record } from "./receipts.mjs";
import { policies, selectBundle } from "./select.mjs";

/**
 * Check one loan against every policy in a library. With `store`, each decision is memoised and
 * receipted: an unchanged loan, bundle and selection returns the stored decision and appends a
 * `skipped` receipt. Returns `[{ decision, bundle, receipt? }]`, one per policy.
 */
export function checkLoan(library, loan, { asOfRule, adopt, store, policy } = {}) {
  if (loan.schema !== LOAN_SCHEMA) throw new Error(`${loan.loan_id ?? "loan file"}: expected schema ${LOAN_SCHEMA}`);
  if (!loan.loan_id) throw new Error("loan file has no loan_id");
  const ids = policy ? [policy] : policies(library);
  return ids.map((id) => {
    const { bundle, selection } = selectBundle(library, id, loan, { asOfRule, adopt });
    if (!bundle) {
      const decision = noPolicyDecision(id, loan, selection);
      return { decision, bundle: null, receipt: store ? record(store, loan, decision) : undefined };
    }
    if (store) {
      const hit = memo(store, loan, id, bundle.bundle_hash, selection);
      if (hit) return { decision: hit, bundle, receipt: record(store, loan, hit, { skipped: true }) };
    }
    const decision = evaluate(bundle, loan, selection);
    return { decision, bundle, receipt: store ? record(store, loan, decision) : undefined };
  });
}
