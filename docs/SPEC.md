# Policy Cards — Project Specification

Version 1.0 · 2026-10-14 · Status: method piloted, review UI built (build spec phases 0 to 7 complete)

This is the single description of what Policy Cards is, how it works and what is built. Detailed requirement IDs (SALT-, DATA-, RED-, UI-, A11Y-, TEST-) come from the two input specs and are tracked in [`SPEC-COMPLIANCE.md`](../SPEC-COMPLIANCE.md); differences from those specs are in [`deviations.md`](deviations.md).

---

## 1. Problem

Organisations run on large bodies of procedural documentation: policies, guides, manuals and handbooks, hundreds of pages long, written for people. Agentic systems need the same knowledge in a form they can **retrieve, understand and act on**: explicit conditions, named inputs, units, steps and done-criteria, each traceable to the text it came from.

Turning one into the other is the hard part:

- **Chunking loses meaning.** Obligations live in document structure. A list item such as "Taxes" means nothing alone; its force comes from the lead-in "...must be included in the ratio:".
- **Numbers repeat and drift.** The same threshold can appear many times in one section. Restating it on every card guarantees inconsistency when the policy changes.
- **Documents are not self-contained.** A single section can cite twenty others.
- **Reviewers cannot review 400 unrelated cards.** Without a plan for the whole document, review becomes card-by-card proofreading with no sense of coverage.
- **Policies have defects.** Vague terms, missing thresholds and unstated precedence surface during decomposition and need a home.

## 2. Goals and non-goals

**Goals**

1. Decompose a whole document into a **cohesive** card set: one vocabulary, one parameter registry, explicit coverage of every obligation.
2. Make every card **controlled**: verbatim evidence, registered numbers and inputs, executable logic with tests where a card is meant to be evaluated.
3. Make the set **reviewable** by people at the right level: the plan first, then cards, risk-ordered, with lineage to the source on every screen.
4. Publish approved cards as **immutable artifacts** with stable identity, metadata and a content hash, ready for run-time retrieval.
5. Stay **source-agnostic**: any document format can be ingested behind one adapter seam.

**Non-goals (this release)**

- Run-time retrieval of cards (search, embeddings, serving to agents). Artifact IDs and metadata exist so retrieval can key on them later.
- A production LLM decomposition service. The UI runs on deterministic mock adapters; the method is specified and validated with hand-built reference data.
- Authentication, roles, multi-user collaboration.

## 3. Users

| User | Needs |
|---|---|
| Policy reviewer | Load a policy, run decomposition, approve or reject each card with full lineage, acknowledge gaps, publish |
| Policy owner | See the defects decomposition found (ambiguity, missing thresholds, conflicts) and fix the source |
| Agent builder | Consume published artifacts with stable IDs, typed content, applicability and tags |
| Platform engineer | Plug a real decomposition service and publish target into the adapter seam |

## 4. Concepts

| Term | Meaning |
|---|---|
| Passage | Smallest addressable unit of a source document (paragraph, list item, table cell), with a clause reference and a parent link to its lead-in |
| Policy map | The reviewed plan for a document: card slots, glossary, parameter registry, input vocabulary, actors, external references, coverage states, policy issues |
| Slot | A planned card: type, title, and the passages it must cover |
| Parameter | A number the policy states (threshold, period, factor), held once in the registry and referenced by cards as `{{ID}}` |
| Card | One obligation of one type, filling one slot |
| Evidence | A verbatim quote from a passage, with offsets |
| Issue | A finding about a card or passage: severity `error` (blocking), `warning` or `info` |
| Coverage state | Why a normative passage has no card: `external` (governed elsewhere), `navigational`, `version-notice` |
| Artifact | The published, immutable JSON form of an approved card |

### 4.1 Card types

| Type | Glyph | An agent... | Required content |
|---|---|---|---|
| Fact | circle | asserts or looks up | statement, applies-to |
| Rule | diamond | evaluates a condition, gets a decision | when, then (else / else-if), inputs |
| Calculation | square | computes a value | applies-when, inputs with units, formula, output with unit |
| Procedure | triangle | executes steps | trigger, ordered steps with actor, done-when |

Type is always shown by shape, colour and label together, never colour alone.

## 5. Method: the decomposition pipeline

Five passes. Deterministic passes bracket the model-driven ones, and people review where review is cheapest.

```
 source ──► 0 Structure ──► 1 Map ──► 2 Cards ──► 3 Consolidate ──► 4 Validate ──► review UI ──► publish
            deterministic   LLM+human   LLM        LLM+graph         deterministic   human
                            (gate)
```

