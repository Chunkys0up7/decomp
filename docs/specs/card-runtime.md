# Card runtime and loan agent — Specification (Phase 8)

Status: built (`runtime/`). Requirement IDs R1–R8 are tracked in `SPEC-COMPLIANCE.md`.

## Purpose

Phases 0–7 turn a policy document into reviewed cards. This phase lets an agent **apply** those cards to a case file — for a mortgage lender, a loan file — and record a decision a reviewer, a QC team or an examiner can trace back to the exact policy version, card and passage.

The runtime is deterministic. It does not interpret policy text, does not fill in missing data and does not decide anything a card does not decide. The agent around it maps a case into the input vocabulary, runs the runtime and explains its output.

```
policy map + cards ──validate──► runtime bundle (per version) ──► library
                                                                    │ select version (as-of date, early adoption)
loan file ──────────────────────────────────────────────────────────┤
                                                                    ▼
                                   evaluate cards in dependency order ──► decision record ──► receipt
                                                                                  │
                                                         explain ◄────────────────┘ (agent answers from this)
```

## R1 Runtime bundle `policy-card-runtime/1.0`

An executable, immutable snapshot of one policy version, built from a policy map and card set **only after** Pass 4 validation passes (`buildBundle` refuses otherwise).

| Field | Content |
|---|---|
| `policy` | `id`, `version`, `effectiveFrom`, optional `effectiveTo` and `supersedes` |
| `parameters` | `{ID: {value, unit}}` from the registry |
| `inputs` | The input vocabulary: `{path: {type, values?, optional?, meaning?}}` |
| `issues` | `{ID: {severity, blocking, title, passages}}`; `blocking` = severity `error` |
| `cards[]` | In evaluation order. `slot, type, title` (placeholders resolved), `expr?`, R2 fields, `inputs`, `params`, `resolved_params`, `relations`, `issues`, `evidence [{passageId, quote}]`, `machineEvaluable`, `tests`, `card_fingerprint` |
| `bundle_hash` | `sha256:` + SHA-256 of the RFC 8785 canonical bundle without the hash |

`card_fingerprint` is the 16-hex token of the card including `resolved_params`, so a parameter change moves it even when the card text says `{{PARAM}}`. `loadLibrary` recomputes every hash and fingerprint and refuses a bundle edited after it was built.

The published review artifact (`policy-card/1.0`) is unchanged: it is the human record. Whether it should also carry executable fields is open question Q12.

## R2 Card contract additions

All optional. A card without them behaves as before.

