// Card runtime CLI.
//
//   node runtime/cli.mjs bundle <dir> --out <file.bundle.json> [--effective-to YYYY-MM-DD] [--supersedes VERSION]
//   node runtime/cli.mjs check <loan.json>... --library <dir> [--adopt POLICY@VERSION]... [--as-of note_date|application_date]
//                              [--policy ID] [--store <dir>] [--json] [--quotes]
//   node runtime/cli.mjs explain <decision.json> --library <dir> [--quotes]
//
// Exit codes: 0 ran (whatever the outcome), 1 usage or input error, 2 bundle failed validation.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { BundleError, buildBundleFromDir, checkLoan, explain, loadLibrary, parseAdopt } from "./index.mjs";

const args = process.argv.slice(2);
const cmd = args[0];
const flags = new Set(["--json", "--quotes"]);
const opts = {};
const pos = [];
for (let n = 1; n < args.length; n++) {
  const a = args[n];
  if (flags.has(a)) opts[a.slice(2)] = true;
  else if (a.startsWith("--")) { const k = a.slice(2); const v = args[++n]; opts[k] = k === "adopt" ? [...(opts[k] ?? []), v] : v; }
  else pos.push(a);
}
const read = (f) => JSON.parse(readFileSync(f, "utf8"));
const usage = () => { console.error(readFileSync(new URL(import.meta.url), "utf8").split("\n").slice(2, 7).map((l) => l.replace(/^\/\/ ?/, "")).join("\n")); process.exit(1); };

try {
  if (cmd === "bundle") {
    if (!pos[0] || !opts.out) usage();
    const b = await buildBundleFromDir(pos[0], { effectiveTo: opts["effective-to"], supersedes: opts.supersedes });
    mkdirSync(dirname(opts.out), { recursive: true });
    writeFileSync(opts.out, JSON.stringify(b, null, 2) + "\n");
    console.log(`${b.policy.id}@${b.policy.version} effective ${b.policy.effectiveFrom}: ${b.cards.length} cards, bundle ${b.bundle_hash.slice(7, 19)} -> ${opts.out}`);
  } else if (cmd === "check") {
    if (!pos.length || !opts.library) usage();
    const library = loadLibrary(opts.library);
    const adopt = parseAdopt(opts.adopt);
    const all = [];
    for (const f of pos) {
      const loan = read(f);
      for (const r of checkLoan(library, loan, { asOfRule: opts["as-of"], adopt, store: opts.store, policy: opts.policy })) {
        all.push(r);
        if (!opts.json) {
          console.log(explain(r.decision, r.bundle, { quotes: opts.quotes }).text);
          if (r.receipt) console.log(`Receipt ${r.receipt.id.slice(7)} · ${r.receipt.status}`);
          console.log("");
        }
      }
    }
    if (opts.json) console.log(JSON.stringify(all.map((r) => ({ decision: r.decision, receipt: r.receipt ?? null })), null, 2));
  } else if (cmd === "explain") {
    if (!pos[0] || !opts.library) usage();
    const decision = read(pos[0]);
    const bundle = loadLibrary(opts.library).find((b) => b.bundle_hash === decision.policy.bundle_hash) ?? null;
    if (decision.policy.bundle_hash && !bundle) throw new Error(`the bundle this decision used (${decision.policy.bundle_hash.slice(7, 19)}) is not in ${opts.library}`);
    console.log(explain(decision, bundle, { quotes: opts.quotes }).text);
  } else usage();
} catch (e) {
  console.error(e.message);
  process.exit(e instanceof BundleError ? 2 : 1);
}
