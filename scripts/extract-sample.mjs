// Extracts the Appendix B sample decomposition from the build spec into
// src/domain/sample/sample-decomposition.json, so the dataset is never retyped by hand.
// The section sign is not used in this project (docs/deviations.md D-C1): section numbers and
// refs lose the sign ("2", "2.3") and prose mentions become "Section 4.2". Passage text is untouched,
// so evidence offsets stay valid; the script fails if any quote no longer matches.
//
// Usage: node scripts/extract-sample.mjs <path-to-policy-cards-build-spec.md>
import { readFileSync, writeFileSync } from "node:fs";

const specPath = process.argv[2];
if (!specPath) { console.error("Usage: node scripts/extract-sample.mjs <build-spec.md>"); process.exit(1); }

const spec = readFileSync(specPath, "utf8");
const start = spec.indexOf("```json", spec.indexOf("## Appendix B")) + "```json".length;
const data = JSON.parse(spec.slice(start, spec.indexOf("```", start)));

const SIGN = String.fromCharCode(0xa7);
const bare = (s) => s.replaceAll(SIGN, "");
for (const p of data.passages) {
  if (p.text.includes(SIGN)) throw new Error(`${p.id} text contains the section sign; offsets would shift`);
  p.sectionNo = bare(p.sectionNo);
  p.ref = bare(p.ref);
}
for (const i of data.issues) {
  for (const k of ["title", "detail", "fix"]) i[k] = i[k].replaceAll(SIGN, "Section ");
}

for (const c of data.cards) {
  for (const e of c.evidence) {
    const p = data.passages.find((x) => x.id === e.passageId);
    if (p.text.slice(e.start, e.end) !== e.quote) throw new Error(`${c.shortId} evidence no longer matches ${e.passageId}`);
  }
}
if (JSON.stringify(data).includes(SIGN)) throw new Error("section sign still present");

writeFileSync("src/domain/sample/sample-decomposition.json", JSON.stringify(data, null, 2) + "\n");
console.log(`Wrote ${data.passages.length} passages, ${data.cards.length} cards, ${data.issues.length} issues.`);
