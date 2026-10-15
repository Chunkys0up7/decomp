// Version selection (R4): which bundle governs a loan. The latest version in force on the loan's
// as-of date, unless the lender has adopted a specific version early. Fails closed.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { verifyBundle } from "./bundle.mjs";

export const AS_OF_RULES = ["note_date", "application_date"];

/** Load every `*.bundle.json` in a directory, verifying each hash. */
export function loadLibrary(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".bundle.json"))
    .sort()
    .map((f) => verifyBundle(JSON.parse(readFileSync(join(dir, f), "utf8"))));
}

const cmpVersion = (a, b) => {
  const pa = String(a).split(/[.-]/), pb = String(b).split(/[.-]/);
  for (let n = 0; n < Math.max(pa.length, pb.length); n++) {
    const x = pa[n] ?? "", y = pb[n] ?? "";
    const d = /^\d+$/.test(x) && /^\d+$/.test(y) ? +x - +y : x.localeCompare(y);
    if (d) return d;
  }
  return 0;
};

/** Parse `POL-ID@version` adoption flags. */
export const parseAdopt = (list = []) => list.map((s) => {
  const at = s.lastIndexOf("@");
  if (at <= 0) throw new Error(`--adopt expects POLICY@VERSION, got ${s}`);
  return { policy: s.slice(0, at), version: s.slice(at + 1) };
});

/**
 * Choose the bundle for one policy. Returns `{ bundle, selection }`; `bundle` is null when no
 * version is in force. `selection` is recorded in the decision.
 */
export function selectBundle(library, policyId, loan, { asOfRule = "note_date", adopt = [] } = {}) {
  if (!AS_OF_RULES.includes(asOfRule)) throw new Error(`as-of rule must be one of ${AS_OF_RULES.join(", ")}`);
  const fallback = AS_OF_RULES.find((r) => r !== asOfRule);
  const rule = loan.as_of?.[asOfRule] ? asOfRule : loan.as_of?.[fallback] ? fallback : null;
  const asOf = rule ? loan.as_of[rule] : null;
  const versions = library.filter((b) => b.policy.id === policyId)
    .sort((a, b) => a.policy.effectiveFrom.localeCompare(b.policy.effectiveFrom) || cmpVersion(a.policy.version, b.policy.version));
  const considered = versions.map((b) => ({ version: b.policy.version, effectiveFrom: b.policy.effectiveFrom, ...(b.policy.effectiveTo ? { effectiveTo: b.policy.effectiveTo } : {}) }));
  const base = { policy: policyId, rule, as_of: asOf, considered };

  const wanted = adopt.find((a) => a.policy === policyId);
  if (wanted) {
    const b = versions.find((v) => v.policy.version === wanted.version);
    if (!b) return { bundle: null, selection: { ...base, adopted: true, reason: `adopted version ${wanted.version} is not in the library` } };
    const early = asOf && b.policy.effectiveFrom > asOf;
    return { bundle: b, selection: { ...base, adopted: true, version: b.policy.version, reason: early ? `adopted early: version ${b.policy.version} is effective ${b.policy.effectiveFrom}, after the as-of date ${asOf}` : `adopted version ${b.policy.version}` } };
  }

  if (!asOf) return { bundle: null, selection: { ...base, adopted: false, reason: "the loan file has no note date or application date" } };
  const inForce = versions.filter((b) => b.policy.effectiveFrom <= asOf && (!b.policy.effectiveTo || asOf <= b.policy.effectiveTo));
  const b = inForce[inForce.length - 1];
  if (!b) return { bundle: null, selection: { ...base, adopted: false, reason: `no version of ${policyId} is in force on ${asOf}` } };
  return { bundle: b, selection: { ...base, adopted: false, version: b.policy.version, reason: `version ${b.policy.version} is in force on ${asOf} (effective ${b.policy.effectiveFrom})` } };
}

/** Policies present in a library, in name order. */
export const policies = (library) => [...new Set(library.map((b) => b.policy.id))].sort();
