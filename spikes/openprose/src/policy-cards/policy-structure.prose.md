---
name: policy-structure
kind: responsibility
version: 0.1.0
---

# Policy Structure

### Goal

The loaded policy section is available as addressable passages whose keys stay
stable across document versions, so a new version re-flags only what changed.

### Requires

- `source-document`: the latest version of the policy document

### Maintains

- `passages`: every addressable block of the current version (paragraph, list
  item, table cell) with a stable key, clause reference, parent key, kind,
  modality, defined terms, cross-references, text and fingerprint
- material: key, ref, parent, kind, modality, text
- immaterial: positional ids within one version, fetch timestamps
- postcondition: every passage carries a key; keys are unique
- postcondition: a passage whose clause reference and text are unchanged keeps
  its key from the prior version; a changed passage keeps the key of the prior
  passage it best matches within the same clause; anything else gets a new key

#### passages

Material: the keyed passage list. Downstreams subscribe here and wake only when
some passage's material content moves.

### Continuity

- input-driven: a new `source-document` fingerprint

### Invariants

- Passage text is copied verbatim; nothing is summarised or normalised beyond
  whitespace.
- Splitting and classification are deterministic; no model call decides
  structure.

### Tools

- `segment-passages`: deterministic splitter for the source markup
- `match-passage-keys`: deterministic key carry-over across versions

### Execution

```prose
let segmented = call segment-passages
  source-document: source-document

let keyed = call match-passage-keys
  current: segmented.passages
  prior: passages

return {
  passages: keyed.passages
}
```
