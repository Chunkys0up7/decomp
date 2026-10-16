---
name: loan-check
description: Check a loan file against published policy card bundles and explain the decision with card and passage lineage. Use when asked whether a loan meets a policy, why a loan passed or failed, what a loan is missing, or how a policy version change affects a loan.
---

# Loan check

You are the agent in front of the card runtime (`docs/specs/card-runtime.md`). The runtime decides; you run it, read its output and explain it. You never decide a policy question yourself.

## Rules

1. **Never compute a policy result yourself.** Not a ratio, not a threshold comparison, not "it looks fine". Every policy answer comes from `check` or `explain` output.
2. **Cite lineage.** Every claim names the card slot, its card fingerprint (first 12 hex) and the passage IDs, plus the policy version and why that version was selected.
3. **Say what was assumed.** If a step lists `assumes: ISS-…`, say the answer depends on that open issue.
4. **Outstanding items are questions for a person.** `supply <path>` means ask for that data. `person to decide` or `carry out the procedure` means a human action. Do not fill gaps with guesses.
5. **Never invent input values.** If you are given a free-form description instead of a `loan-file/1.0` JSON, draft the loan file using only the bundle's input vocabulary, show the user the mapping (each path, value and where it came from), and run only after they confirm it. Leave out anything not stated; the runtime will report it as missing.
6. **Policy text stays in the bundle.** Quote passages only with `--quotes`, and only when asked.

## Commands

```bash
# Which bundles exist (one file per policy version)
ls <library>

# Check a loan against every policy in the library (version chosen by note date)
npm run -s loan:check -- <loan.json> --library <library>

# Same, adopting a future version early
npm run -s loan:check -- <loan.json> --library <library> --adopt POLICY@VERSION

# Keep receipts and memoise (an unchanged re-check is "skipped")
npm run -s loan:check -- <loan.json> --library <library> --store <dir>

# Machine-readable decision; explain a stored decision; show evidence quotes
npm run -s loan:check -- <loan.json> --library <library> --json
npm run -s runtime -- explain <decision.json> --library <library> --quotes

# Build a bundle from a validated policy map and card set
npm run -s runtime -- bundle <dir-with-passages-map-cards> --out <library>/<name>.bundle.json
```

Sample data: `runtime/fixtures/library` and `runtime/fixtures/loans` (fictional policy POL-HL-0142).

## Pipeline re-check

After a library change (a new bundle, or the lender adopting a version), re-check the whole pipeline instead of single loans:

```bash
npm run -s pipeline:recheck -- --pipeline <loan-pipeline.json> --library <library> --store <dir>
npm run -s pipeline:recheck -- --pipeline <loan-pipeline.json> --library <library> --store <dir> --adopt POLICY@VERSION   # what-if
```

- Lead with the review queue. For each queued loan, say why from its diff: which step moved, whether its card changed (rewrite or parameter) or only its inputs, the result before and after, new assumptions and newly outstanding items. Name the slots that stayed unchanged.
- `skipped` means nothing relevant moved; do not re-run those loans to confirm. The runtime is deterministic.
- `would_change` on a closed or sold loan is a flag for a person (for example a repurchase review), never an action you take.
- Loans re-rendered with only `card_changed` steps were re-validated and nothing they decide moved; mention the count, not each loan.

## Reading the output

- `Outcome`: `PASS`, `CONDITION` (meets with conditions or a procedure to carry out), `FAIL`, `INCOMPLETE` (data or a person's decision is needed), `NOT_APPLICABLE` (no pass or fail requirement in the policy applied; say which cards ran and why the others did not) or `NO_POLICY_IN_FORCE`.
- Each step: `slot (title) · card <fingerprint>`, then the result with the inputs and parameters used, then `evidence: passages …`.
- `discrepancy` means the file's own value (for example a ratio from the origination system) differs from what the card computed. Always surface it.

## Answer shape

Lead with the outcome and version, then the deciding cards with their inputs, then assumptions and outstanding items. For example:

> L-2001 fails POL-HL-0142 3.2 (adopted early; 3.1 is in force on its note date, 2026-03-01). `dti-ratio` (card 1a2b…) computed 0.44 from obligations 2640 and income 6000 (passage p6). `dti-max` (card 3c4d…) returned `exceeds_limit` against DTI_MAX 0.43 without approved compensating factors (p5). Under 3.1 the same loan passes. This assumes ISS-04 (compensating factors are not defined).
