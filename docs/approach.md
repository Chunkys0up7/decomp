# Policy Cards: decomposition approach

How to turn long procedural policy documents into a cohesive, reviewable set of agent-ready cards. The method was piloted on a real section of a public mortgage-industry guide; the worked example kept in this repository uses the build spec's fictional sample policy instead (`golden/sample-hl0142/`).

## Pipeline

| Pass | What | How | Human review | In this repo |
|---|---|---|---|---|
| 0 Structure | Passages (paragraph, list item, table cell) with exact clause refs, a parent tree, defined terms, cross-refs, fingerprint, kind and modality | Deterministic, per source format | Spot-check | `golden/sample-hl0142/passages.json` (example output) |
| 1 Map | Card slots, glossary, parameter registry, input vocabulary, actors, external refs, coverage states, policy issues | LLM drafts, human approves | **Main review gate** | `golden/sample-hl0142/map.json` (hand-made reference) |
| 2 Cards | One card per slot, written against the approved map | LLM, slot by slot, map as context | Per section, risk-ordered | `golden/sample-hl0142/cards.json` (subset) |
| 3 Consolidate | Dedupe, relations, conflicts, cross-document links | LLM + graph checks | Changes only | Not started |
| 4 Validate | Coverage, grounding, verbatim evidence, vocabulary, executable tests | Deterministic | Failures only | `pipeline/validate.mjs` |

```
npm run validate:cards -- sample-hl0142
```

## Card contract

A card is valid when:

1. It fills exactly one map slot, and its type matches the slot.
2. Every evidence quote is a verbatim substring of a passage (offsets are computed, never trusted).
3. Every number comes from the parameter registry (`{{PARAM}}`), never typed in by hand.
4. Conditions use only registered inputs (`loan.dti_ratio`) and parameters.
5. Rules and calculations an agent will execute carry `expr` plus test cases that pass.
6. Anything not stated in the source is a field marked `inferred` and backed by an issue.
7. Branches inside a procedure point to rule cards instead of restating the condition.

## What the pilot showed

These findings came from decomposing a real, dense underwriting section; they are stated generally because they apply to any procedural document.

1. **Meaning lives in structure.** A short item such as "Taxes" is not a heading: it is an item in a list whose lead-in says "...must be included in the ratio:". Pass 0 links every list item to its lead-in, and modality is inherited down that tree. Sentence-by-sentence or chunk-by-chunk reading loses this.
2. **Parameters repeat and drift.** The same threshold (for example a months-remaining cut-off, or a payment-history lookback) appeared up to nine times in one section. In the registry each is stated once and checked against the source text (M3), so one edit updates every card that uses it.
3. **Same pattern, different numbers.** Several fallback calculations differed only in a factor. The map makes these one shared calculation with several parameters, not separate unrelated cards.
4. **Sections are not self-contained.** One section cited about twenty others. These are tracked as `externalRefs` with an `external` coverage state, so references are not mistaken for gaps.
5. **Decomposition finds policy defects.** For example: a reference to "either of the guidelines" when only one is stated; a number given as an example rather than a threshold; alternatives with no stated precedence. These are useful output for policy owners in their own right.
6. **Regex modality is only a hint.** "may not use X ... and must instead use:" is both a prohibition and an obligation. The structure tree is deterministic and reliable; modality needs confirming in Pass 1.
7. **Versions coexist.** A current and a future mandatory version of the same section can be live at once. Card IDs based on slots and passage fingerprints let a re-run flag only the cards whose evidence changed.

## Validator controls (Pass 4)

| Code | Check |
|---|---|
| M1 | Every normative or definitional passage is in a slot or has an explicit coverage state |
| M2 | Slot references (passages, external refs, issues, parameters) resolve |
| M3 | Every parameter value literally appears in each passage it cites |
| C1 | Card type matches its slot |
| C2 / C3 | Evidence is verbatim, and stays inside the slot's planned passages |
| C4 | Required fields per card type |
| C5 / C5b | Parameters are declared and used; hard-coded policy numbers are flagged |
| C6 | Inputs come from the map vocabulary |
| C7 / C8 | Relations and issues resolve |
| C9 | Machine-evaluable cards have logic and passing tests |

Mutation check: a reworded quote, a wrong parameter value, a dropped passage, a hard-coded threshold and an unregistered input are each caught.

## Source material

No third-party source text is kept in this repository. The worked example uses the fictional sample policy from the build spec.
