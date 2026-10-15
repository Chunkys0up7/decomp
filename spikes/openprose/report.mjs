// Renders an HTML report of OpenProse spike runs straight from the receipt ledgers and
// content-addressed world-model versions. Usage:
//   node spikes/openprose/report.mjs --root <prose-root> [--drill <prose-root>] --out <file.html>
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const ROOT = opt("--root");
const DRILL = opt("--drill");
const OUT = opt("--out");

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const read = (p) => JSON.parse(readFileSync(p, "utf8"));
const ledger = (root, node) => {
  const f = join(root, "state/world-model", node, "receipts.jsonl");
  return existsSync(f) ? readFileSync(f, "utf8").trim().split("\n").map((l) => JSON.parse(l)) : [];
};
const version = (root, node, atomic) => read(join(root, "state/world-model", node, "versions", atomic.replace(":", "-"), "facets.json"));
const manifest = read(join(ROOT, "dist/manifest.active.json"));
const nodes = manifest.order;

// Runs in chronological order, with each node's receipt in that run.
function runsOf(root) {
  // Order runs by the gateway's receipt ledger (every run starts there); run ids share seconds.
  const gatewayOrder = ledger(root, nodes[0]).map((r) => r.id);
  const firstReceipt = (id) => JSON.parse(readFileSync(join(root, "runs", id, "receipts", `${nodes[0]}.jsonl`), "utf8").trim().split("\n")[0]).id;
  const ids = readdirSync(join(root, "runs")).sort((a, b) => gatewayOrder.indexOf(firstReceipt(a)) - gatewayOrder.indexOf(firstReceipt(b)));
  return ids.map((id) => {
    const log = readFileSync(join(root, "runs", id, "vm.log.md"), "utf8");
    const label = (log.match(/wake: external · (.*)/) ?? [])[1] ?? "";
    const receipts = Object.fromEntries(nodes.map((n) => {
      const f = join(root, "runs", id, "receipts", `${n}.jsonl`);
      return [n, existsSync(f) ? JSON.parse(readFileSync(f, "utf8").trim().split("\n").at(-1)) : null];
    }));
    const pending = [...log.matchAll(/^- ([a-z-]+): render pending/gm)].map((m) => m[1]);
    return { id, label, receipts, pending };
  });
}

