// Runtime bundles (R1): an executable, immutable snapshot of one policy version, built from a
// validated policy map and card set. The bundle is what agents run; the review UI's published
// artifact stays the human-facing record (open question Q8).
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { entries, order, validateSet } from "../pipeline/checks.mjs";
import { fullHash, token } from "./receipts.mjs";

export const BUNDLE_SCHEMA = "policy-card-runtime/1.0";

export class BundleError extends Error {
  constructor(errors) {
    super(`card set failed validation with ${errors.length} error(s):\n  ${errors.join("\n  ")}`);
    this.errors = errors;
  }
}

const show = (v, unit) => (unit === "ratio" || /fraction/.test(unit ?? "") ? `${+(v * 100).toFixed(2)}%` : String(v));
const resolve = (text, params) => String(text).replace(/\{\{([A-Z0-9_]+)\}\}/g, (m, id) => (params[id] ? show(params[id].value, params[id].unit) : m));

/** Build a bundle from `{passages, map, cards}`. Throws BundleError unless the set validates. */
export function buildBundle({ passages, map, cards }, { effectiveTo, supersedes } = {}) {
  const { errors } = validateSet({ passages, map, cards });
  if (errors.length) throw new BundleError(errors);

  const params = entries(map.parameters);
  const issues = Object.fromEntries(map.issues.map((i) => [i.id, {
    severity: i.severity,
    blocking: i.severity === "error",
    title: resolve(i.title, params),
    passages: i.passages,
  }]));

  const out = order(cards).map((c) => {
    const card = {
      slot: c.slot,
      type: c.type,
      title: resolve(c.title, params),
      ...(c.expr ? { expr: c.expr } : {}),
      ...(c.applies_when ? { applies_when: c.applies_when } : {}),
      ...(c.over ? { over: c.over } : {}),
      ...(c.item_when ? { item_when: c.item_when } : {}),
      ...(c.binds ? { binds: c.binds } : {}),
      ...(c.result_severity ? { result_severity: c.result_severity } : {}),
      inputs: c.inputs,
      params: c.params,
      resolved_params: Object.fromEntries(c.params.map((p) => [p, params[p].value])),
      relations: c.relations,
      issues: c.issues,
      evidence: c.evidence.map((e) => ({ passageId: e.passageId, quote: e.quote })),
      machineEvaluable: !!c.machineEvaluable,
      tests: c.tests ?? [],
    };
    return { ...card, card_fingerprint: token(card) };
  });

  const bundle = {
    schema: BUNDLE_SCHEMA,
    policy: {
      id: map.policy.id,
      version: map.policy.version,
      effectiveFrom: map.policy.effectiveFrom,
      ...(effectiveTo ?? map.policy.effectiveTo ? { effectiveTo: effectiveTo ?? map.policy.effectiveTo } : {}),
      ...(supersedes ?? map.policy.supersedes ? { supersedes: supersedes ?? map.policy.supersedes } : {}),
    },
    parameters: Object.fromEntries(Object.entries(params).map(([id, p]) => [id, { value: p.value, unit: p.unit, ...(p.illustrative ? { illustrative: true } : {}) }])),
    inputs: entries(map.inputs),
    issues,
    cards: out,
  };
  return { ...bundle, bundle_hash: fullHash(bundle) };
}

/** Build from a directory holding passages.json, map.json and cards.json. */
export async function buildBundleFromDir(dir, opts) {
  const load = async (f) => JSON.parse(await readFile(join(dir, f), "utf8"));
  const [passages, map, { cards }] = await Promise.all([load("passages.json"), load("map.json"), load("cards.json")]);
  return buildBundle({ passages, map, cards }, opts);
}

/** Recompute a bundle's hash; a mismatch means it was edited after it was built. */
export function verifyBundle(bundle) {
  const { bundle_hash, ...rest } = bundle;
  if (bundle.schema !== BUNDLE_SCHEMA) throw new Error(`not a ${BUNDLE_SCHEMA} bundle`);
  if (fullHash(rest) !== bundle_hash) throw new Error(`bundle ${bundle.policy?.id}@${bundle.policy?.version} does not match its hash; rebuild it`);
  for (const c of bundle.cards) {
    const { card_fingerprint, ...card } = c;
    if (token(card) !== card_fingerprint) throw new Error(`card ${c.slot} in ${bundle.policy.id}@${bundle.policy.version} does not match its fingerprint`);
  }
  return bundle;
}
