// Loan evaluation (R3): run a bundle's cards against a loan file, in dependency order, and
// return a decision record with lineage. Deterministic: no clock, no randomness, no defaults.
import { itemName } from "../pipeline/checks.mjs";
import { run } from "./expr.mjs";
import { fullHash } from "./receipts.mjs";

export const LOAN_SCHEMA = "loan-file/1.0";
export const DECISION_SCHEMA = "loan-decision/1.0";

/** A required input the loan file does not supply. */
class Missing extends Error {
  constructor(path) { super(`missing input ${path}`); this.path = path; }
}
/** A read outside the input vocabulary. Validated bundles never do this. */
class Undeclared extends Error {
  constructor(path) { super(`read of undeclared input ${path}`); this.path = path; }
}

const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const getPath = (obj, path) => path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
function setPath(obj, path, value) {
  const keys = path.split(".");
  let o = obj;
  for (const k of keys.slice(0, -1)) o = o[k] && typeof o[k] === "object" ? o[k] : (o[k] = {});
  o[keys[keys.length - 1]] = value;
}

/**
 * The `i` object an expression sees. Leaves registered in the vocabulary return their value or
 * throw Missing (unless the input is `optional`); collections return arrays of item views; every
 * read is recorded for the decision's lineage.
 */
function makeInputs(vocab, state, used, current) {
  const prefixes = new Set(Object.keys(vocab).flatMap((p) => p.split(".").slice(0, -1).map((_, n, a) => a.slice(0, n + 1).join("."))));
  const itemPrefix = current ? itemName(current.collection) : null;

  const leaf = (path, value, label) => {
    used[label] = value === undefined ? null : value;
    if (value === undefined && !vocab[path].optional) throw new Missing(label);
    return value;
  };
  const itemView = (collection, item, index) => {
    const name = itemName(collection);
    const view = (prefix) => new Proxy(Object.create(null), {
      get(_, key) {
        if (typeof key === "symbol") return undefined;
        const path = `${prefix}.${key}`;
        const label = `${collection}[${index}]${path.slice(name.length)}`;
        if (vocab[path]) return leaf(path, getPath(item, path.slice(name.length + 1)), label);
        if (prefixes.has(path)) return view(path);
        throw new Undeclared(path);
      },
    });
    return view(name);
  };
  const view = (prefix) => new Proxy(Object.create(null), {
    get(_, key) {
      if (typeof key === "symbol") return undefined;
      const path = prefix ? `${prefix}.${key}` : key;
      if (current && path === itemPrefix) return itemView(current.collection, current.item, current.index);
      const spec = vocab[path];
      if (spec?.type === "collection") {
        const items = state.collections[path];
        if (!Array.isArray(items)) { used[path] = null; throw new Missing(path); }
        used[path] = `${items.length} item(s)`;
        return items.map((it, n) => itemView(path, it, n));
      }
      if (spec) return leaf(path, getPath(state.facts, path), path);
      if (prefixes.has(path)) return view(path);
      throw new Undeclared(path);
    },
  });
  return view("");
}

const SEVERITY_RANK = { fail: 3, condition: 2, pass: 1, info: 0 };

/**
 * Evaluate one bundle against one loan file. `selection` (from selectBundle) is recorded as-is.
 * Returns a `loan-decision/1.0` record.
 */
