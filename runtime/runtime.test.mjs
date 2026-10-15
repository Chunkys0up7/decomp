// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validateSet } from "../pipeline/checks.mjs";
import { references, run } from "./expr.mjs";
import { buildBundle, buildBundleFromDir, checkLoan, decide, evaluate, explain, loadLibrary, parseAdopt, readReceipts, receiptsFile, selectBundle, verifyBundle } from "./index.mjs";

const read = (f) => JSON.parse(readFileSync(f, "utf8"));
const GOLDEN = "golden/sample-hl0142";
const V32 = "runtime/fixtures/sources/sample-hl0142-v3.2";
const LIB = "runtime/fixtures/library";
const source = (dir) => ({ passages: read(`${dir}/passages.json`), map: read(`${dir}/map.json`), cards: read(`${dir}/cards.json`).cards });
const loan = (id) => read(`runtime/fixtures/loans/${id}.json`);
const clone = (v) => JSON.parse(JSON.stringify(v));

// A synthetic card set exercising over / item_when / binds across a collection.
function liabilitySet() {
  const passages = { source: "synthetic", passages: [
    { id: "p1", ref: "1", kind: "normative", text: "Installment debts with more than 10 payments remaining are included." },
    { id: "p2", ref: "2", kind: "normative", text: "Revolving accounts use 5% of the balance when no payment is reported." },
    { id: "p3", ref: "3", kind: "definitional", text: "DTI is housing expense plus included payments, divided by income." },
    { id: "p4", ref: "4", kind: "normative", text: "A DTI above 45% is ineligible." },
  ] };
  const map = {
    policy: { id: "SYN-1", version: "1", effectiveFrom: "2026-01-01" },
    parameters: {
      MONTHS: { value: 10, unit: "months", passages: ["p1"] },
      REV: { value: 0.05, unit: "fraction of balance", passages: ["p2"] },
      MAX: { value: 0.45, unit: "ratio", passages: ["p4"] },
    },
    inputs: {
      liabilities: { type: "collection" },
      "liability.type": { type: "enum", values: ["installment", "revolving"] },
      "liability.months_remaining": { type: "integer" },
      "liability.balance": { type: "money" },
      "liability.reported_payment": { type: "money/month", optional: true },
      "liability.qualifying_payment": { type: "money/month" },
      "borrower.housing": { type: "money/month" },
      "borrower.income": { type: "money/month" },
      "loan.dti": { type: "ratio" },
    },
    externalRefs: {},
    slots: [
      { slot: "installment", type: "rule", title: "Installment", passages: ["p1"] },
      { slot: "revolving", type: "rule", title: "Revolving", passages: ["p2"] },
      { slot: "dti", type: "calculation", title: "DTI", passages: ["p3"] },
      { slot: "dti-max", type: "rule", title: "DTI max {{MAX}}", passages: ["p4"] },
    ],
    coverage: {},
    issues: [{ id: "ISS-1", severity: "warning", kind: "ambiguous", passages: ["p3"], title: "Income definition is referenced elsewhere" }],
  };
  const f = (keys) => keys.map((k) => ({ key: k, label: k, value: "x" }));
  const cards = [
    { slot: "installment", type: "rule", title: "Installment", fields: f(["when", "then"]), over: "liabilities", item_when: "i.liability.type === 'installment'", binds: "liability.qualifying_payment",
      expr: "i.liability.months_remaining > P.MONTHS ? i.liability.reported_payment : 0",
      evidence: [{ passageId: "p1", quote: "more than 10 payments remaining are included" }], inputs: ["liability.months_remaining", "liability.reported_payment"], params: ["MONTHS"], relations: [], issues: [], machineEvaluable: true,
      tests: [{ given: { liability: { months_remaining: 12, reported_payment: 300 } }, expect: 300 }, { given: { liability: { months_remaining: 8, reported_payment: 300 } }, expect: 0 }] },
    { slot: "revolving", type: "rule", title: "Revolving", fields: f(["when", "then"]), over: "liabilities", item_when: "i.liability.type === 'revolving'", binds: "liability.qualifying_payment",
      expr: "i.liability.reported_payment ?? P.REV * i.liability.balance",
      evidence: [{ passageId: "p2", quote: "Revolving accounts use 5% of the balance" }], inputs: ["liability.reported_payment", "liability.balance"], params: ["REV"], relations: [], issues: [], machineEvaluable: true,
      tests: [{ given: { liability: { balance: 2000 } }, expect: 100 }] },
    { slot: "dti", type: "calculation", title: "DTI", fields: f(["applies_when", "inputs", "formula", "output"]), binds: "loan.dti",
      expr: "(i.borrower.housing + i.liabilities.reduce((s, x) => s + x.qualifying_payment, 0)) / i.borrower.income",
      evidence: [{ passageId: "p3", quote: "DTI is housing expense plus included payments, divided by income." }], inputs: ["borrower.housing", "liabilities", "borrower.income"], params: [], relations: [], issues: ["ISS-1"], machineEvaluable: true,
      tests: [{ given: { borrower: { housing: 1000, income: 4000 }, liabilities: [{ qualifying_payment: 200 }] }, expect: 0.3 }] },
    { slot: "dti-max", type: "rule", title: "DTI max {{MAX}}", fields: f(["when", "then"]), result_severity: { pass: "pass", ineligible: "fail" },
      expr: "i.loan.dti > P.MAX ? 'ineligible' : 'pass'",
      evidence: [{ passageId: "p4", quote: "A DTI above 45% is ineligible." }], inputs: ["loan.dti"], params: ["MAX"], relations: [{ kind: "depends_on", slot: "dti" }], issues: [], machineEvaluable: true,
      tests: [{ given: { loan: { dti: 0.5 } }, expect: "ineligible" }, { given: { loan: { dti: 0.4 } }, expect: "pass" }] },
  ];
  return { passages, map, cards };
}
const synLoan = (over = {}) => ({
  schema: "loan-file/1.0", loan_id: "S-1", as_of: { note_date: "2026-02-01" },
  facts: { borrower: { housing: 1500, income: 6000 } },
  collections: { liabilities: [
    { type: "installment", months_remaining: 30, reported_payment: 400, balance: 9000 },
    { type: "installment", months_remaining: 6, reported_payment: 250, balance: 1500 },
    { type: "revolving", balance: 3000 },
  ] },
  ...over,
});

