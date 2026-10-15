// OpenProse spike: the deterministic half of the VM for the policy-cards program.
//
// OpenProse splits work into an intelligent compile/render side and a "dumb" run side
// (skills/open-prose/concepts/reconciler.md in openprose/prose). This file is the dumb side:
// compile contracts into a topology, canonicalise + fingerprint facets, memo-check, write
// skipped/rendered/failed receipts, gate commits on the validator, and propagate only moved
// facets. Model renders (map changes, card rewrites) arrive as JSON files written by the agent
// session acting as the VM, which is how OpenProse runs (`prose run` is an in-session VM).
//
// Usage:
//   node spikes/openprose/vm.mjs compile --root <dir>
//   node spikes/openprose/vm.mjs wake --root <dir> --payload <passages.json> --label <text>
//        [--map-render <map.json>] [--card-renders <cards.json>]
import { createHash, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import canonicalize from "canonicalize";

const SRC = "spikes/openprose/src/policy-cards";
const args = process.argv.slice(2);
const cmd = args[0];
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const ROOT = opt("--root") ?? "local/poc/prose-root";

const read = (p) => JSON.parse(readFileSync(p, "utf8"));
const write = (p, v) => { mkdirSync(join(p, ".."), { recursive: true }); writeFileSync(p, typeof v === "string" ? v : JSON.stringify(v, null, 2) + "\n"); };
const sha = (s) => "sha256:" + createHash("sha256").update(s).digest("hex").slice(0, 16);
const token = (v) => sha(canonicalize(v ?? null));

// ---------- compile: contracts -> topology (a deterministic lowering of Requires/Maintains/Emits) ----------

function parseContract(file) {
  const text = readFileSync(join(SRC, file), "utf8").replace(/\r\n/g, "\n");
  const fm = Object.fromEntries([...text.matchAll(/^(\w+):\s*(.+)$/gm)].slice(0, 4).map((m) => [m[1], m[2].trim()]));
  const section = (name) => (text.split(`\n### ${name}\n`)[1] ?? "").split(/\n### /)[0];
  const bulletsNames = (s) => [...s.matchAll(/^- `([a-z0-9-]+)`/gm)].map((m) => m[1]);
  const facets = [...section("Maintains").matchAll(/^#### ([a-z0-9-]+)/gm)].map((m) => m[1]);
  return {
    name: fm.name, kind: fm.kind, file,
    contract_fingerprint: sha(text),
    requires: bulletsNames(section("Requires")),
    maintains: facets.length ? facets : bulletsNames(section("Maintains")),
    emits: [...section("Emits").matchAll(/^- ([a-z0-9-]+)/gm)].map((m) => m[1]),
  };
}

function compile() {
  const nodes = readdirSync(SRC).filter((f) => f.endsWith(".prose.md")).map(parseContract).filter((n) => n.kind !== "function");
  const producer = Object.fromEntries(nodes.flatMap((n) => n.maintains.map((f) => [f, n.name])));
  const edges = nodes.flatMap((n) => n.requires.map((facet) => ({ from: producer[facet], to: n.name, facet })));
  const missing = edges.filter((e) => !e.from);
  if (missing.length) throw new Error(`unwired Requires: ${missing.map((e) => `${e.to}.${e.facet}`).join(", ")}`);
  // Topological order (Kahn) over node-level edges.
  const order = []; const indeg = Object.fromEntries(nodes.map((n) => [n.name, 0]));
  for (const e of edges) indeg[e.to] += 1;
  const ready = nodes.filter((n) => indeg[n.name] === 0).map((n) => n.name);
  while (ready.length) { const n = ready.shift(); order.push(n); for (const e of edges.filter((x) => x.from === n)) if (--indeg[e.to] === 0) ready.push(e.to); }
  const manifest = { ir: "policy-cards-spike/0.1", nodes, edges, order };
  write(join(ROOT, "dist/manifest.active.json"), manifest);
  return manifest;
}

// ---------- ledger + world-model ----------

const nodeDir = (n) => join(ROOT, "state/world-model", n);
function lastReceipt(n) {
  const f = join(nodeDir(n), "receipts.jsonl");
  if (!existsSync(f)) return null;
  const lines = readFileSync(f, "utf8").trim().split("\n").filter(Boolean);
  return lines.length ? JSON.parse(lines.at(-1)) : null;
}
const lastGood = (n) => { const r = lastReceipt(n); return r && r.status === "failed" ? findLastCommitted(n) : r; };
function findLastCommitted(n) {
  const lines = readFileSync(join(nodeDir(n), "receipts.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  return [...lines].reverse().find((r) => r.status !== "failed") ?? null;
}
const published = (n, facet) => { const f = join(nodeDir(n), "published", `${facet}.json`); return existsSync(f) ? read(f) : undefined; };

function appendReceipt(run, node, receipt) {
  const prev = lastReceipt(node);
  const r = { node, ...receipt, prev: prev ? prev.id : null, sig: { signer: null } };
  r.id = sha(canonicalize(r));
  mkdirSync(nodeDir(node), { recursive: true });
  appendFileSync(join(nodeDir(node), "receipts.jsonl"), JSON.stringify(r) + "\n");
  appendFileSync(join(run.dir, "receipts", `${node}.jsonl`), JSON.stringify(r) + "\n");
  return r;
}

function commit(node, facets) {
  for (const [facet, value] of Object.entries(facets)) write(join(nodeDir(node), "published", `${facet}.json`), value);
  const fps = { "@atomic": token(facets), ...Object.fromEntries(Object.entries(facets).map(([f, v]) => [f, token(v)])) };
  write(join(nodeDir(node), "versions", fps["@atomic"].replace(":", "-"), "facets.json"), facets);
  writeFileSync(join(nodeDir(node), ".version"), fps["@atomic"] + "\n");
  return fps;
}

// ---------- renders (tools are deterministic; model renders are supplied files) ----------

const words = (s) => new Set(s.toLowerCase().match(/[a-z0-9.%]+/g) ?? []);
const similarity = (a, b) => { const x = words(a), y = words(b); const i = [...x].filter((w) => y.has(w)).length; return i / Math.max(1, new Set([...x, ...y]).size); };

/** match-passage-keys: carry keys forward by fingerprint, then by best match within the same clause. */
function matchKeys(current, prior) {
  if (!prior) return { passages: current.map((p) => ({ ...p, key: p.id })), diff: { added: current.map((p) => p.id), removed: [], changed: [] } };
  const pool = new Map(prior.map((p) => [p.key, p]));
  // Identical text can repeat within one clause (e.g. two table rows), so keep every key, in order.
  const exact = new Map();
  for (const p of prior) exact.set(`${p.ref}|${p.text}`, [...(exact.get(`${p.ref}|${p.text}`) ?? []), p.key]);
  let next = Math.max(...prior.map((p) => Number(p.key.replace(/\D/g, "")) || 0)) + 1;
  const keyed = []; const changed = []; const added = [];
  for (const p of current) {
    let key = (exact.get(`${p.ref}|${p.text}`) ?? []).find((k) => pool.has(k));
    if (key) { pool.delete(key); keyed.push({ ...p, key }); continue; }
    const candidates = [...pool.values()].filter((q) => q.ref === p.ref).map((q) => [q, similarity(q.text, p.text)]).sort((a, b) => b[1] - a[1]);
    if (candidates[0] && candidates[0][1] >= 0.5) { key = candidates[0][0].key; pool.delete(key); changed.push(key); keyed.push({ ...p, key }); continue; }
    key = `p${next++}`; added.push(key); keyed.push({ ...p, key });
  }
  const idToKey = new Map(keyed.map((p) => [p.id, p.key]));
  const passages = keyed.map((p) => ({ key: p.key, ref: p.ref, parent: p.parent ? idToKey.get(p.parent) ?? null : null, kind: p.kind, modality: p.modality, text: p.text, headingPath: p.headingPath, table: p.table }));
  return { passages, diff: { added, removed: [...pool.keys()], changed } };
}

/** select-dirty-slots: a slot's memo key covers its definition, cited passages and parameter values. */
function slotMemo(slot, card, passages, parameters) {
  const byKey = new Map(passages.map((p) => [p.key, p]));
  const keys = [...new Set([...(slot.passages ?? []), ...(card?.evidence ?? []).map((e) => e.passageId)])].sort();
  const params = [...new Set(card?.params ?? [])].sort();
  return token({ slot, passages: keys.map((k) => [k, byKey.get(k)?.text ?? null]), params: params.map((p) => [p, parameters[p]?.value ?? null]) });
}

function validate(run, passages, map, cards) {
  const dir = join(run.dir, "workspace/validate/set");
  write(join(dir, "passages.json"), { source: run.label, passages: passages.map((p) => ({ id: p.key, ref: p.ref, kind: p.kind, modality: p.modality, text: p.text })) });
  write(join(dir, "map.json"), map);
  write(join(dir, "cards.json"), { cards });
  try {
    const out = execFileSync("node", ["pipeline/validate.mjs", "set", "--dir", join(run.dir, "workspace/validate")], { encoding: "utf8" });
    return { ok: true, report: out.trim() };
  } catch (e) {
    return { ok: false, report: `${e.stdout ?? ""}`.trim() };
  }
}

const MAP_FACETS = ["slots", "parameters", "inputs", "coverage", "issues"];
const mapFromFacets = (f) => ({ ...f.shared, ...Object.fromEntries(MAP_FACETS.map((k) => [k, f[k]])) });

const renders = {
  "policy-source-events"(run) {
    const payload = read(run.payload);
    const doc = { section: payload.section, passages: payload.passages.map(({ id, order, ref, headingPath, parent, list, table, text, kind, modality }) => ({ id, order, ref, headingPath, parent, list, table, text, kind, modality })) };
    return { facets: { "source-document": doc }, diff: `version ${payload.section.version}, effective ${payload.section.effectiveDate}, ${doc.passages.length} passages`, work: { fresh: 0, reused: 0 } };
  },
  "policy-structure"(run) {
    const doc = published("policy-source-events", "source-document");
    const prior = published("policy-structure", "passages");
    const { passages, diff } = matchKeys(doc.passages, prior);
    run.passageDiff = diff;
    const list = (xs) => (xs.length > 8 ? `${xs.slice(0, 3).join(", ")} … ${xs.at(-1)}` : xs.join(", ") || "-");
    return { facets: { passages }, diff: `keys: ${diff.changed.length} changed (${list(diff.changed)}), ${diff.added.length} added (${list(diff.added)}), ${diff.removed.length} removed (${list(diff.removed)})`, work: { fresh: diff.changed.length + diff.added.length, reused: passages.length - diff.changed.length - diff.added.length } };
  },
  "policy-map"(run) {
    const file = opt("--map-render");
    if (!file) throw new RenderPending("policy-map", "pass --map-render <map.json> (model-drafted map for the changed passages)");
    const map = read(file);
    const passages = published("policy-structure", "passages");
    const check = validate(run, passages, map, []);
    if (!check.ok) return { failed: check.report };
    const shared = Object.fromEntries(Object.entries(map).filter(([k]) => !MAP_FACETS.includes(k) && !k.startsWith("$")));
    return { facets: { ...Object.fromEntries(MAP_FACETS.map((k) => [k, map[k]])), shared }, diff: check.report.split("\n").slice(0, 3).join(" | "), work: { fresh: 1, reused: 0 }, validation: check.report };
  },
  "policy-cards"(run) {
    const passages = published("policy-structure", "passages");
    const slots = published("policy-map", "slots");
    const parameters = published("policy-map", "parameters");
    const prior = published("policy-cards", "cards") ?? [];
    const memos = existsSync(join(nodeDir("policy-cards"), "memo.json")) ? read(join(nodeDir("policy-cards"), "memo.json")) : {};
    const supplied = opt("--card-renders") ? read(opt("--card-renders")).cards : [];
    const bySlot = new Map(prior.map((c) => [c.slot, c]));
    const suppliedBySlot = new Map(supplied.map((c) => [c.slot, c]));
    const out = []; const reused = []; const rewritten = []; const nextMemo = {};
    for (const slot of slots) {
      const priorCard = bySlot.get(slot.slot);
      const memo = slotMemo(slot, priorCard, passages, parameters);
      if (priorCard && memos[slot.slot] === memo) { out.push(priorCard); reused.push(slot.slot); nextMemo[slot.slot] = memo; continue; }
      const card = suppliedBySlot.get(slot.slot);
      if (!card) {
        if (priorCard) throw new RenderPending("policy-cards", `slot ${slot.slot} is dirty; supply its card via --card-renders`);
        continue; // never authored: stays unauthored
      }
      out.push(card); rewritten.push(slot.slot); nextMemo[slot.slot] = slotMemo(slot, card, passages, parameters);
    }
    const map = mapFromFacets({ ...Object.fromEntries(MAP_FACETS.map((k) => [k, published("policy-map", k)])), shared: published("policy-map", "shared") });
    const check = validate(run, passages, map, out);
    if (!check.ok) return { failed: check.report };
    run.afterCommit = () => write(join(nodeDir("policy-cards"), "memo.json"), nextMemo);
    return { facets: { cards: out }, diff: `${rewritten.length} rewritten (${rewritten.join(", ") || "-"}), ${reused.length} reused`, work: { fresh: rewritten.length, reused: reused.length }, validation: check.report };
  },
  "review-queue"() {
    const cards = published("policy-cards", "cards");
    const prior = published("review-queue", "baseline") ?? {};
    const now = Object.fromEntries(cards.map((c) => [c.slot, token(c)]));
    const queue = [];
    for (const [slot, t] of Object.entries(now)) if (!prior[slot]) queue.push({ slot, reason: "new" }); else if (prior[slot] !== t) queue.push({ slot, reason: "changed" });
    for (const slot of Object.keys(prior)) if (!now[slot]) queue.push({ slot, reason: "removed" });
    const moved = new Set(queue.filter((q) => q.reason !== "new").map((q) => q.slot));
    for (const c of cards) if (!queue.some((q) => q.slot === c.slot) && (c.relations ?? []).some((r) => moved.has(r.slot))) queue.push({ slot: c.slot, reason: "upstream-changed" });
    return { facets: { queue, baseline: now }, diff: queue.map((q) => `${q.slot}:${q.reason}`).join(", ") || "nothing to review", work: { fresh: 0, reused: 0 } };
  },
};

class RenderPending extends Error { constructor(node, what) { super(`render pending for ${node}: ${what}`); this.node = node; } }

// ---------- wake: one reconcile cascade ----------

function wake() {
  const manifest = existsSync(join(ROOT, "dist/manifest.active.json")) ? read(join(ROOT, "dist/manifest.active.json")) : compile();
  const id = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15) + "-" + randomBytes(3).toString("hex");
  const run = { id, dir: join(ROOT, "runs", id), payload: opt("--payload"), label: opt("--label") ?? "" };
  mkdirSync(join(run.dir, "receipts"), { recursive: true });
  write(join(run.dir, "compiled-intent.json"), manifest);
  const log = (s) => appendFileSync(join(run.dir, "vm.log.md"), s + "\n");
  log(`# run:${id} policy-cards\n\nwake: external · ${run.label}\n`);

  const moved = new Map(); // node -> Set(moved facets) in this run
  const summary = [];
  for (const name of manifest.order) {
    const node = manifest.nodes.find((n) => n.name === name);
    const inbound = manifest.edges.filter((e) => e.to === name);
    const isGateway = node.kind === "gateway";
    const wokenBy = inbound.filter((e) => moved.get(e.from)?.has(e.facet));
    const inputFps = isGateway ? { payload: token(read(run.payload).passages.map((p) => [p.ref, p.text])) }
      : Object.fromEntries(inbound.map((e) => [`${e.from}.${e.facet}`, lastGood(e.from)?.fingerprints?.[e.facet] ?? null]));
    const prev = lastGood(name);
    // Dirty mark: inputs moved since this node last committed (e.g. a render was pending last run).
    const dirty = !isGateway && (!prev || canonicalize(prev.input_fingerprints) !== canonicalize(inputFps));
    if (!isGateway && wokenBy.length === 0 && !dirty) continue; // nothing arrived for this node
    const wakeInfo = { source: isGateway ? "external" : "input", refs: isGateway ? [run.label] : wokenBy.length ? wokenBy.map((e) => `${e.from}.${e.facet}`) : ["dirty from an earlier run"] };
    const memoSame = prev && prev.contract_fingerprint === node.contract_fingerprint && canonicalize(prev.input_fingerprints) === canonicalize(inputFps);
    if (memoSame) {
      appendReceipt(run, name, { contract_fingerprint: node.contract_fingerprint, wake: wakeInfo, input_fingerprints: inputFps, fingerprints: prev.fingerprints, semantic_diff: "", status: "skipped", cost: { provider: null, model: null, tokens: { fresh: 0, reused: 0 }, surprise_cause: wakeInfo.source } });
      log(`- ${name}: skipped (memo key unchanged)`); summary.push([name, "skipped", ""]);
      continue;
    }
    let result;
    try { result = renders[name](run); } catch (e) {
      if (e instanceof RenderPending) { log(`- ${name}: ${e.message}`); summary.push([name, "pending", e.message]); console.log(JSON.stringify({ run: id, summary }, null, 1)); process.exitCode = 3; return; }
      throw e;
    }
    const cost = { provider: "agent-session", model: name === "policy-map" || name === "policy-cards" ? "claude-opus-5-5" : null, tokens: { fresh: null, reused: null }, units: result.work ?? null, surprise_cause: wakeInfo.source };
    if (result.failed) {
      appendReceipt(run, name, { contract_fingerprint: node.contract_fingerprint, wake: wakeInfo, input_fingerprints: inputFps, fingerprints: prev?.fingerprints ?? {}, semantic_diff: "postcondition failed; last good truth stands", status: "failed", cost });
      write(join(run.dir, "workspace", name, "validation.txt"), result.failed);
      log(`- ${name}: FAILED postcondition\n\n\`\`\`\n${result.failed}\n\`\`\``); summary.push([name, "failed", result.failed.split("\n").filter((l) => l.includes("ERROR")).join(" | ")]);
      continue; // downstreams do not wake: nothing moved
    }
    const fps = commit(name, result.facets);
    result.validation && write(join(run.dir, "workspace", name, "validation.txt"), result.validation);
    run.afterCommit?.(); run.afterCommit = undefined;
    const movedFacets = new Set(Object.keys(fps).filter((f) => f !== "@atomic" && fps[f] !== prev?.fingerprints?.[f]));
    moved.set(name, movedFacets);
    appendReceipt(run, name, { contract_fingerprint: node.contract_fingerprint, wake: wakeInfo, input_fingerprints: inputFps, fingerprints: fps, semantic_diff: result.diff ?? "", status: "rendered", cost });
    log(`- ${name}: rendered · moved [${[...movedFacets].join(", ")}] · ${result.diff ?? ""}`);
    summary.push([name, "rendered", `moved: ${[...movedFacets].join(", ") || "none"} · ${result.diff ?? ""}`]);
  }
  console.log(JSON.stringify({ run: id, summary }, null, 1));
}

if (cmd === "compile") console.log(JSON.stringify(compile(), null, 1));
else if (cmd === "wake") wake();
else { console.error("usage: vm.mjs compile|wake --root <dir> ..."); process.exit(1); }
