---
name: policy-map
kind: responsibility
version: 0.1.0
---

# Policy Map

### Goal

The whole document has one reviewed plan before any card is written: planned
card slots, one registry for every stated number, an input vocabulary, explicit
coverage of every obligation, and the policy defects found along the way.

### Requires

- `passages`: the keyed passages of the current version

### Maintains

- `map`: the policy map for the current version (see `docs/SPEC.md` 5.2)
- immaterial: authoring notes, ordering of entries within a facet

#### slots

Material: planned cards (slot id, type, title, passage keys, external refs).
Postcondition: every normative or definitional passage key is in a slot or has
a coverage state (validator M1); slot references resolve (M2).

#### parameters

Material: every number the policy states, with value, unit and passage keys.
Postcondition: each value literally appears in every passage it cites (M3).

#### inputs

Material: the data vocabulary conditions may use.

#### coverage

Material: passages deliberately without a card, each with a state and reason.

#### issues

Material: policy defects with severity, kind, passages, detail and fix.

### Continuity

- input-driven: the `passages` facet moved

### Invariants

- The prior map is the starting point: entries are carried forward unless a
  passage they cite changed or disappeared.
- A changed passage is re-read in full; a slot is never re-planned from a diff
  alone.
- Material map changes are marked for human approval before cards rely on them.

### Strategies

- when a cited passage disappears: move the slot to coverage with state
  `removed` and raise an issue rather than silently dropping it
- when a number in a cited passage changes: update the parameter value, never
  the cards
- when new passages are revision notes or navigation: give them a coverage state
  instead of a slot

### Tools

- `validate-card-set`: deterministic map checks (M1 to M3)

### Execution

```prose
let changes = call diff-passages
  current: passages
  prior-map: map

let drafted = call draft-map-changes
  changes: changes.changed-passages
  prior-map: map

let checked = call validate-card-set
  passages: passages
  map: drafted.map
  scope: "map"

return {
  slots: drafted.map.slots,
  parameters: drafted.map.parameters,
  inputs: drafted.map.inputs,
  coverage: drafted.map.coverage,
  issues: drafted.map.issues
}
```