describe("expression references (C10 extractor)", () => {
  it("finds input paths, parameters and drops trailing methods", () => {
    const r = references("(i.a.b + i.list.reduce((s, x) => s + x.v, 0)) / P.MAX");
    expect(r.paths.sort()).toEqual(["a.b", "list"]);
    expect(r.params).toEqual(["MAX"]);
    expect(r.disallowed).toEqual([]);
  });
  it("flags identifiers and members outside the allow-list", () => {
    expect(references("process.exit(1) || i.a.constructor").disallowed).toEqual(expect.arrayContaining(["process", ".exit"]));
    expect(references("globalThis.fetch").disallowed).toEqual(expect.arrayContaining(["globalThis", ".fetch"]));
  });
  it("allows object-literal keys and block-bodied arrows with locals", () => {
    expect(references("({ a: P.X, b: P.Y })[i.t.kind]").disallowed).toEqual([]);
    expect(references("(() => { const c = i.a.b ?? 0; return Math.max(c, 1); })()").disallowed).toEqual([]);
  });
});

describe("sandbox", () => {
  it("evaluates with inputs and parameters", () => expect(run("i.a.b / P.X", { a: { b: 10 } }, { X: 4 })).toBe(2.5));
  it("blocks code generation from strings", () => {
    expect(() => run("eval('1')", {}, {})).toThrow(/Code generation/);
    expect(() => run("(() => {}).constructor('return 1')()", {}, {})).toThrow(/Code generation/);
  });
  it("stops a runaway expression", () => expect(() => run("(() => { for (;;) {} })()", {}, {})).toThrow(/timed out/));
});

