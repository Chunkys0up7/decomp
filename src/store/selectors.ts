// Selectors (build spec 7.4). Pure functions of AppState (DATA-18). Ones that allocate are
// memoised on the identity of the state slices they read, so React re-renders stay cheap.
import { isMetaValid } from "../domain/meta";
import type { Card, Decision, Issue, Passage, Severity } from "../domain/types";
import type { AppState } from "./state";

const SEVERITY_RANK: Record<Severity, number> = { error: 3, warning: 2, info: 1 };

/** Memoise a one-argument selector on the identity of the values `deps` picks from state. */
function memo<R>(deps: (s: AppState) => readonly unknown[], fn: (s: AppState) => R): (s: AppState) => R {
  let lastDeps: readonly unknown[] | undefined;
  let last: R;
  return (s) => {
    const d = deps(s);
    if (!lastDeps || d.length !== lastDeps.length || d.some((x, i) => x !== lastDeps![i])) {
      last = fn(s);
      lastDeps = d;
    }
    return last;
  };
}

const cardsOf = (s: AppState): Card[] => s.result?.cards ?? [];
const issuesOf = (s: AppState): Issue[] => s.result?.issues ?? [];
const reviewDeps = (s: AppState) => [s.result, s.review.decisions, s.review.resolutions] as const;

export const decision = (s: AppState, c: Card): Decision => s.review.decisions[c.shortId] ?? "pending";
export const isOpen = (s: AppState, issue: Issue): boolean => !s.review.resolutions[issue.id];

export const issueById = (s: AppState, id: string): Issue | undefined => issuesOf(s).find((i) => i.id === id);

export const cardIssues = (s: AppState, c: Card): Issue[] =>
  c.issueIds.map((id) => issueById(s, id)).filter((i): i is Issue => i !== undefined);

export const openIssues = (s: AppState, c: Card): Issue[] => cardIssues(s, c).filter((i) => isOpen(s, i));

export const topOpenSeverity = (s: AppState, c: Card): Severity | null =>
  openIssues(s, c).reduce<Severity | null>((top, i) => (!top || SEVERITY_RANK[i.severity] > SEVERITY_RANK[top] ? i.severity : top), null);

export const isBlocked = (s: AppState, c: Card): boolean => openIssues(s, c).some((i) => i.severity === "error");

export const counts = memo(reviewDeps, (s) => {
  const cards = cardsOf(s);
  const tally = { total: cards.length, approved: 0, rejected: 0, pending: 0 };
  for (const c of cards) tally[decision(s, c)] += 1;
  return tally;
});

export const openIssueCount = (s: AppState): number => issuesOf(s).filter((i) => isOpen(s, i)).length;

export const openBlockingCount = (s: AppState): number =>
  issuesOf(s).filter((i) => i.severity === "error" && isOpen(s, i)).length;

export const openIssueBreakdown = memo(reviewDeps, (s) => {
  const out: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
  for (const i of issuesOf(s)) if (isOpen(s, i)) out[i.severity] += 1;
  return out;
});

export const cleanPendingCards = memo(reviewDeps, (s) =>
  cardsOf(s).filter((c) => decision(s, c) === "pending" && c.issueIds.length === 0),
);

export const needsAttention = memo(reviewDeps, (s) =>
  cardsOf(s).filter((c) => decision(s, c) === "pending" && openIssues(s, c).length > 0),
);

export const decidedCards = memo(reviewDeps, (s) => cardsOf(s).filter((c) => decision(s, c) !== "pending"));

export const passageCards = (s: AppState, p: Passage): Card[] =>
  cardsOf(s).filter((c) => c.evidence.some((e) => e.passageId === p.id));

export const uncoveredPassages = memo((s) => [s.result], (s) =>
  (s.result?.passages ?? []).filter((p) => passageCards(s, p).length === 0),
);

export const passageLevelIssues = (s: AppState, p: Passage): Issue[] =>
  issuesOf(s).filter((i) => i.cardIds.length === 0 && i.passageId === p.id);

export const passageOpenIssues = (s: AppState, p: Passage): Issue[] => {
  const fromCards = passageCards(s, p).flatMap((c) => openIssues(s, c));
  const fromPassage = passageLevelIssues(s, p).filter((i) => isOpen(s, i));
  return [...new Map([...fromCards, ...fromPassage].map((i) => [i.id, i])).values()];
};

export const usedBy = (s: AppState, card: Card): Card[] =>
  cardsOf(s).filter((c) => c.relations.some((r) => r.shortId === card.shortId));

export const dependsOn = (s: AppState, card: Card): Card[] =>
  card.relations.map((r) => cardsOf(s).find((c) => c.shortId === r.shortId)).filter((c): c is Card => c !== undefined);

export const publishGates = memo(reviewDeps, (s) => {
  const cards = cardsOf(s);
  const passageIssues = issuesOf(s).filter((i) => i.cardIds.length === 0 && i.passageId);
  return {
    allDecided: cards.every((c) => decision(s, c) !== "pending"),
    noBlockingOnApproved: cards.every((c) => decision(s, c) !== "approved" || !isBlocked(s, c)),
    uncoveredAcknowledged: passageIssues.every((i) => !isOpen(s, i)),
  };
});

export const canPublish = (s: AppState): boolean => {
  const g = publishGates(s);
  return g.allDecided && g.noBlockingOnApproved && g.uncoveredAcknowledged && counts(s).approved > 0;
};

export const selectedCard = (s: AppState): Card | undefined =>
  cardsOf(s).find((c) => c.shortId === s.review.selectedCardId);

// Step completion (build spec 5.2). isMetaValid lives in the domain so the Load screen and the
// stepper agree on one rule.
export type Step = 1 | 2 | 3 | 4;

export const stepComplete = (s: AppState, step: Step): boolean => {
  switch (step) {
    case 1:
      return s.document.status === "ready" && isMetaValid(s.meta);
    case 2:
      return s.run.status === "completed" && s.result !== undefined;
    case 3: {
      const g = publishGates(s);
      return stepComplete(s, 2) && g.allDecided && g.uncoveredAcknowledged;
    }
    case 4:
      return s.publish.status === "published" || Boolean(s.publish.exported);
  }
};

/** UI-07: the furthest reachable step is the first incomplete one (4 when steps 1-3 are complete). */
export const furthestStep = (s: AppState): Step => {
  for (const step of [1, 2, 3] as const) if (!stepComplete(s, step)) return step;
  return 4;
};

/** A completed step always shows as complete (spec 9.4.5 item 3); `aria-current` still marks the screen you are on. */
export const stepStatus = (s: AppState, step: Step, current: Step): "complete" | "current" | "upcoming" =>
  stepComplete(s, step) ? "complete" : step === current ? "current" : "upcoming";

export const isStepNavigable = (s: AppState, step: Step): boolean => step <= furthestStep(s);
