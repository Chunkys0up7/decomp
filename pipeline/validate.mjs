// Pass 4 — Deterministic validation of a policy map and its cards.
//
// Usage: node pipeline/validate.mjs <example> [--dir golden]
// Reads <dir>/<example>/passages.json (Pass 0 output), map.json (Pass 1) and cards.json (Pass 2).
// Exits 1 if any error is found. Warnings never fail the run.

import { readFile } from "node:fs/promises";

const example = process.argv[2];
const dir = process.argv.includes("--dir") ? process.argv[process.argv.indexOf("--dir") + 1] : "golden";
if (!example) { console.error("Usage: node pipeline/validate.mjs <example> [--dir golden]"); process.exit(1); }

const load = async (f) => JSON.parse(await readFile(f, "utf8"));
const src = await load(`${dir}/${example}/passages.json`);
const map = await load(`${dir}/${example}/map.json`);
const { cards } = await load(`${dir}/${example}/cards.json`);

const errors = [];
const warnings = [];
const err = (code, msg) => errors.push(`${code} ${msg}`);
const warn = (code, msg) => warnings.push(`${code} ${msg}`);

const passages = new Map(src.passages.map((p) => [p.id, p]));
const slots = new Map(map.slots.map((s) => [s.slot, s]));
const params = Object.fromEntries(Object.entries(map.parameters).filter(([k]) => !k.startsWith("$")));
const P = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, v.value]));
const inputs = new Set(Object.keys(map.inputs).filter((k) => !k.startsWith("$")));
const externals = new Set(Object.keys(map.externalRefs).filter((k) => !k.startsWith("$")));
const issues = new Set(map.issues.map((i) => i.id));
const coverageStates = Object.fromEntries(Object.entries(map.coverage).filter(([k]) => !k.startsWith("$")));
const placeholders = (s) => [...String(s).matchAll(/\{\{([A-Z0-9_]+)\}\}/g)].map((m) => m[1]);

// ---------- map checks ----------

// M1 coverage: every normative/definitional passage is planned into a slot or given a state.
const inSlot = new Set(map.slots.flatMap((s) => s.passages));
const denominator = src.passages.filter((p) => p.kind === "normative" || p.kind === "definitional");
for (const p of denominator) {
  if (!inSlot.has(p.id) && !coverageStates[p.id]) err("M1", `${p.id} (${p.ref}) is normative but has no slot or coverage state: "${p.text.slice(0, 70)}..."`);
}
// Non-denominator passages assigned to slots are fine (e.g. references kept as lineage), but flag unassigned leftovers.
for (const p of src.passages) {
  if (!inSlot.has(p.id) && !coverageStates[p.id] && !denominator.includes(p)) warn("M1b", `${p.id} (${p.kind}) is not assigned anywhere: "${p.text.slice(0, 60)}..."`);
}

// M2 slot references resolve.
for (const s of map.slots) {
  for (const id of s.passages) if (!passages.has(id)) err("M2", `slot ${s.slot} cites unknown passage ${id}`);
  for (const r of s.externalRefs ?? []) if (!externals.has(r)) err("M2", `slot ${s.slot} cites unregistered external ref ${r}`);
  for (const i of s.issues ?? []) if (!issues.has(i)) err("M2", `slot ${s.slot} cites unknown issue ${i}`);
  for (const ph of placeholders(s.title)) if (!(ph in params)) err("M2", `slot ${s.slot} title uses unknown parameter {{${ph}}}`);
}

// M3 parameter grounding: the stated value must literally appear in every passage it cites.
const renderings = (v, unit) => {
  if (unit === "ratio" || /fraction/.test(unit)) { const pct = +(v * 100).toFixed(2); return [`${pct}%`]; }
  return [String(v)];
};
for (const [id, prm] of Object.entries(params)) {
  for (const pid of prm.passages) {
    const p = passages.get(pid);
    if (!p) { err("M3", `parameter ${id} cites unknown passage ${pid}`); continue; }
    const forms = renderings(prm.value, prm.unit);
    if (!forms.some((f) => p.text.includes(f))) err("M3", `parameter ${id}=${forms[0]} not found in ${pid}: "${p.text.slice(0, 70)}..."`);
  }
}

// M4 issues cite real passages.
for (const i of map.issues) for (const pid of i.passages) if (!passages.has(pid)) err("M4", `issue ${i.id} cites unknown passage ${pid}`);

// ---------- card checks ----------

const REQUIRED = {
  fact: ["statement"],
  rule: ["when", "then"],
  calculation: ["applies_when", "inputs", "formula", "output"],
  procedure: ["trigger", "step_1", "done_when"],
};
const close = (a, b) => (typeof a === "number" && typeof b === "number" ? Math.abs(a - b) < 1e-4 : a === b);
const sourceSpans = [];