describe("validator C10-C12", () => {
  const base = () => source(GOLDEN);
  const codes = (set) => validateSet(set).errors.map((e) => e.split(" ")[0]);
  const card = (set, slot) => set.cards.find((c) => c.slot === slot);

  it("passes the golden sample and the v3.2 fixture", () => {
    expect(validateSet(base()).errors).toEqual([]);
    expect(validateSet(source(V32)).errors).toEqual([]);
    expect(validateSet(liabilitySet()).errors).toEqual([]);
  });
  it("C10: an expr reading an undeclared input", () => {
    const s = base(); card(s, "dti-ratio").expr = "i.borrower.monthly_obligations / i.borrower.qualifying_income + (i.loan.lien === 'x' ? 1 : 0)";
    expect(codes(s)).toContain("C10");
  });
  it("C10: a disallowed identifier", () => {
    const s = base(); card(s, "dti-ratio").applies_when = "globalThis.x || i.loan.in_scope";
    expect(codes(s)).toContain("C10");
  });
  it("C10: an undeclared parameter", () => {
    const s = base(); card(s, "dti-ratio").expr = "i.borrower.monthly_obligations / i.borrower.qualifying_income * P.DTI_MAX";
    expect(codes(s)).toContain("C10");
  });
  it("C11: an unregistered bind and a double bind", () => {
    const s = base(); card(s, "dti-ratio").binds = "loan.nowhere";
    expect(codes(s)).toContain("C11");
    const t = base(); card(t, "dti-max").binds = "loan.dti_ratio";
    expect(validateSet(t).errors.join("\n")).toMatch(/bound by both/);
  });
  it("C11: a binds/reads cycle, and a card reading its own bind", () => {
    const s = base(); card(s, "scope").applies_when = "i.loan.dti_ratio >= 0";
    expect(validateSet(s).errors.join("\n")).toMatch(/cycle among: dti-ratio, scope/);
    const t = base(); card(t, "dti-ratio").applies_when = "i.loan.in_scope && i.loan.dti_ratio >= 0";
    expect(validateSet(t).errors.join("\n")).toMatch(/reads loan.dti_ratio, the path it binds/);
  });
  it("C11: an unknown severity", () => {
    const s = base(); card(s, "dti-max").result_severity = { within_limit: "great" };
    expect(codes(s)).toContain("C11");
  });
  it("C12: a test input of the wrong type or outside its enum", () => {
    const s = base(); card(s, "scope").tests[0].given.loan.type = "subprime";
    expect(codes(s)).toContain("C12");
    const t = base(); card(t, "dti-ratio").tests[0].given.borrower.qualifying_income = "6000";
    expect(codes(t)).toContain("C12");
  });
});

describe("bundles", () => {
  it("are deterministic and verify", async () => {
    const a = await buildBundleFromDir(GOLDEN);
    const b = await buildBundleFromDir(GOLDEN);
    expect(a.bundle_hash).toBe(b.bundle_hash);
    expect(() => verifyBundle(a)).not.toThrow();
  });
  it("match the committed fixture library", async () => {
    expect((await buildBundleFromDir(GOLDEN)).bundle_hash).toBe(read(`${LIB}/pol-hl-0142-3.1.bundle.json`).bundle_hash);
    expect((await buildBundleFromDir(V32)).bundle_hash).toBe(read(`${LIB}/pol-hl-0142-3.2.bundle.json`).bundle_hash);
  });
  it("move a card's fingerprint when only a parameter value changes", async () => {
    const v31 = await buildBundleFromDir(GOLDEN);
    const s = source(GOLDEN);
    s.map.parameters.DTI_MAX_WITH_FACTORS.value = 0.5; // unchanged control
    const same = buildBundle(s);
    const fp = (b, slot) => b.cards.find((c) => c.slot === slot).card_fingerprint;
    expect(fp(same, "dti-max")).toBe(fp(v31, "dti-max"));
    const v32 = await buildBundleFromDir(V32);
    expect(fp(v32, "dti-max")).not.toBe(fp(v31, "dti-max"));
    expect(fp(v32, "dti-ratio")).toBe(fp(v31, "dti-ratio"));
  });
  it("refuse an invalid card set", () => {
    const s = source(GOLDEN); s.cards[0].evidence[0].quote = "paraphrased";
    expect(() => buildBundle(s)).toThrow(/failed validation/);
  });
  it("detect tampering", async () => {
    const b = await buildBundleFromDir(GOLDEN);
    const t = clone(b); t.parameters.DTI_MAX.value = 0.6;
    expect(() => verifyBundle(t)).toThrow(/hash/);
  });
});

