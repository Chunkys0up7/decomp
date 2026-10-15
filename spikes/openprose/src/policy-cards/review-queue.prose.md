---
name: review-queue
kind: responsibility
version: 0.1.0
---

# Review Queue

### Goal

Reviewers see exactly the cards that need a human decision because of this
version, and nothing they already approved that did not change.

### Requires

- `cards`: the current card set

### Maintains

- `queue`: cards needing review, each with a reason (`new`, `changed`,
  `removed`, `upstream-changed`) and what moved
- immaterial: queue ordering, display text

#### queue

Material: the set of (card slot, reason, moved fields).
Postcondition: every card whose material content moved is in the queue;
cards whose content did not move are not, unless a card they depend on moved
(`upstream-changed`).

### Continuity

- input-driven: the `cards` facet moved

### Invariants

- Approval state lives with reviewers, not here; the queue never approves.