function wordDiff(a, b) {
  const A = a.split(/(\s+)/), B = b.split(/(\s+)/);
  const dp = Array.from({ length: A.length + 1 }, () => new Array(B.length + 1).fill(0));
  for (let i = A.length - 1; i >= 0; i--) for (let j = B.length - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  let i = 0, j = 0, out = "";
  while (i < A.length && j < B.length) {
    if (A[i] === B[j]) { out += esc(A[i]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) out += `<del>${esc(A[i++])}</del>`;
    else out += `<ins>${esc(B[j++])}</ins>`;
  }
  while (i < A.length) out += `<del>${esc(A[i++])}</del>`;
  while (j < B.length) out += `<ins>${esc(B[j++])}</ins>`;
  return out;
}

const runs = runsOf(ROOT);
const statusCell = (r, pendingNote) => {
  if (!r) return `<td class="none">${pendingNote ?? "not woken"}</td>`;
  const moved = r.status === "rendered" ? Object.keys(r.fingerprints ?? {}).filter((f) => f !== "@atomic") : [];
  const units = r.cost?.units ? ` · ${r.cost.units.fresh ?? 0} new, ${r.cost.units.reused ?? 0} reused` : "";
  return `<td class="${r.status}"><strong>${r.status}</strong><div class="small">${esc(r.semantic_diff).slice(0, 160)}${esc(units)}</div></td>`;
};

// Before/after for the changed passage and card, from content-addressed versions.
const structureRendered = ledger(ROOT, "policy-structure").filter((r) => r.status === "rendered");
const cardsRendered = ledger(ROOT, "policy-cards").filter((r) => r.status === "rendered");
const mapRendered = ledger(ROOT, "policy-map").filter((r) => r.status === "rendered");
const queueRendered = ledger(ROOT, "review-queue").filter((r) => r.status === "rendered");
const [pBefore, pAfter] = [structureRendered[0], structureRendered.at(-1)].map((r) => version(ROOT, "policy-structure", r.fingerprints["@atomic"]).passages);
const [cBefore, cAfter] = [cardsRendered[0], cardsRendered.at(-1)].map((r) => version(ROOT, "policy-cards", r.fingerprints["@atomic"]).cards);
const [mBefore, mAfter] = [mapRendered[0], mapRendered.at(-1)].map((r) => version(ROOT, "policy-map", r.fingerprints["@atomic"]));
const queue = version(ROOT, "review-queue", queueRendered.at(-1).fingerprints["@atomic"]).queue;

const beforeKeys = new Map(pBefore.map((p) => [p.key, p])), afterKeys = new Map(pAfter.map((p) => [p.key, p]));
const changed = pAfter.filter((p) => beforeKeys.has(p.key) && beforeKeys.get(p.key).text !== p.text);
const added = pAfter.filter((p) => !beforeKeys.has(p.key));
const removed = pBefore.filter((p) => !afterKeys.has(p.key));
const renumbered = pAfter.filter((p, idx) => beforeKeys.has(p.key) && pBefore.findIndex((q) => q.key === p.key) !== idx).length;

const changedCards = queue.filter((q) => q.reason === "changed").map((q) => q.slot);
const cardPair = (slot) => [cBefore.find((c) => c.slot === slot), cAfter.find((c) => c.slot === slot)];
const fieldsTable = (card) => `<table class="fields">${card.fields.map((f) => `<tr><th>${esc(f.label)}</th><td class="${f.mono ? "mono" : ""}">${esc(f.value)}</td></tr>`).join("")}
  <tr><th>Evidence</th><td>${card.evidence.map((e) => `<mark>${esc(e.quote)}</mark>`).join("<br>")}</td></tr>
  <tr><th>Resolved params</th><td class="mono">${esc(Object.entries(card.resolved_params ?? {}).map(([k, v]) => `${k} = ${v}`).join(", ") || "-")}</td></tr>
  <tr><th>Tests</th><td class="mono">${(card.tests ?? []).map((t) => esc(`${JSON.stringify(t.given)} → ${JSON.stringify(t.expect)}`)).join("<br>") || "-"}</td></tr></table>`;
const keysOf = (o) => Object.keys(o ?? {}).filter((k) => !k.startsWith("$"));
const mapDelta = {
  inputsAdded: keysOf(mAfter.inputs).filter((k) => !keysOf(mBefore.inputs).includes(k)),
  issuesAdded: mAfter.issues.filter((i) => !mBefore.issues.some((x) => x.id === i.id)),
  issuesRemoved: mBefore.issues.filter((i) => !mAfter.issues.some((x) => x.id === i.id)),
  coverageAdded: keysOf(mAfter.coverage).filter((k) => !keysOf(mBefore.coverage).includes(k)),
  coverageRemoved: keysOf(mBefore.coverage).filter((k) => !keysOf(mAfter.coverage).includes(k)),
  slotsAdded: mAfter.slots.filter((x) => !mBefore.slots.some((y) => y.slot === x.slot)).map((x) => x.slot),
  slotsRemoved: mBefore.slots.filter((x) => !mAfter.slots.some((y) => y.slot === x.slot)).map((x) => x.slot),
  slotsSame: JSON.stringify(mBefore.slots) === JSON.stringify(mAfter.slots),
  paramChanges: keysOf(mAfter.parameters).filter((k) => mBefore.parameters[k]?.value !== mAfter.parameters[k]?.value).map((k) => `${k}: ${mBefore.parameters[k]?.value ?? "new"} → ${mAfter.parameters[k].value}`),
};

let drillHtml = "";
if (DRILL) {
  const d = runsOf(DRILL).at(-1);
  const failed = d.receipts["policy-cards"];
  const validation = existsSync(join(DRILL, "runs", d.id, "workspace/policy-cards/validation.txt")) ? readFileSync(join(DRILL, "runs", d.id, "workspace/policy-cards/validation.txt"), "utf8") : "";
  const queueReceipts = ledger(DRILL, "review-queue").length;
  drillHtml = `
  <section class="panel"><h2>Fault drill: a bad model render is not committed</h2>
    <p class="muted">Same version change, but the model's card for <code>${esc((validation.match(/\[([a-z0-9-]+)\]/) ?? [])[1] ?? "a slot")}</code> paraphrases its evidence instead of quoting it.</p>
    <table class="runs"><tr><th>Node</th><th>Receipt</th></tr>${nodes.map((n) => `<tr><td class="mono">${n}</td>${statusCell(d.receipts[n])}</tr>`).join("")}</table>
    <pre>${esc(validation.split("\n").filter((l) => /ERROR|FAIL|Cards:/.test(l)).join("\n"))}</pre>
    <ul class="clean"><li><code>policy-cards</code> wrote <strong>${failed?.status}</strong>; its fingerprints were carried forward, so the last good cards stand.</li>
    <li><code>review-queue</code> was never woken (its ledger still has ${queueReceipts} receipt): reviewers never see an invalid card.</li></ul>
  </section>`;
}

const sampleReceipt = cardsRendered.at(-1);
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>OpenProse Spike Report</title>
<style>
:root{--canvas:#F3F5F8;--surface:#fff;--tint:#EEF4FF;--sunken:#F7F9FC;--border:#DDE3EC;--ink:#14213D;--ink2:#44546F;--ink3:#5B6B84;--accent:#1F5FD1;--ok:#1B6B3A;--okt:#E4F5EA;--err:#B42318;--errt:#FDECEA;--warn:#8A5A00;--warnt:#FFF4D6}
*{box-sizing:border-box}body{margin:0;background:var(--canvas);color:var(--ink);font:15px/1.55 "Open Sans",system-ui,sans-serif}
main{max-width:1200px;margin:0 auto;padding:32px 24px 64px;display:flex;flex-direction:column;gap:24px}
h1{font-size:32px;margin:0}h2{font-size:21px;margin:0 0 12px}h3{font-size:16px;margin:16px 0 8px}
.panel{background:var(--surface);border:1px solid var(--border);border-radius:16px;box-shadow:0 1px 3px rgba(20,33,61,.06);padding:24px;overflow-x:auto}
.muted{color:var(--ink2)}.small{font-size:12.5px;color:var(--ink2)}code,.mono{font-family:"PT Mono",Consolas,monospace;font-size:13px}
table{border-collapse:collapse;width:100%}th,td{text-align:left;vertical-align:top;padding:8px 10px;border-bottom:1px solid var(--border)}th{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--ink3)}
td.rendered{background:var(--okt)}td.skipped{background:var(--sunken)}td.failed{background:var(--errt)}td.none{color:var(--ink3)}td strong{text-transform:uppercase;font-size:12px;letter-spacing:.04em}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px}
.stat{font-size:34px;font-weight:700;line-height:1.1}
del{background:var(--errt);color:var(--err);text-decoration:line-through}ins{background:var(--okt);color:var(--ok);text-decoration:none;font-weight:600}
pre{background:var(--sunken);border:1px solid var(--border);border-radius:12px;padding:14px;overflow:auto;font:12.5px/1.5 "PT Mono",Consolas,monospace;white-space:pre-wrap}
mark{background:#FFE9A8;color:var(--ink);padding:1px 3px;border-radius:4px}.fields th{width:28%;text-transform:none;letter-spacing:0;font-size:13px;color:var(--ink2)}
.tag{display:inline-block;padding:1px 8px;border-radius:999px;font-size:12px;font-weight:600}.tag.changed{background:var(--warnt);color:var(--warn)}.tag.upstream-changed{background:var(--tint);color:var(--accent)}.tag.new{background:var(--okt);color:var(--ok)}.tag.parameter-changed{background:#F6E8FA;color:#8A2BA0}.tag.removed{background:var(--errt);color:var(--err)}
ul.clean{margin:8px 0 0;padding-left:20px}
</style></head><body><main>
<header><p class="small">decomp · spike/openprose · generated from receipts in <code>${esc(ROOT)}</code></p>
<h1>Policy cards as an OpenProse program</h1>
<p class="muted">${esc(runs[0]?.label)} decomposed, then re-run against ${esc(runs.at(-1)?.label)}. The VM re-rendered only what moved.</p></header>

<section class="grid">
 <div class="panel"><div class="stat">${pAfter.length - changed.length - added.length} / ${pAfter.length}</div><div class="muted">passages kept their key across versions, although ${renumbered} were renumbered</div></div>
 <div class="panel"><div class="stat">${cardsRendered.at(-1).cost.units.fresh} rewritten · ${cardsRendered.at(-1).cost.units.reused} reused</div><div class="muted">cards after the version change</div></div>
 <div class="panel"><div class="stat">${queue.length}</div><div class="muted">cards sent back to reviewers (${queue.map((q) => q.reason).join(", ")})</div></div>
</section>

<section class="panel"><h2>Program</h2>
 <p class="muted">Compiled from Contract Markdown in <code>spikes/openprose/src/policy-cards/</code>. Edges are <code>Requires</code> ↔ <code>Maintains</code> facets, wired from the contracts alone.</p>
 <table><tr><th>Node</th><th>Kind</th><th>Requires</th><th>Maintains</th></tr>${manifest.nodes.sort((a, b) => nodes.indexOf(a.name) - nodes.indexOf(b.name)).map((n) => `<tr><td class="mono">${n.name}</td><td>${n.kind}</td><td class="mono">${n.requires.join(", ") || "-"}</td><td class="mono">${n.maintains.join(", ")}</td></tr>`).join("")}</table>
</section>

<section class="panel"><h2>Runs</h2>
 <table class="runs"><tr><th>Run</th>${nodes.map((n) => `<th>${n}</th>`).join("")}</tr>
 ${runs.map((r) => `<tr><td><span class="mono">${r.id}</span><div class="small">${esc(r.label)}</div></td>${nodes.map((n) => statusCell(r.receipts[n], r.pending.includes(n) ? "waiting for a model render" : undefined)).join("")}</tr>`).join("")}</table>
 <p class="small">"not woken" means no receipt: nothing the node subscribes to moved. Run 3 stopped after <code>policy-structure</code> because <code>policy-map</code> needed a model render; the next run resumed from the dirty mark.</p>
</section>

<section class="panel"><h2>What changed in the source</h2>
 <ul class="clean">
  <li><strong>Changed:</strong> ${changed.map((p) => `<code>${p.key}</code> (${esc(p.ref)})`).join(", ")}</li>
  <li><strong>Removed:</strong> ${removed.map((p) => `<code>${p.key}</code>: ${esc(p.text.slice(0, 90))}…`).join("; ") || "-"}</li>
  <li><strong>Added:</strong> ${added.map((p) => `<code>${p.key}</code>: "${esc(p.text)}"`).join("; ") || "-"}</li>
 </ul>
 ${changed.map((p) => `<h3>${p.key} · ${esc(p.ref)}</h3><p>${wordDiff(beforeKeys.get(p.key).text, p.text)}</p>`).join("")}
</section>

<section class="panel"><h2>Map render (model)</h2>
 <ul class="clean">
  <li>Slots: ${mapDelta.slotsSame ? "unchanged (facet did not move)" : `added ${mapDelta.slotsAdded.map((k) => `<code>${k}</code>`).join(", ") || "-"}; removed ${mapDelta.slotsRemoved.map((k) => `<code>${k}</code>`).join(", ") || "-"}`}</li>
  <li>Parameters: ${mapDelta.paramChanges.length ? mapDelta.paramChanges.map((c) => `<code>${esc(c)}</code>`).join(", ") : "unchanged (facet did not move)"}</li>
  <li>Inputs added: ${mapDelta.inputsAdded.map((k) => `<code>${k}</code>`).join(", ") || "-"}</li>
  <li>Issues added: ${mapDelta.issuesAdded.map((i) => `<code>${i.id}</code> ${esc(i.title)}`).join("; ") || "-"}</li>
  <li>Issues retired: ${mapDelta.issuesRemoved.map((i) => `<code>${i.id}</code> ${esc(i.title)}`).join("; ") || "-"}</li>
  <li>Coverage: added ${mapDelta.coverageAdded.map((k) => `<code>${k}</code>`).join(", ") || "-"}; removed ${mapDelta.coverageRemoved.map((k) => `<code>${k}</code>`).join(", ") || "-"}</li>
 </ul>
</section>

${changedCards.map((slot) => { const [b, a] = cardPair(slot); return `<section class="panel"><h2>Card rewritten: <code>${slot}</code></h2>
 <div class="grid"><div><h3>Before</h3>${fieldsTable(b)}<pre>${esc(b.expr)}</pre></div><div><h3>After</h3>${fieldsTable(a)}<pre>${esc(a.expr)}</pre><p class="small">Tests: ${a.tests.length} (${a.tests.length - b.tests.length} added) · issues: ${a.issues.join(", ")}</p></div></div></section>`; }).join("")}

<section class="panel"><h2>Review queue</h2>
 <table><tr><th>Card</th><th>Reason</th><th>Detail</th></tr>${queue.map((q) => `<tr><td class="mono">${q.slot}</td><td><span class="tag ${q.reason}">${q.reason}</span></td><td class="mono">${esc(q.detail ?? "")}</td></tr>`).join("")}</table>
 <p class="small">The other ${cAfter.length - queue.length} cards did not move and stay approved.</p>
</section>

${drillHtml}

<section class="panel"><h2>A receipt</h2><p class="muted">The commit object for the card render above, as written to <code>state/world-model/policy-cards/receipts.jsonl</code>.</p><pre>${esc(JSON.stringify(sampleReceipt, null, 2))}</pre></section>
</main></body></html>`;
writeFileSync(OUT, html);
console.log(`wrote ${OUT}`);