| Pass | Input | Output | Human review | Status |
|---|---|---|---|---|
| 0 Structure | Source document | Passages with clause refs, parent tree, defined terms, cross-refs, fingerprints, kind and modality | Spot-check | Method proven in pilot; example output in `golden/sample-hl0142/passages.json` |
| 1 Map | Passages | Policy map (`map.json`) | **Main gate** | Reference map hand-built |
| 2 Cards | Approved map + passages | Cards (`cards.json`) | Per section, risk-ordered | Reference cards hand-built |
| 3 Consolidate | Cards across sections | Deduplicated set, relations, conflicts, cross-document links | Changes only | Not started |
| 4 Validate | Passages + map + cards | Pass or a list of coded errors | Failures only | Built: `pipeline/validate.mjs` |

### 5.1 Pass 0 — structure

- Split into the smallest addressable blocks; keep each block's clause path (for example `4.2(b)(i)`).
- Link every block to its parent: list items to the sentence that introduces the list, paragraphs inside a list item to the item's first paragraph, table cells to the sentence before the table.
- Classify each passage: `normative`, `definitional`, `informative`, `navigational`, `reference`, `notice`; modality `obligation`, `prohibition`, `permission`, `guidance`. List items with no modal verb **inherit** the modality of their lead-in.
- Fingerprint each passage (clause ref + normalised text) so later versions can be matched.
- The coverage denominator is normative + definitional passages only.

Regex modality is a hint, not an answer ("may not use X and must instead use" is both); Pass 1 confirms it. The structure tree is deterministic and reliable.

### 5.2 Pass 1 — the policy map

The map is the cohesion mechanism. It is drafted by a model and **approved by a person before any card is written**, because fixing one map entry is cheaper than fixing forty cards.

| Map part | Purpose |
|---|---|
| `slots` | Planned cards with type, title and assigned passages. Shared patterns become one slot (one calculation with several parameters, not several near-identical cards) |
| `parameters` | Every stated number, once, with unit and the passages that state it |
| `inputs` | The data vocabulary conditions may use (`loan.dti_ratio`, `borrower.qualifying_income`) |
| `glossary` | Defined terms and where each is defined (local, external) |
| `actors` | Who performs procedure steps |
| `externalRefs` | Other documents or sections this one depends on |
| `coverage` | Normative passages deliberately without a card, each with a state and a reason |
| `issues` | Policy defects found while mapping |

### 5.3 Pass 2 — cards and the card contract

A card is valid when:

1. It fills exactly one map slot, and its type matches the slot.
2. Every evidence quote is a verbatim substring of a passage; offsets are computed, never trusted.
3. Every number comes from the parameter registry as `{{PARAM}}`.
4. Conditions use only registered inputs and parameters.
5. Rules and calculations meant to be executed carry `expr` and test cases that pass.
6. Anything not stated in the source is a field marked `inferred`, backed by an issue.
7. Branches inside a procedure point to rule cards instead of restating the condition.

Example (from `golden/sample-hl0142/cards.json`):

```json
{
  "slot": "dti-max", "type": "rule", "title": "Maximum back-end DTI",
  "fields": [
    { "key": "when", "value": "loan.dti_ratio > {{DTI_MAX}}." },
    { "key": "then", "value": "Permitted only if loan.dti_ratio <= {{DTI_MAX_WITH_FACTORS}} AND compensating factors are approved by a Senior Underwriter; otherwise the DTI limit is exceeded." }
  ],
  "expr": "i.loan.dti_ratio <= P.DTI_MAX ? 'within_limit' : (i.loan.dti_ratio <= P.DTI_MAX_WITH_FACTORS && i.file.factors_approved_by_senior_uw ? 'permitted_with_factors' : 'exceeds_limit')",
  "evidence": [{ "passageId": "p5", "quote": "The maximum back-end debt-to-income (DTI) ratio is 45%." }],
  "params": ["DTI_MAX", "DTI_MAX_WITH_FACTORS"],
  "tests": [{ "given": { "loan": { "dti_ratio": 0.48 }, "file": { "factors_approved_by_senior_uw": false } }, "expect": "exceeds_limit" }]
}
```

### 5.4 Pass 4 — validation

`npm run validate:cards -- <example>` runs these checks; any error fails the run.