describe("evaluation", () => {
  const lib = () => loadLibrary(LIB);
  const v31 = () => lib().find((b) => b.policy.version === "3.1");

  it("chains binds in dependency order and records lineage", () => {
    const d = evaluate(v31(), loan("L-2001"));
    expect(d.steps.map((s) => s.slot)).toEqual(["scope", "variable-income-calc", "dti-ratio", "dti-max", "dti-above-max"]);
    const ratio = d.steps.find((s) => s.slot === "dti-ratio");
    expect(ratio.result).toBeCloseTo(0.44);
    expect(ratio.evidence).toEqual(["p6"]);
    expect(d.steps.find((s) => s.slot === "dti-max").inputs_used["loan.dti_ratio"]).toBeCloseTo(0.44);
    expect(d.outcome).toBe("pass");
  });
  it("is deterministic", () => {
    expect(evaluate(v31(), loan("L-2001")).decision_hash).toBe(evaluate(v31(), loan("L-2001")).decision_hash);
  });
  it("needs input instead of defaulting, and reports only the root cause", () => {
    const d = evaluate(v31(), loan("L-2003"));
    expect(d.outcome).toBe("incomplete");
    expect(d.outstanding).toEqual([{ slot: "dti-ratio", status: "needs_input", missing: "borrower.qualifying_income" }]);
    expect(d.steps.find((s) => s.slot === "dti-max")).toMatchObject({ status: "needs_input", blocked_by: "dti-ratio" });
  });
  it("marks out-of-scope loans not applicable", () => expect(evaluate(v31(), loan("L-2004")).outcome).toBe("not_applicable"));
  it("refers procedures to a person as a condition and lists assumptions", () => {
    const d = evaluate(lib().find((b) => b.policy.version === "3.2"), loan("L-2002"));
    expect(d.outcome).toBe("condition");
    expect(d.steps.find((s) => s.slot === "dti-above-max")).toMatchObject({ status: "refer_to_person", reason: "procedure" });
    expect(d.steps.find((s) => s.slot === "dti-max").assumptions).toEqual(["ISS-04"]);
    expect(d.steps.find((s) => s.slot === "variable-income-calc").result).toBe(800);
  });
  it("refers a card with an open blocking issue", () => {
    const s = source(GOLDEN);
    s.map.issues.find((i) => i.id === "ISS-04").severity = "error";
    const d = evaluate(buildBundle(s), loan("L-2001"));
    expect(d.steps.find((x) => x.slot === "dti-max")).toMatchObject({ status: "refer_to_person", reason: "blocking_issue" });
    expect(d.outcome).toBe("incomplete");
  });
  it("records a discrepancy when the file's value differs from the computed one", () => {
    const l = loan("L-2001"); l.facts.loan.dti_ratio = 0.41;
    const step = evaluate(v31(), l).steps.find((s) => s.slot === "dti-ratio");
    expect(step.discrepancy).toMatchObject({ path: "loan.dti_ratio", supplied: 0.41 });
  });
  it("runs over collections with item filters and aggregates bound item values", () => {
    const b = buildBundle(liabilitySet());
    const d = evaluate(b, synLoan());
    const items = d.steps.filter((s) => s.slot === "installment" || s.slot === "revolving").map((s) => [s.slot, s.item, s.result]);
    expect(items).toEqual([["installment", 0, 400], ["installment", 1, 0], ["revolving", 2, 150]]);
    expect(d.steps.find((s) => s.slot === "dti").result).toBeCloseTo((1500 + 550) / 6000);
    expect(d.steps.find((s) => s.slot === "dti").assumptions).toEqual(["ISS-1"]);
    expect(d.outcome).toBe("pass");
  });
  it("names the missing item field and blocks the aggregate", () => {
    const l = synLoan(); delete l.collections.liabilities[0].months_remaining;
    const d = evaluate(buildBundle(liabilitySet()), l);
    expect(d.outstanding).toEqual([{ slot: "installment", item: 0, status: "needs_input", missing: "liabilities[0].months_remaining" }]);
    expect(d.steps.find((s) => s.slot === "dti")).toMatchObject({ status: "needs_input", blocked_by: "installment" });
  });
  it("rejects an item that two per-item cards both claim", () => {
    const s = liabilitySet(); s.cards[1].item_when = "i.liability.type !== 'nothing'";
    const d = evaluate(buildBundle(s), synLoan());
    expect(d.steps.find((x) => x.slot === "revolving" && x.item === 0)).toMatchObject({ status: "error" });
    expect(d.outcome).toBe("incomplete");
  });
  it("needs the collection itself when it is absent", () => {
    const l = synLoan(); delete l.collections;
    expect(evaluate(buildBundle(liabilitySet()), l).outstanding.map((o) => o.missing)).toContain("liabilities");
  });
  it("turns a throwing expression into an error step", () => {
    const s = liabilitySet();
    s.cards[2].expr = "(i.borrower.housing + i.liabilities.reduce((s, x) => s + x.qualifying_payment, 0)) / i.borrower.income";
    const l = synLoan(); l.facts.borrower.income = 0;
    const d = evaluate(buildBundle(s), l);
    expect(d.steps.find((x) => x.slot === "dti")).toMatchObject({ status: "error" });
    expect(d.outcome).toBe("incomplete");
  });
  it("ranks outcomes: fail over incomplete over condition over pass", () => {
    expect(decide([{ severity: "fail" }, { status: "needs_input" }])).toBe("fail");
    expect(decide([{ severity: "condition" }, { status: "error" }])).toBe("incomplete");
    expect(decide([{ severity: "pass" }, { status: "refer_to_person", reason: "procedure", severity: "condition" }])).toBe("condition");
    expect(decide([{ severity: "info" }])).toBe("not_applicable");
  });
});

