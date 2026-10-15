// One-command OpenProse spike demo on the fictional sample policy (POL-HL-0142).
//   npm run spike:openprose
// Resets local/demo-root, compiles the contracts, runs four wakes plus a fault drill,
// and writes spikes/openprose/demo/report.html.
import { execFileSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";

const VM = "spikes/openprose/vm.mjs";
const D = "spikes/openprose/demo";
const ROOT = "local/demo-root";
const DRILL = "local/demo-root-drill";

const vm = (...a) => {
  try {
    return JSON.parse(execFileSync("node", [VM, ...a], { encoding: "utf8" }));
  } catch (e) {
    if (e.status === 3) return JSON.parse(e.stdout); // a model render is pending: the cascade stops here
    throw e;
  }
};
const show = (title, out) => {
  console.log(`\n${title}  (run ${out.run})`);
  for (const [node, status, detail] of out.summary) console.log(`  ${node.padEnd(22)} ${status.padEnd(9)} ${detail.slice(0, 110)}`);
};

for (const r of [ROOT, DRILL]) rmSync(r, { recursive: true, force: true });
vm("compile", "--root", ROOT);
vm("compile", "--root", DRILL);

show("1. Load v3.1", vm("wake", "--root", ROOT, "--payload", `${D}/v3.1.passages.json`, "--label", "POL-HL-0142 v3.1",
  "--map-render", `${D}/renders/v3.1-policy-map.json`, "--card-renders", `${D}/renders/v3.1-cards.json`));
show("2. Re-send v3.1 unchanged", vm("wake", "--root", ROOT, "--payload", `${D}/v3.1.passages.json`, "--label", "POL-HL-0142 v3.1 re-sent"));
show("3a. Load v3.2 (no model renders yet)", vm("wake", "--root", ROOT, "--payload", `${D}/v3.2.passages.json`, "--label", "POL-HL-0142 v3.2"));
show("3b. Supply the model renders for v3.2", vm("wake", "--root", ROOT, "--payload", `${D}/v3.2.passages.json`, "--label", "POL-HL-0142 v3.2 (model renders)",
  "--map-render", `${D}/renders/v3.2-policy-map.json`, "--card-renders", `${D}/renders/v3.2-cards.json`));

// Fault drill: same change, but the model paraphrases the dti-max evidence.
const bad = JSON.parse(readFileSync(`${D}/renders/v3.2-cards.json`, "utf8"));
bad.cards[0].evidence[0].quote = "Maximum DTI is now 43 percent.";
writeFileSync("local/demo-bad-cards.json", JSON.stringify(bad, null, 2));
vm("wake", "--root", DRILL, "--payload", `${D}/v3.1.passages.json`, "--label", "drill baseline v3.1",
  "--map-render", `${D}/renders/v3.1-policy-map.json`, "--card-renders", `${D}/renders/v3.1-cards.json`);
show("Fault drill: v3.2 with a bad card render", vm("wake", "--root", DRILL, "--payload", `${D}/v3.2.passages.json`, "--label", "drill v3.2 with a bad card",
  "--map-render", `${D}/renders/v3.2-policy-map.json`, "--card-renders", "local/demo-bad-cards.json"));

execFileSync("node", ["spikes/openprose/report.mjs", "--root", ROOT, "--drill", DRILL, "--out", `${D}/report.html`], { stdio: "inherit" });
console.log(`\nReceipts: ${ROOT}/state/world-model/<node>/receipts.jsonl · run logs: ${ROOT}/runs/<id>/vm.log.md`);