export function evaluate(bundle, loan, selection = null) {
  const vocab = bundle.inputs;
  const P = Object.fromEntries(Object.entries(bundle.parameters).map(([k, v]) => [k, v.value]));
  const state = { facts: clone(loan.facts) ?? {}, collections: clone(loan.collections) ?? {} };
  const binders = new Map();
  for (const c of bundle.cards) if (c.binds) binders.set(c.binds, [...(binders.get(c.binds) ?? []), c.slot]);
  const steps = [];
  const boundBy = new Map(); // "liabilities[2].qualifying_payment" -> slot that wrote it

  // `liabilities[2].qualifying_payment` is bound under the item path `liability.qualifying_payment`;
  // with shared per-item binds, the blocker is the card that ran (and failed) on that item.
  const blockedBy = (label) => {
    const m = label.match(/^(.+)\[(\d+)\]\.(.+)$/);
    const slots = binders.get(m ? `${itemName(m[1])}.${m[3]}` : label);
    if (!slots) return null;
    if (m) return steps.find((s) => slots.includes(s.slot) && s.item === +m[2])?.slot ?? slots[0];
    return slots[0];
  };

  function attempt(card, current) {
    const step = {
      slot: card.slot,
      ...(current ? { item: current.index } : {}),
      card_fingerprint: card.card_fingerprint,
      status: null,
      result: null,
      inputs_used: {},
      params_used: card.resolved_params,
      evidence: [...new Set(card.evidence.map((e) => e.passageId))],
      issues: card.issues,
    };
    const exec = (expr) => run(expr, makeInputs(vocab, state, step.inputs_used, current), P);
    const fail = (e) => {
      if (e instanceof Missing) {
        const by = blockedBy(e.path);
        return Object.assign(step, { status: "needs_input", missing: e.path, ...(by && by !== card.slot ? { blocked_by: by } : {}) });
      }
      return Object.assign(step, { status: "error", error: e instanceof Undeclared ? e.message : String(e.message ?? e) });
    };

    try {
      if (current && card.item_when && !exec(card.item_when)) return null; // item filtered out: no step
      if (card.applies_when && !exec(card.applies_when)) return Object.assign(step, { status: "not_applicable" });
    } catch (e) { return fail(e); }

    const blocking = card.issues.filter((id) => bundle.issues[id]?.blocking);
    if (blocking.length) return Object.assign(step, { status: "refer_to_person", reason: "blocking_issue", blocking_issues: blocking });
    if (!card.expr || !card.machineEvaluable) {
      const reason = card.type === "procedure" ? "procedure" : card.type === "fact" ? "fact" : "not_machine_evaluable";
      return Object.assign(step, { status: "refer_to_person", reason, severity: reason === "procedure" ? "condition" : reason === "fact" ? "info" : undefined });
    }

    let result;
    try { result = exec(card.expr); } catch (e) { return fail(e); }
    if (typeof result === "number" && !Number.isFinite(result)) return Object.assign(step, { status: "error", error: `result is ${result}` });
    Object.assign(step, { status: "evaluated", result, severity: card.result_severity?.[String(result)] ?? "info" });

    const assumptions = card.issues.filter((id) => bundle.issues[id] && !bundle.issues[id].blocking);
    if (assumptions.length) step.assumptions = assumptions;

    if (card.binds) {
      if (current) {
        const field = card.binds.slice(itemName(current.collection).length + 1);
        const label = `${current.collection}[${current.index}].${field}`;
        if (boundBy.has(label)) return Object.assign(step, { status: "error", result: null, severity: undefined, error: `${label} is claimed by both ${boundBy.get(label)} and ${card.slot}; their item filters overlap` });
        boundBy.set(label, card.slot);
        const before = getPath(current.item, field);
        if (before !== undefined && before !== result) step.discrepancy = { path: card.binds, supplied: before, computed: result };
        setPath(current.item, field, result);
      } else {
        const before = getPath(state.facts, card.binds);
        if (before !== undefined && before !== result) step.discrepancy = { path: card.binds, supplied: before, computed: result };
        setPath(state.facts, card.binds, result);
      }
    }
    return step;
  }

  for (const card of bundle.cards) {
    if (!card.over) { steps.push(attempt(card, null)); continue; }
    const items = state.collections[card.over];
    if (!Array.isArray(items)) {
      steps.push({ slot: card.slot, card_fingerprint: card.card_fingerprint, status: "needs_input", missing: card.over, result: null, inputs_used: {}, params_used: card.resolved_params, evidence: [...new Set(card.evidence.map((e) => e.passageId))], issues: card.issues });
      continue;
    }
    items.forEach((item, index) => {
      const s = attempt(card, { collection: card.over, item, index });
      if (s) steps.push(s);
    });
  }

  for (const s of steps) if (s.severity === undefined) delete s.severity;
  const outcome = decide(steps);
  const outstanding = steps
    .filter((s) => s.status === "needs_input" ? !s.blocked_by : s.status === "error" || (s.status === "refer_to_person" && s.reason !== "fact"))
    .map((s) => ({
      slot: s.slot,
      ...(s.item !== undefined ? { item: s.item } : {}),
      status: s.status,
      ...(s.missing ? { missing: s.missing } : {}),
      ...(s.reason ? { reason: s.reason } : {}),
      ...(s.error ? { error: s.error } : {}),
    }));

  const decision = {
    schema: DECISION_SCHEMA,
    loan_id: loan.loan_id,
    policy: { id: bundle.policy.id, version: bundle.policy.version, bundle_hash: bundle.bundle_hash },
    selection,
    steps,
    outcome,
    outstanding,
  };
  return { ...decision, decision_hash: fullHash(decision) };
}

/**
 * Outcome (R3): fail beats everything; then anything a person must supply or decide makes the
 * check incomplete; then conditions; then pass. If nothing applied, the policy does not apply.
 */
export function decide(steps) {
  if (steps.some((s) => s.severity === "fail")) return "fail";
  if (steps.some((s) => s.status === "needs_input" || s.status === "error" || (s.status === "refer_to_person" && (s.reason === "blocking_issue" || s.reason === "not_machine_evaluable")))) return "incomplete";
  const worst = Math.max(-1, ...steps.map((s) => SEVERITY_RANK[s.severity] ?? -1));
  if (worst >= 2) return "condition";
  if (worst === 1) return "pass";
  return "not_applicable";
}

/** The decision for a policy with no version in force on the loan's date. */
export function noPolicyDecision(policyId, loan, selection) {
  const decision = {
    schema: DECISION_SCHEMA,
    loan_id: loan.loan_id,
    policy: { id: policyId, version: null, bundle_hash: null },
    selection,
    steps: [],
    outcome: "no_policy_in_force",
    outstanding: [],
  };
  return { ...decision, decision_hash: fullHash(decision) };
}