for (const c of cards) {
  const tag = `[${c.slot}]`;
  const slot = slots.get(c.slot);
  if (!slot) { err("C1", `${tag} has no slot in the map`); continue; }
  if (slot.type !== c.type) err("C1", `${tag} type ${c.type} differs from map slot type ${slot.type}`);

  // C2 evidence is verbatim; C3 lineage stays inside the slot's planned passages.
  if (!c.evidence?.length) err("C2", `${tag} has no evidence`);
  for (const e of c.evidence ?? []) {
    const p = passages.get(e.passageId);
    if (!p) { err("C2", `${tag} evidence cites unknown passage ${e.passageId}`); continue; }
    const start = p.text.indexOf(e.quote);
    if (start < 0) err("C2", `${tag} quote not found verbatim in ${e.passageId}: "${e.quote.slice(0, 60)}..."`);
    else sourceSpans.push({ passageId: p.id, start, end: start + e.quote.length });
    if (!slot.passages.includes(e.passageId)) warn("C3", `${tag} cites ${e.passageId}, outside its planned slot passages`);
  }

  // C4 required fields per type.
  const keys = new Set(c.fields.map((f) => f.key));
  for (const k of REQUIRED[c.type]) if (!keys.has(k)) err("C4", `${tag} ${c.type} card is missing field "${k}"`);

  // C5 parameters: every placeholder declared and registered; every declared one used.
  const used = new Set([c.title, ...c.fields.map((f) => f.value)].flatMap(placeholders));
  for (const ph of used) {
    if (!(ph in params)) err("C5", `${tag} uses unknown parameter {{${ph}}}`);
    else if (!c.params.includes(ph)) err("C5", `${tag} uses {{${ph}}} but does not declare it in params`);
  }
  for (const ph of c.params) if (!used.has(ph) && !(c.expr ?? "").includes(`P.${ph}`)) warn("C5", `${tag} declares ${ph} but never uses it`);
  // A literal policy number in card text instead of a parameter is drift waiting to happen.
  for (const f of c.fields) {
    for (const [id, prm] of Object.entries(params)) {
      if (prm.illustrative) continue;
      for (const form of renderings(prm.value, prm.unit)) {
        if (form.length > 1 && new RegExp(`(^|[^\\d.])${form.replace(/[.%]/g, "\\$&")}`).test(f.value)) warn("C5b", `${tag} field ${f.key} hard-codes ${form}; use {{${id}}}`);
      }
    }
  }

  // C6 inputs come from the map vocabulary.
  for (const i of c.inputs) if (!inputs.has(i)) err("C6", `${tag} uses unregistered input ${i}`);

  // C7 relations and C8 issues resolve.
  for (const r of c.relations) {
    if (r.slot && !slots.has(r.slot)) err("C7", `${tag} relation ${r.kind} -> unknown slot ${r.slot}`);
    if (r.external && !externals.has(r.external)) err("C7", `${tag} relation ${r.kind} -> unregistered external ${r.external}`);
  }
  for (const i of c.issues) if (!issues.has(i)) err("C8", `${tag} cites unknown issue ${i}`);

  // C9 evaluability: rules and calculations an agent will execute must carry logic and passing tests.
  if ((c.type === "rule" || c.type === "calculation") && c.machineEvaluable) {
    if (!c.expr) err("C9", `${tag} is machine-evaluable but has no expr`);
    if (!c.tests?.length) err("C9", `${tag} is machine-evaluable but has no tests`);
  }
  if (c.expr) {
    const fn = new Function("i", "P", `return (${c.expr});`);
    c.tests.forEach((t, n) => {
      let got;
      try { got = fn(t.given, P); } catch (e) { err("C9", `${tag} test ${n + 1} threw: ${e.message}`); return; }
      if (!close(got, t.expect)) err("C9", `${tag} test ${n + 1}: expected ${JSON.stringify(t.expect)}, got ${JSON.stringify(got)}`);
    });
  }
}

// ---------- report ----------

const slotsWithCards = new Set(cards.map((c) => c.slot));
const passagesCited = new Set(cards.flatMap((c) => c.evidence.map((e) => e.passageId)));
const covered = denominator.filter((p) => passagesCited.has(p.id) || coverageStates[p.id]);
const tests = cards.reduce((n, c) => n + (c.tests?.length ?? 0), 0);

console.log(`${src.source ?? example} — ${src.passages.length} passages, ${denominator.length} in coverage denominator`);
console.log(`Map:   ${map.slots.length} slots, ${Object.keys(params).length} parameters, ${inputs.size} inputs, ${externals.size} external refs, ${issues.size} issues`);
console.log(`Cards: ${cards.length} authored (${slotsWithCards.size}/${map.slots.length} slots), ${tests} test cases`);
console.log(`Coverage by cards: ${covered.length}/${denominator.length} normative passages (${Math.round((100 * covered.length) / denominator.length)}%)`);
for (const w of warnings) console.log(`  warn  ${w}`);
for (const e of errors) console.log(`  ERROR ${e}`);
console.log(errors.length ? `FAIL: ${errors.length} error(s), ${warnings.length} warning(s)` : `PASS with ${warnings.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