describe("version selection", () => {
  const lib = loadLibrary(LIB);
  const pick = (note, opts) => selectBundle(lib, "POL-HL-0142", { as_of: { note_date: note } }, opts);
  it("chooses the latest version in force on the as-of date", () => {
    expect(pick("2026-06-30").bundle.policy.version).toBe("3.1");
    expect(pick("2026-07-01").bundle.policy.version).toBe("3.2");
    expect(pick("2027-01-01").bundle.policy.version).toBe("3.2");
  });
  it("fails closed before the first version", () => {
    const r = pick("2025-12-31");
    expect(r.bundle).toBeNull();
    expect(r.selection.reason).toMatch(/no version/);
  });
  it("adopts a future version early when the lender says so", () => {
    const r = pick("2026-03-01", { adopt: parseAdopt(["POL-HL-0142@3.2"]) });
    expect(r.bundle.policy.version).toBe("3.2");
    expect(r.selection).toMatchObject({ adopted: true });
    expect(r.selection.reason).toMatch(/adopted early/);
  });
  it("falls back to the application date and records the rule", () => {
    const r = selectBundle(lib, "POL-HL-0142", { as_of: { application_date: "2026-08-01" } });
    expect(r.selection).toMatchObject({ rule: "application_date", version: "3.2" });
  });
  it("same loan, two versions, two outcomes", () => {
    const l = loan("L-2001");
    const [cur] = checkLoan(lib, l);
    const [early] = checkLoan(lib, l, { adopt: parseAdopt(["POL-HL-0142@3.2"]) });
    expect([cur.decision.outcome, early.decision.outcome]).toEqual(["pass", "fail"]);
  });
  it("returns no_policy_in_force rather than guessing", () => {
    const l = loan("L-2001"); l.as_of.note_date = "2025-01-01";
    expect(checkLoan(lib, l)[0].decision.outcome).toBe("no_policy_in_force");
  });
});

describe("receipts", () => {
  let store;
  afterEach(() => store && rmSync(store, { recursive: true, force: true }));
  it("render, then skip an unchanged re-check, then render again when the file changes", () => {
    store = mkdtempSync(join(tmpdir(), "pc-runtime-"));
    const lib = loadLibrary(LIB);
    const l = loan("L-2001");
    const a = checkLoan(lib, l, { store })[0];
    const b = checkLoan(lib, l, { store })[0];
    l.facts.borrower.monthly_obligations = 3000;
    const c = checkLoan(lib, l, { store })[0];
    const rs = readReceipts(receiptsFile(store, "L-2001"));
    expect(rs.map((r) => r.status)).toEqual(["rendered", "skipped", "rendered"]);
    expect(b.decision.decision_hash).toBe(a.decision.decision_hash);
    expect(rs[1].prev).toBe(rs[0].id);
    expect(rs[2].prev).toBe(rs[1].id);
    expect(rs[2].semantic_diff.outcome).toEqual(["pass", "fail"]);
    expect(c.decision.outcome).toBe("fail");
  });
  it("re-render when the lender adopts a new version", () => {
    store = mkdtempSync(join(tmpdir(), "pc-runtime-"));
    const lib = loadLibrary(LIB);
    checkLoan(lib, loan("L-2001"), { store });
    checkLoan(lib, loan("L-2001"), { store, adopt: parseAdopt(["POL-HL-0142@3.2"]) });
    const rs = readReceipts(receiptsFile(store, "L-2001"));
    expect(rs.map((r) => r.status)).toEqual(["rendered", "rendered"]);
    expect(rs[1].semantic_diff.version).toEqual(["3.1", "3.2"]);
  });
});

describe("explain", () => {
  it("cites cards, fingerprints, inputs and passages, without policy text unless asked", () => {
    const lib = loadLibrary(LIB);
    const [{ decision, bundle }] = checkLoan(lib, loan("L-2002"));
    const { text } = explain(decision, bundle);
    expect(text).toMatch(/Outcome: CONDITION/);
    expect(text).toMatch(/dti-max \(Maximum back-end DTI\) · card [0-9a-f]{12}/);
    expect(text).toMatch(/evidence: passages p5/);
    expect(text).toMatch(/assumes: ISS-04/);
    expect(text).not.toMatch(/Senior Underwriter\./);
    expect(explain(decision, bundle, { quotes: true }).text).toMatch(/p5: "/);
  });
});
