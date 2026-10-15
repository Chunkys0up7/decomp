---
name: policy-card-functions
kind: function
version: 0.1.0
---

# Policy Card Functions

Helper functions called by the policy-cards responsibilities. Deterministic ones
are host tools (see `spikes/openprose/vm.mjs`); `draft-map-changes` and
`write-slot-card` are model work.

### Description

- `segment-passages` (tool): split source markup into passages with clause
  references, parent links, kind and modality (Pass 0 in `docs/SPEC.md` 5.1)
- `match-passage-keys` (tool): carry stable keys from the prior version by
  fingerprint, then by best text match within the same clause
- `diff-passages` (tool): list passages added, removed or changed by key
- `draft-map-changes` (model): update the prior map for the changed passages
  only, following the policy-map strategies
- `select-dirty-slots` (tool): compute each slot's memo key and split slots into
  reused and dirty
- `write-slot-card` (model): write one card for a dirty slot under the card
  contract, starting from its prior card when there is one
- `validate-card-set` (tool): run `pipeline/validate.mjs` checks for the given
  scope

### Invariants

- Tools are deterministic: the same inputs give byte-identical outputs.
- Model functions return structured JSON; free text is never fingerprinted.

### Shape

- `prohibited`: model functions deciding whether something changed; that is a
  fingerprint comparison, made by tools
