# Pipeline re-check — Specification (Phase 9)

Status: built (`runtime/pipeline.mjs`, `runtime/diff.mjs`). Requirement IDs P1–P7 are tracked in `SPEC-COMPLIANCE.md`. Builds on the card runtime (`docs/specs/card-runtime.md`).

## Purpose

A new policy version lands. Every loan in the pipeline has to be re-assessed, and the people who look after those loans need to know exactly which loans changed, which cards moved and why — not a list of every loan. Phase 9 re-checks a whole pipeline against the current library, re-runs only what moved, explains each change at card level and queues the loans a person must look at.

```
library changes (new bundle / adoption) ──► recheck ──► per loan: memo hit → skipped
                                                          │          new bundle or data → re-render → diff vs last decision
                                                          │          closed / sold → impact only (nothing recorded)
                                                          ▼
                                             report + review queue + run receipt
```

## P1 Pipeline manifest `loan-pipeline/1.0`

```json
{ "schema": "loan-pipeline/1.0",
  "lender": { "as_of_rule": "note_date", "adopt": ["POL-HL-0142@3.2"] },
  "loans": [ { "file": "loans/L-2001.json", "status": "in_process" },
             { "file": "loans/L-2005.json", "status": "sold" } ] }
```

- `status`: `in_process`, `closed` or `sold`. Loan files resolve relative to the manifest.
- `lender` holds the lender's version policy in one place, so every loan in a run uses the same as-of rule and the same early adoptions. CLI flags (`--adopt`, `--as-of`) override it for a what-if run.

## P2 Re-check run

`recheck(library, pipeline, {store, adopt, asOfRule})`, CLI `recheck --pipeline --library [--store]`:

| Loan status | Behaviour |
|---|---|
| `in_process` | Checked through `checkLoan` with the store. The memo (card-runtime R6) skips a loan whose inputs, selected bundle and selection key are unchanged; adding an unrelated bundle does not invalidate it. Otherwise the loan re-renders and its receipt chain grows. Mode: `first` (no earlier decision), `rendered` or `skipped`. |
| `closed`, `sold` | **Impact only**: evaluated against what would be selected now and compared with the last recorded decision. Nothing is written; the loan's receipts are untouched, because its decision is frozen. Mode: `impact`. |

With a store, each run appends a `pipeline-recheck` receipt to `<store>/pipeline/receipts.jsonl`: `contract_fingerprint` = library fingerprint (token of the sorted bundle hashes), `input_fingerprints {lender, loans}`, `fingerprints {report}`, `totals`, `loan_receipts[]`, chained by `prev`.

## P3 Step-level diff

`diffDecisions(prev, next)` matches steps on `(slot, item)` and gives each one class, in priority order:

| Class | Meaning |
|---|---|
| `result_changed` | Result or status differs. Flags `card_changed` and `inputs_changed` say why |
| `card_changed` | Same result, but the card fingerprint moved (rewrite or parameter change) |
| `inputs_changed` | Same card and result, different inputs used (data or an upstream result moved) |
| `unchanged` | Same card, inputs and result — the reused case |
| `added`, `removed` | The step exists on one side only |

Also: version and outcome before/after, `assumptions_added` (new open issues relied on) and `outstanding_added` (new inputs or decisions needed).

## P4 Review queue

A loan is queued with one reason, most urgent first:

| Reason | When |
|---|---|
| `newly_incomplete` | Now `incomplete`, was not |
| `outcome_changed` | Outcome differs |
| `would_change` | Closed or sold, and the current library would change its decision (repurchase-risk view) |
| `result_changed` | Outcome held, but a step's result or status moved, or steps were added or removed |
| `new_assumption` | Only new assumptions |

Skipped loans, first checks and loans whose steps are only `card_changed`/`inputs_changed`/`unchanged` are not queued: the cards were re-validated against the loan and nothing it decides moved. The queue never approves anything.

## P5 Report `pipeline-report/1.0`

`{schema, library_fingerprint, lender, totals {loans, checks, first, rendered, skipped, impact_only, queued}, loans: [{loan_id, status, policy, mode, version, outcome, decision, receipt?, diff?, queue_reason}], queue: [...], report_hash, receipt?}`.

- `diff` lists the steps that moved and the slots that did not.
- `report_hash` covers everything except receipt ids (which carry timestamps); the same library, pipeline and store state give the same hash.
- No policy text: slots, fingerprints, results and passage-free reasons only.
- CLI: a summary table and the queue with per-step reasons; `--json` prints the report; `--out` writes it.

## P6 Agent

The `loan-check` skill's pipeline section: run `recheck` after a library change; lead with the queue; explain each queued loan from its diff (which card moved, whether its card or its inputs changed, the result before and after, new assumptions); do not re-run single loans to confirm; treat `would_change` on sold loans as a flag for a person.

## P7 Out of scope

Watching the library (a scheduler calls `recheck`); notifying loan officers; an HTML view; lender overlays (Phase 10).

## Verification

`runtime/pipeline.test.mjs`: first run and memo skips with chained run receipts; a new bundle re-renders only loans that select it, with unchanged cards reported as such; early adoption queues the outcome flip; sold loans are impact-only with untouched receipts; newly incomplete loans lead the queue; determinism; the text summary. Fixture: `runtime/fixtures/pipeline.json` (fictional).
