---
name: policy-cards
kind: responsibility
version: 0.1.0
---

# Policy Cards

### Goal

Every planned slot that has been authored has one controlled card an agent can
act on, and a card is rewritten only when something it depends on changed.

### Requires

- `passages`: the keyed passages of the current version
- `slots`: the planned card slots
- `parameters`: the parameter registry
- `inputs`: the input vocabulary
- `issues`: the policy issues cards may cite

### Maintains

- `cards`: one card per authored slot, following the card contract
  (`docs/SPEC.md` 5.3)
- immaterial: authoring notes, field ordering

#### cards

Material: per card, its slot, type, title, fields, expr, evidence, inputs,
params, relations, issues, machine-evaluable flag and tests.
Postcondition: the whole set passes `validate-card-set` (C1 to C9); a set that
fails commits nothing and the last good cards stand.

### Continuity

- input-driven: any subscribed facet moved

### Invariants

- Card memo key per slot = (slot definition, fingerprints of the passages the
  slot and its evidence cite, values of the parameters it uses). A slot whose
  memo key did not move reuses its prior card unchanged.
- Evidence is quoted verbatim from the current passages.
- Numbers come from the registry as `{{PARAM}}`, never typed into card text.

### Shape

- `self`: decide which slots are dirty, reuse the rest, assemble the set
- `delegates`: `write-slot-card` writes one dirty slot's card
- `prohibited`: editing the map, parameters or vocabulary from here

### Tools

- `validate-card-set`: deterministic card checks (C1 to C9)

### Execution

```prose
let dirty = call select-dirty-slots
  slots: slots
  passages: passages
  parameters: parameters
  prior-cards: cards

let rewritten = []
for slot in dirty.slots:
  let card = call write-slot-card
    slot: slot
    passages: passages
    parameters: parameters
    inputs: inputs
    issues: issues
    prior-card: dirty.prior[slot.slot]
  rewritten = rewritten + [card.card]

let checked = call validate-card-set
  passages: passages
  cards: dirty.reused + rewritten
  scope: "cards"

return {
  cards: dirty.reused + rewritten
}
```