| Field | Meaning |
|---|---|
| `applies_when` | Boolean expression. False makes the card `not_applicable`. (The top-level, executable counterpart of a calculation's `applies_when` text field.) |
| `over` | A `collection` input. The card runs once per item; the item is `i.<singular>` (`liabilities` → `i.liability`) |
| `item_when` | Per-item filter; items it rejects produce no step |
| `binds` | The input path the card's result is written to, for later cards. Per-item cards bind an item field (`liability.qualifying_payment`) |
| `result_severity` | `{result: pass \| condition \| fail \| info}`. Results not listed are `info` |

Input vocabulary additions: types `collection`, `integer`, `number`, `date`, `text` and `T[]`; `optional: true` marks inputs whose absence is meaningful (read as `undefined`, for `??`).

New Pass 4 checks:

| Code | Check |
|---|---|
| C10 | `expr`, `applies_when` and `item_when` use only the allow-list: `i.<path>`, `P.<ID>`, `Math`, literals, arrow functions, `const`/`let`/`return`/`if`, and the members `reduce map filter some every find includes length max min round floor ceil abs`. `expr` reads only declared `inputs` and `params`; fields read on an item inside `reduce`/`map` are registered on a collection the card reads |
| C11 | `binds` targets a registered path the card does not itself read; a path has one binder, except per-item cards over the same collection that each filter with `item_when`; the binds → reads graph has no cycle (the error names the cards on it); `result_severity` values are valid |
| C12 | Every test `given` value is a registered input of the right type, inside its enum |

C9 tests now run in the same sandbox as the runtime.

## R3 Evaluation semantics

1. **Order.** Card A runs after card B when A reads a path B binds, reads the collection B runs over, or states `depends_on` B. Ties keep the card set's order (document order). Cycles are rejected at validation.
2. **Inputs.** The loan file's facts and collections are copied; bound results are written into the copy. Every read is recorded in the step's `inputs_used`. A read of a required input that is absent raises `needs_input` — **the runtime never defaults a value**. A read outside the vocabulary is an `error` (validated bundles never do this).
3. **Step status**, exactly one of:

   | Status | When |
   |---|---|
   | `evaluated` | The expression ran; `result` and `severity` recorded |
   | `not_applicable` | `applies_when` was false |
   | `needs_input` | A required input is missing. `missing` names it (`liabilities[0].months_remaining`); `blocked_by` names the card that should have bound it, so only the root cause is outstanding |
   | `refer_to_person` | `reason`: `procedure` (a person carries it out; severity condition), `fact` (information only), `not_machine_evaluable`, or `blocking_issue` (an open issue of severity error) |
   | `error` | The expression threw, exceeded 50 ms, returned a non-finite number, or two per-item cards claimed the same item |

4. **Assumptions.** An evaluated card with open non-blocking issues lists them under `assumptions`, so an answer can say "this assumes ISS-04".
5. **Discrepancy.** When the loan file already holds a value a card binds and the computed value differs, the computed value is used and the step records `discrepancy {path, supplied, computed}`.
6. **Outcome**, in order: `fail` if any step's severity is fail; `incomplete` if anything needs input, errored, or needs a person's decision (`blocking_issue`, `not_machine_evaluable`); `condition` if the worst severity is condition (including procedures to carry out); `pass` if it is pass; otherwise `not_applicable`: no card with a pass, condition or fail effect applied (the loan is outside the policy's scope, or only informational cards applied — for example manual-underwriting limits on a loan underwritten another way).
7. **Determinism.** No clock, randomness or environment reads. The same loan file and bundle give the same `decision_hash`.
8. **Sandbox.** Expressions run in a separate V8 context with string code generation disabled and a 50 ms limit. This is defence in depth; the trust root is that only validated, reviewed bundles run.

## R4 Version selection

- A **library** is a directory of `*.bundle.json` files, possibly for several policies. A check evaluates every policy in it (or one, with `--policy`).
- The **as-of date** is the loan's `note_date`, falling back to `application_date` (`--as-of application_date` reverses this). The rule used is recorded.
- The governing version is the one with the latest `effectiveFrom` on or before the as-of date, within `effectiveTo` if set.
- **Early adoption**: `--adopt POLICY@VERSION` selects that version regardless of date; the decision records "adopted early" when its effective date is after the as-of date.
- **Fails closed**: no version in force (or an adopted version missing from the library) gives outcome `no_policy_in_force`, never a guess.

## R5 Loan file and decision record

`loan-file/1.0`:

```json
{ "schema": "loan-file/1.0", "loan_id": "L-2001",
  "as_of": { "note_date": "2026-03-01", "application_date": "2026-01-20" },
  "facts": { "loan": { "type": "conventional" }, "borrower": { "qualifying_income": 6000 } },
  "collections": { "liabilities": [ { "type": "revolving", "balance": 3000 } ] } }
```

`loan-decision/1.0`: `schema, loan_id, policy {id, version, bundle_hash}, selection {policy, rule, as_of, considered[], adopted, version, reason}, steps[], outcome, outstanding[], decision_hash`. Each step: `slot, item?, card_fingerprint, status, result, severity?, inputs_used, params_used, evidence [passageId], issues, assumptions?, discrepancy?, missing?, blocked_by?, reason?, error?`.

Decisions cite passage IDs only. Quotes live in the bundle; `explain --quotes` prints them.

## R6 Receipts

With a store (`--store <dir>`), each check appends a `loan-check` receipt to `<store>/loans/<loan_id>/receipts.jsonl` and saves the decision under `decisions/<hash>.json`:

`node, loan, policy, contract_fingerprint (bundle_hash), input_fingerprints {loan, selection}, fingerprints {decision}, semantic_diff {version, outcome} vs the previous receipt for this policy, version, outcome, status, at, prev, sig, id`.

**Memo**: if the last receipt for this loan and policy has the same bundle, loan inputs and selection, the stored decision is returned and a `skipped` receipt appended — nothing is recomputed. A new bundle (a policy update or an adoption) or changed loan data re-renders. This is the hook Phase 9 uses to re-check a pipeline when a policy changes.

## R7 Interfaces

- **JS API** (`runtime/index.mjs`): `buildBundle`, `buildBundleFromDir`, `verifyBundle`, `loadLibrary`, `selectBundle`, `parseAdopt`, `evaluate`, `checkLoan`, `explain`, `readReceipts`.
- **CLI** (`node runtime/cli.mjs`, or `npm run loan:check -- …`):
  - `bundle <dir> --out <file> [--effective-to D] [--supersedes V]` — exit 2 if the set fails validation
  - `check <loan.json>... --library <dir> [--adopt P@V]... [--as-of rule] [--policy ID] [--store <dir>] [--json] [--quotes]`
  - `explain <decision.json> --library <dir> [--quotes]`
- **Agent**: the project skill `.claude/skills/loan-check/SKILL.md`. The agent session drives the CLI (as OpenProse runs its VM in-session). Rules: never compute a policy result itself; answer only from `check`/`explain` output, citing slot, card fingerprint and passages; turn `outstanding` items into questions for a person; never invent input values — when mapping a free-form loan description into a loan file, show the mapping and get it confirmed before running.

## R8 Out of scope

Phase 9 pipeline re-check when a bundle is superseded; Phase 10 lender overlays; Phase 11 multi-document packages; an MCP server; review-UI integration (try a loan on the Card tab, roadmap item 3); the LLM decomposition service.

## Verification

- `npm run validate:cards -- sample-hl0142` passes with the R2 fields; `runtime/runtime.test.mjs` covers C10–C12 mutations, bundle determinism and tamper detection, every step status, collections, version selection, early adoption, receipts and memo skips, and `explain`.
- Fixtures are fictional: `runtime/fixtures/sources/` (POL-HL-0142 v3.2), `runtime/fixtures/library/` (built bundles for 3.1 and 3.2; a test asserts they match a fresh build) and `runtime/fixtures/loans/`.
- Real-source acceptance runs locally against git-ignored data, per the source-material rule in `docs/SPEC.md` 10.
