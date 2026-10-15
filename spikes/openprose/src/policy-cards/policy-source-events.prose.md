---
name: policy-source-events
kind: gateway
version: 0.1.0
---

# Policy Source Events

### Continuity

- external-driven

### Receives

- Manual: a reviewer loads a policy document version
- Event: source-version-published (a new effective version of a loaded document)

### Maintains

- `source-document`: the latest version of one policy document as structured
  truth: document id, section id, version, effective date, and the source body
- immaterial: delivery ids, fetch timestamps, transport headers

### Emits

- policy-structure

### Payload

One document version per event: the document and section identifiers, the
version label and effective date, and the body in its native markup. Re-sending
an identical version is legal and must not cause downstream work.