| Code | Check |
|---|---|
| M1 | Every normative or definitional passage is in a slot or has a coverage state |
| M2 | Slot references (passages, external refs, issues, parameters) resolve |
| M3 | Every parameter value literally appears in each passage it cites |
| C1 | Card type matches its slot |
| C2 / C3 | Evidence is verbatim and stays inside the slot's planned passages |
| C4 | Required fields per card type |
| C5 / C5b | Parameters declared and used; hard-coded policy numbers flagged |
| C6 | Inputs come from the map vocabulary |
| C7 / C8 | Relations and issues resolve |
| C9 | Machine-evaluable cards have logic and passing tests |

Mutation-checked: a reworded quote, a wrong parameter value, a dropped passage, a hard-coded threshold and an unregistered input are each caught. A wrong parameter is caught twice, by M3 against the source and by C9 through the tests of every card that uses it.

## 6. Data contracts

### 6.1 Identity

| Field | Rule | Example |
|---|---|---|
| Short ID | type code + seq | `R-005` |
| Card ID | `PC-{policyKey}-{code}{seq}` | `PC-HL0142-R005` |
| URI | `pc://{seg2}/{seg1}-{seg3}/v{version}/{type}/{seq}` | `pc://hl/pol-0142/v3.1/rule/005` |

IDs are assigned by the decomposition adapter from the confirmed policy metadata, never by the UI. Planned (Q1): slot-based IDs plus passage fingerprints, so a new policy version re-flags only cards whose evidence changed.

### 6.2 Artifact (`policy-card/1.0`)

Key order: `schema, card_id, uri, type, title, policy, applicability, source, content, relations, retrieval, quality, review, content_hash`. Validated against `src/domain/schema/policy-card.schema.json` (JSON Schema 2020-12) in tests and again at publish time.

`content_hash = "sha256:" + hex(SHA-256(RFC 8785 canonical JSON of the artifact without quality, review and content_hash))`. Meaning changes the hash; review status and confidence do not.

### 6.3 Package manifest (`policy-card-package/1.0`)

Policy, publish time, counts, published cards with hashes, rejected cards, and uncovered passages with their acknowledgement state.

## 7. Architecture

