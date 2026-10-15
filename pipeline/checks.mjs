// Pass 4 — deterministic validation of a policy map and its cards, as a function.
// `pipeline/validate.mjs` is the CLI; the runtime bundle builder calls this before building.
import { references, run } from "../runtime/expr.mjs";

const REQUIRED = {
  fact: ["statement"],
  rule: ["when", "then"],
  calculation: ["applies_when", "inputs", "formula", "output"],
  procedure: ["trigger", "step_1", "done_when"],
};
const SEVERITIES = new Set(["pass", "condition", "fail", "info"]);
export const close = (a, b) => (typeof a === "number" && typeof b === "number" ? Math.abs(a - b) < 1e-4 : a === b);
export const placeholders = (s) => [...String(s).matchAll(/\{\{([A-Z0-9_]+)\}\}/g)].map((m) => m[1]);
export const entries = (o) => Object.fromEntries(Object.entries(o ?? {}).filter(([k]) => !k.startsWith("$")));
const renderings = (v, unit) => {
  if (unit === "ratio" || /fraction/.test(unit)) { const pct = +(v * 100).toFixed(2); return [`${pct}%`]; }
  return [String(v)];
};

/** Item variable for a collection path: `liabilities` -> `liability`. */
export const itemName = (collection) => {
  const last = collection.split(".").pop();
  return last.endsWith("ies") ? last.slice(0, -3) + "y" : last.endsWith("s") ? last.slice(0, -1) : last;
};

/** Every input path a card reads: declared inputs plus those in applies_when and item_when. */
export const cardReads = (c) => [...new Set([...(c.inputs ?? []), ...references(c.applies_when).paths, ...references(c.item_when).paths])];

/** Does a value match an input vocabulary type? */
export function typeMatches(spec, v) {
  const t = spec.type ?? "";
  if (t.endsWith("[]")) return Array.isArray(v) && v.every((x) => typeMatches({ ...spec, type: t.slice(0, -2) }, x));
  if (t === "collection") return Array.isArray(v);
  if (t === "enum") return (spec.values ?? []).includes(v);
  if (t === "boolean") return typeof v === "boolean";
  if (t === "date") return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
  if (t === "text") return typeof v === "string";
  if (/^(money|ratio|number|integer|months|days|count)/.test(t)) return typeof v === "number" && Number.isFinite(v) && (t !== "integer" || Number.isInteger(v));
  return true; // unknown types are not checked
}

/** Flatten a test's nested `given` to dotted paths, stopping at arrays and at registered paths. */
function flatten(obj, inputs, prefix = "") {
  const out = [];
  for (const [k, v] of Object.entries(obj ?? {})) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v) && !inputs[p]) out.push(...flatten(v, inputs, p));
    else out.push([p, v]);
  }
  return out;
}

