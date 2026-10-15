# Spike: policy cards as an OpenProse program

Question: does [OpenProse](https://github.com/openprose/prose)'s responsibility runtime give
Policy Cards incremental re-decomposition across document versions (open question Q1) and an
audit trail (Q6) without building them ourselves?

Answer from the proof of concept: **yes, for the run model.** Treat it as a design to adopt,
not yet a dependency (see Findings).

## What is here

| Path | What |
|---|---|
| `src/policy-cards/*.prose.md` | The program in Contract Markdown: a gateway, four responsibilities, helper functions |
| `vm.mjs` | The deterministic half of the OpenProse VM for this program: compile, canonicalise + fingerprint facets, memo/skip, commit gated on `pipeline/validate.mjs`, receipt ledgers, propagation of moved facets only |
| `report.mjs` | HTML report generated from the receipt ledgers and content-addressed world-model versions |

OpenProse has no binary: `prose run` is an agent session acting as the VM. Here the session did
the model renders (map changes, card rewrites) and `vm.mjs` did everything OpenProse assigns to
the deterministic run phase.

```
policy-source-events ──source-document──► policy-structure ──passages──► policy-map
                                                   │                          │ slots, parameters,
                                                   └──────passages──────┐     │ inputs, issues
                                                                        ▼     ▼
                                                                    policy-cards ──cards──► review-queue
```

## Proof of concept (run locally; source text is not committed)

Run on a real public guide section and its real future-effective version (142 passages):

| Run | Result |
|---|---|
| 1. Load current version | Every node rendered; 13 reference cards committed after validation; 13 queued as new |
| 2. Re-send the same version | One `skipped` receipt at the gateway; nothing else woken |
| 3. Load the future version | 139 of 142 passages kept their keys although 140 were renumbered; map re-rendered (only `inputs`, `coverage`, `issues` moved; `slots` and `parameters` did not); **1 card rewritten, 12 reused**; review queue: 1 changed + 2 dependents |
| Fault drill | A model render with a paraphrased quote failed the validator: `failed` receipt, last good cards kept, review queue never woken |

To reproduce with your own document: produce a passages file (Pass 0), then

```bash
node spikes/openprose/vm.mjs compile --root local/poc/prose-root
node spikes/openprose/vm.mjs wake --root local/poc/prose-root --payload <passages.json> --label "<version>" --map-render <map.json> --card-renders <cards.json>
node spikes/openprose/report.mjs --root local/poc/prose-root --out local/poc/report.html
```

`local/` is git-ignored.

## Findings

1. **The reconciler model fits exactly.** Memo key = (contract fingerprint, input facet
   fingerprints) gave free no-op re-runs, and facet-level subscriptions stopped irrelevant work
   (cards did not re-plan because `slots` did not move).
2. **Stable keys are the real work.** Passage IDs shift when anything above them changes. Keys
   carried by exact (clause, text) match, then best match within the same clause, handled a real
   version cleanly once duplicate sentences in tables were matched in order.
3. **Per-slot memo inside a render** (slot definition + cited passage text + parameter values) is
   what turns "the cards node woke" into "one card rewritten". OpenProse's node-level reconciler
   needs this second level inside fan-out nodes.
4. **Commit gating must be code.** Contract postconditions are prose; our validator is what made
   the failed render safe. In OpenProse terms it is the compiled postcondition validator.
5. **Receipts are a usable audit trail as-is**: who/what woke a node, which inputs it saw, what
   moved, what was reused.
6. **Not ready as a dependency**: young language (breaking vocabulary change in its last major
   update), alpha reference harness, default model gateway needs review for regulated data.

## Recommendation

Adopt the model (facets, fingerprints, memo keys, receipts, validator-gated commits) in the
real decomposition service, keeping contracts in Contract Markdown so an OpenProse harness can
run them later. Revisit using OpenProse directly when its harness stabilises.