```
┌──────────────── Review UI (Vite, React 19, TypeScript, Salt) ────────────────┐
│ screens: Load ─► Decompose ─► Review ─► Publish                              │
│ store:   one pure reducer + memoised selectors + debounced local draft       │
│ domain:  types · IDs · evidence · validation · artifact + hash · schema     │
│ adapters (the only I/O seam):                                                │
│   IngestAdapter          DecompositionAdapter          PublishAdapter        │
│   mock (sample doc)      mock (sample result)          local (validate,      │
│                                                         hash, export JSON)   │
└──────────────────────────────────────────────────────────────────────────────┘
        ▲ any source format                ▲ real LLM pipeline (planned)
┌───────┴─────────── Decomposition method (Node scripts) ──────────────────────┐
│ golden/<example>/passages.json · map.json · cards.json                       │
│ pipeline/validate.mjs                                                        │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Layer | Location | Notes |
|---|---|---|
| Domain | `src/domain/` | Pure functions; no React |
| Store | `src/store/` | Reducer enforces approval rules (blocking errors stop approval; reopening an error reverts approved cards) |
| Adapters | `src/adapters/` | `ingest`, `run` (with `AbortSignal` and stage events), `publish` / `exportFile` |
| App wiring | `src/app/` | Copy catalog, routes and guards, run controller (runs survive leaving the screen), publish packaging |
| Components | `src/components/` | Shell, cards (glyphs, badges), load, decompose, review, publish |
| Styling | `src/styles/palette.css` | The only file with raw colours; re-themes Salt tokens |
| Method | `golden/`, `pipeline/` | Reference data and validator |

The UI never imports the pipeline at run time. A real decomposition service plugs in by implementing `DecompositionAdapter` and returning a `DecompositionResult`.

## 8. Review workflow

| Step | Screen | Completes when |
|---|---|---|
| 1 Load policy | Upload, detected structure, policy metadata (validated), card types, granularity, checks | Document parsed and metadata valid |
| 2 Decompose | Five-stage pipeline, live counts, coverage by section, issues found | Run completed |
| 3 Review cards | Card list, source with highlighted evidence, card detail (Card, Lineage, Artifact tabs), issues | Every card decided and every uncovered passage acknowledged |
| 4 Publish | Artifacts table, sign-off checks, publish and export | Published or exported |

Rules enforced in the reducer and selectors:

- A card with an open blocking issue cannot be approved.
- Reopening a resolved blocking issue returns any approved card it is attached to to pending, with a notice.
- Bulk approve touches only pending cards that never had an issue.
- Publishing requires every card decided, no blocking issue on an approved card, every uncovered passage acknowledged, and at least one approved card.
- Steps are navigable only up to the first incomplete step; deep links redirect with "Finish this step first."
- Destructive actions (re-run, replace document, start over, publish) confirm first.
- State autosaves locally and restores after reload.

## 9. Quality

| Area | How it is checked |
|---|---|
| Types | `tsc --noEmit`, strict; a compile-time list of every Salt export used |
| Design tokens | `scripts/verify-tokens.mjs`: every `--salt-*` token exists in the imported theme, every `--pc-*` token is defined, no raw colours or Salt-internal selectors in product CSS |
| Lint | ESLint with typescript-eslint, react-hooks and jsx-a11y; user-facing text must come from the copy catalog |
| Unit and component | Vitest: 52 tests (domain, IDs, hashing, reducer rules, selectors, persistence, mocks, components) |
| End to end | Playwright: 78 tests across dev and production builds — Salt loading, shell, every screen state, full happy path with a schema-validated export, keyboard-only path, reload restore |
| Accessibility | axe on every screen and state (zero serious or critical), keyboard navigation, focus management, reflow at 390px, reduced motion |
| Visual | Guardrails (tinted canvas, rounded padded elevated panels, one primary action, no horizontal scroll) and screenshot baselines at 1440 and 390 |

`npm run verify` runs all of the above.

## 10. Non-functional requirements

- **Accessibility**: WCAG 2.2 AA; status, severity and type never by colour alone.
- **Traceability**: every card and artifact quotes its source verbatim; unverifiable evidence is flagged, never shown as fact.
- **Determinism**: the same input produces the same IDs and hashes.
- **Source material**: no third-party source text is stored in this repository; cached source text stays local and git-ignored.
- **Offline-capable UI**: fonts self-hosted; no external calls except through adapters.

## 11. Status

| Area | Status |
|---|---|
| Method (passes 0, 1, 2, 4) | Specified, piloted on a real public guide section, reference example in repo |
| Validator | Built, mutation-checked |
| Review UI, all four screens | Built and verified |
| Mock adapters | Built; deterministic, used by all tests |
| Real decomposition service | Not built |
| Pass 3 consolidation | Not started |

## 12. Roadmap

1. **Decomposition adapter**: an LLM service implementing passes 1 and 2 against the card contract, scored against reference sets with the validator (coverage, precision, contract violations, reviewer edit rate).
2. **Map review step** in the UI between Decompose and Review: approve slots, parameters and coverage before cards are generated.
3. **Agent fields in review**: show parameters, inputs, executable logic and test results on the Card tab.
4. **Stable IDs across versions** (Q1) using slots and fingerprints; review only changed cards.
5. **Edit before approval** (Q2) with a field-level edit log.
6. **Audit trail** (Q6): who decided what, when, and why (reject reasons, Q7).
7. **Multi-document packages** (Q5): resolve external references across documents.
8. **Publish target** (Q4): a real artifact store keyed on card ID and URI.
9. **Pass 3 consolidation**: deduplication, cross-section relations and conflict detection at document scale.

## 13. Open questions

| ID | Question |
|---|---|
| Q1 | Stable card IDs across versions (proposal in roadmap item 4) |
| Q2 | Inline editing before approval |
| Q4 | Where publish sends artifacts |
| Q5 | Packages spanning several source documents |
| Q6 | Reviewer identity and audit trail |
| Q7 | Whether rejecting requires a reason |

## 14. References

| Document | Role |
|---|---|
| `policy-cards-build-spec.md` (input) | UI behaviour, data model, IDs, gating, adapters, Salt loading, tests |
| `policy-cards-visual-agent.md` (input) | Visual system; overrides the build spec on colour, shape, spacing and density |
| [`SPEC-COMPLIANCE.md`](../SPEC-COMPLIANCE.md) | Requirement-by-requirement status with evidence |
| [`deviations.md`](deviations.md) | Every difference from the input specs, with reasons |
| [`approach.md`](approach.md) | Method notes and pilot findings |
| [`salt-api-notes.md`](salt-api-notes.md), [`spacing-map.md`](spacing-map.md) | Verified Salt APIs, tokens and spacing |
| [`presentation.html`](presentation.html) | Slide presentation of the idea and the implementation |