export function validateSet({ passages: src, map, cards }) {
  const errors = [];
  const warnings = [];
  const err = (code, msg) => errors.push(`${code} ${msg}`);
  const warn = (code, msg) => warnings.push(`${code} ${msg}`);

  const passages = new Map(src.passages.map((p) => [p.id, p]));
  const slots = new Map(map.slots.map((s) => [s.slot, s]));
  const params = entries(map.parameters);
  const P = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, v.value]));
  const inputSpecs = entries(map.inputs);
  const inputs = new Set(Object.keys(inputSpecs));
  const externals = new Set(Object.keys(entries(map.externalRefs)));
  const issues = new Set(map.issues.map((i) => i.id));
  const coverageStates = entries(map.coverage);

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
    const exprText = [c.expr, c.applies_when, c.item_when].filter(Boolean).join(" ");
    for (const ph of c.params) if (!used.has(ph) && !exprText.includes(`P.${ph}`)) warn("C5", `${tag} declares ${ph} but never uses it`);
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
      c.tests.forEach((t, n) => {
        let got;
        try { got = run(c.expr, t.given, P); } catch (e) { err("C9", `${tag} test ${n + 1} threw: ${e.message}`); return; }
        if (!close(got, t.expect)) err("C9", `${tag} test ${n + 1}: expected ${JSON.stringify(t.expect)}, got ${JSON.stringify(got)}`);
      });
    }

    // C10 expressions read only declared inputs and parameters, through the allow-list.
    const item = c.over ? itemName(c.over) : null;
    for (const [field, text] of [["expr", c.expr], ["applies_when", c.applies_when], ["item_when", c.item_when]]) {
      if (!text) continue;
      const refs = references(text);
      for (const d of refs.disallowed) err("C10", `${tag} ${field} uses ${d}, which is not on the expression allow-list`);
      for (const p of refs.params) if (!(p in params)) err("C10", `${tag} ${field} reads unknown parameter P.${p}`);
      else if (!c.params.includes(p)) err("C10", `${tag} ${field} reads P.${p} but does not declare it in params`);
      for (const p of refs.paths) {
        if (field === "expr" && !c.inputs.includes(p)) err("C10", `${tag} expr reads i.${p}, which is not in its declared inputs`);
        else if (field !== "expr" && !inputs.has(p)) err("C10", `${tag} ${field} reads unregistered input i.${p}`);
        if (item && p.startsWith(`${item}.`) && !inputs.has(p)) err("C10", `${tag} reads item field i.${p}, which is not registered`);
      }
      // Fields read on a local (an item inside reduce/map/filter) must be registered on a collection the card reads.
      const collections = refs.paths.filter((p) => inputSpecs[p]?.type === "collection");
      for (const m of refs.members) {
        if (!collections.some((col) => inputs.has(`${itemName(col)}.${m}`))) err("C10", `${tag} ${field} reads .${m}, which is not a registered field of a collection it reads`);
      }
    }
    if (c.item_when && !c.over) err("C10", `${tag} has item_when but no over`);
    if (c.over && inputSpecs[c.over]?.type !== "collection") err("C10", `${tag} over ${c.over} is not a registered collection input`);

    // C11 binds: the target is registered and its type is not a collection.
    if (c.binds) {
      if (!inputs.has(c.binds)) err("C11", `${tag} binds unregistered input ${c.binds}`);
      if (cardReads(c).includes(c.binds)) err("C11", `${tag} reads ${c.binds}, the path it binds`);
      if (c.over && !c.binds.startsWith(`${item}.`)) err("C11", `${tag} runs over ${c.over} but binds ${c.binds}, outside the item ${item}`);
    }
    for (const [res, sev] of Object.entries(c.result_severity ?? {})) if (!SEVERITIES.has(sev)) err("C11", `${tag} result_severity ${res} -> ${sev} is not one of ${[...SEVERITIES].join(", ")}`);

    // C12 test inputs match the vocabulary types and enums.
    for (const [n, t] of (c.tests ?? []).entries()) {
      for (const [p, v] of flatten(t.given, inputSpecs)) {
        const spec = inputSpecs[p];
        if (!spec) { err("C12", `${tag} test ${n + 1} gives ${p}, which is not a registered input`); continue; }
        if (v !== null && !typeMatches(spec, v)) err("C12", `${tag} test ${n + 1} gives ${p}=${JSON.stringify(v)}, not a valid ${spec.type}${spec.values ? ` (${spec.values.join(", ")})` : ""}`);
      }
    }
  }

  // C11 graph: each path is bound by one card, and binds -> reads has no cycle. Per-item cards over
  // the same collection may share a bind when each filters its items (item_when); the runtime
  // rejects an item that two of them claim.
  const binders = new Map();
  for (const c of cards) if (c.binds) binders.set(c.binds, [...(binders.get(c.binds) ?? []), c]);
  for (const [path, cs] of binders) {
    if (cs.length < 2) continue;
    const shared = cs.every((c) => c.over && c.over === cs[0].over && c.item_when);
    if (!shared) err("C11", `${path} is bound by both ${cs.map((c) => c.slot).join(" and ")}; only per-item cards with item_when may share a bind`);
  }
  try { order(cards); } catch (e) { err("C11", e.message); }

  const slotsWithCards = new Set(cards.map((c) => c.slot));
  const passagesCited = new Set(cards.flatMap((c) => c.evidence.map((e) => e.passageId)));
  const covered = denominator.filter((p) => passagesCited.has(p.id) || coverageStates[p.id]);
  const summary = {
    source: src.source,
    passages: src.passages.length,
    denominator: denominator.length,
    slots: map.slots.length,
    parameters: Object.keys(params).length,
    inputs: inputs.size,
    externals: externals.size,
    issues: issues.size,
    cards: cards.length,
    slotsWithCards: slotsWithCards.size,
    tests: cards.reduce((n, c) => n + (c.tests?.length ?? 0), 0),
    covered: covered.length,
  };
  return { errors, warnings, summary, sourceSpans };
}

/**
 * Evaluation order (R3): card A follows card B when A reads a path B binds, or A reads the
 * collection B runs over. Ties keep the card set's own order. Throws on a cycle.
 */
export function order(cards) {
  const bySlot = new Map(cards.map((c) => [c.slot, c]));
  const pos = new Map(cards.map((c, n) => [c.slot, n]));
  const deps = new Map(cards.map((c) => [c.slot, new Set()]));
  for (const a of cards) {
    const reads = cardReads(a);
    for (const b of cards) {
      if (a === b) continue;
      const bindsItem = b.over && b.binds ? b.binds : null;
      if ((b.binds && !b.over && reads.includes(b.binds)) || (b.over && (reads.includes(b.over) || (bindsItem && a.over === b.over && reads.includes(bindsItem))))) deps.get(a.slot).add(b.slot);
    }
  }
  // A stated depends_on relation also orders the trace, so it reads the way the policy does, but
  // only where it agrees with the data dependencies: a relation never creates a cycle.
  const reaches = (from, to, seen = new Set()) => from === to || (!seen.has(from) && (seen.add(from), [...deps.get(from)].some((d) => reaches(d, to, seen))));
  for (const a of [...cards].sort((x, y) => x.slot.localeCompare(y.slot))) {
    for (const r of a.relations ?? []) {
      if (r.kind === "depends_on" && r.slot && bySlot.has(r.slot) && r.slot !== a.slot && !reaches(r.slot, a.slot)) deps.get(a.slot).add(r.slot);
    }
  }
  const out = [];
  const done = new Set();
  while (out.length < cards.length) {
    const ready = [...deps].filter(([s, d]) => !done.has(s) && [...d].every((x) => done.has(x))).map(([s]) => s).sort((x, y) => pos.get(x) - pos.get(y));
    if (!ready.length) {
      // Name only the cards on the cycle: drop stuck cards that no other stuck card waits on.
      let stuck = new Set([...deps.keys()].filter((s) => !done.has(s)));
      for (let changed = true; changed;) {
        changed = false;
        for (const s of stuck) if (![...stuck].some((t) => deps.get(t).has(s))) { stuck.delete(s); changed = true; }
      }
      throw new Error(`evaluation order has a cycle among: ${[...stuck].sort().join(", ")}`);
    }
    for (const s of ready) { out.push(bySlot.get(s)); done.add(s); }
  }
  return out;
}
