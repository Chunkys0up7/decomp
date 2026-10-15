// Pass 4 — Deterministic validation of a policy map and its cards.
//
// Usage: node pipeline/validate.mjs <example> [--dir golden]
// Reads <dir>/<example>/passages.json (Pass 0 output), map.json (Pass 1) and cards.json (Pass 2).
// Exits 1 if any error is found. Warnings never fail the run. The checks live in checks.mjs.

import { readFile } from "node:fs/promises";
import { validateSet } from "./checks.mjs";

const example = process.argv[2];
const dir = process.argv.includes("--dir") ? process.argv[process.argv.indexOf("--dir") + 1] : "golden";
if (!example) { console.error("Usage: node pipeline/validate.mjs <example> [--dir golden]"); process.exit(1); }

const load = async (f) => JSON.parse(await readFile(f, "utf8"));
const passages = await load(`${dir}/${example}/passages.json`);
const map = await load(`${dir}/${example}/map.json`);
const { cards } = await load(`${dir}/${example}/cards.json`);

const { errors, warnings, summary: s } = validateSet({ passages, map, cards });

console.log(`${s.source ?? example} — ${s.passages} passages, ${s.denominator} in coverage denominator`);
console.log(`Map:   ${s.slots} slots, ${s.parameters} parameters, ${s.inputs} inputs, ${s.externals} external refs, ${s.issues} issues`);
console.log(`Cards: ${s.cards} authored (${s.slotsWithCards}/${s.slots} slots), ${s.tests} test cases`);
console.log(`Coverage by cards: ${s.covered}/${s.denominator} normative passages (${Math.round((100 * s.covered) / s.denominator)}%)`);
for (const w of warnings) console.log(`  warn  ${w}`);
for (const e of errors) console.log(`  ERROR ${e}`);
console.log(errors.length ? `FAIL: ${errors.length} error(s), ${warnings.length} warning(s)` : `PASS with ${warnings.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
