// The one reducer (build spec 7.3). Pure: no side effects, new objects only (RED-12).
import { validateResult } from "../domain/validate";
import type { DecompositionResult } from "../domain/types";
import type { Action } from "./actions";
import { decision, isBlocked, isOpen, issueById, openIssues } from "./selectors";
import { initialStages, initialState, type AppState } from "./state";

const INVALID_RESULT = { message: "The decomposition result was invalid.", retryable: false };

/** RED-08 / RED-11: everything downstream of the document and setup. */
function clearDownstream(s: AppState): AppState {
  return {
    ...s,
    result: undefined,
    run: { status: "idle", stages: initialStages(), liveCounts: { cards: 0, issues: 0 } },
    review: { ...s.review, selectedCardId: undefined, decisions: {}, resolutions: {}, notices: [] },
    publish: { status: "idle" },
  };
}

/** Setup and metadata edits after a completed run mark it stale (RED-10); they never alter the result. */
const markStale = (s: AppState): AppState["run"] => (s.run.status === "completed" ? { ...s.run, stale: true } : s.run);

/** RED-09: first card with an open issue, else the first card. */
function defaultSelection(s: AppState, result: DecompositionResult): string | undefined {
  const withResult = { ...s, result };
  return (result.cards.find((c) => openIssues(withResult, c).length > 0) ?? result.cards[0])?.shortId;
}

const withDecision = (s: AppState, shortId: string, d: "approved" | "rejected" | "pending"): AppState => {
  const decisions = { ...s.review.decisions };
  if (d === "pending") delete decisions[shortId];
  else decisions[shortId] = d;
  return { ...s, review: { ...s.review, decisions } };
};

export function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case "DOC_LOADING":
      return { ...s, document: { ...s.document, status: "loading", fileName: a.fileName, sizeBytes: a.sizeBytes, error: undefined } };

    case "DOC_LOADED": {
      const replacing = s.document.status === "ready" || s.result !== undefined;
      const base = replacing ? clearDownstream(s) : s;
      const { ingest } = a;
      return {
        ...base,
        document: {
          status: "ready",
          fileName: ingest.fileName,
          sizeBytes: ingest.sizeBytes,
          pageCount: ingest.pageCount,
          sections: ingest.sections,
          passages: ingest.passages,
          extraDocuments: base.document.extraDocuments,
        },
        meta: { ...base.meta, ...ingest.suggestedMeta },
      };
    }

    case "DOC_FAILED":
      return { ...s, document: { status: "error", error: a.error, extraDocuments: s.document.extraDocuments } };

    case "DOC_CLEARED":
      return { ...clearDownstream(s), document: { status: "empty", extraDocuments: [] } };

    case "EXTRA_DOC_ADDED":
      if (s.document.extraDocuments.some((d) => d.name === a.name)) return s;
      return { ...s, document: { ...s.document, extraDocuments: [...s.document.extraDocuments, { name: a.name, sizeBytes: a.sizeBytes }] } };

    case "EXTRA_DOC_REMOVED":
      return { ...s, document: { ...s.document, extraDocuments: s.document.extraDocuments.filter((d) => d.name !== a.name) } };

    case "META_CHANGED":
      return {
        ...s,
        meta: { ...s.meta, [a.field]: a.value },
        metaTouched: a.touched ? { ...s.metaTouched, [a.field]: true } : s.metaTouched,
        run: markStale(s),
      };

    case "SETUP_TOGGLE_TYPE":
      return { ...s, setup: { ...s.setup, types: { ...s.setup.types, [a.cardType]: !s.setup.types[a.cardType] } }, run: markStale(s) };

    case "SETUP_SET_GRANULARITY":
      return { ...s, setup: { ...s.setup, granularity: a.granularity }, run: markStale(s) };

    case "SETUP_TOGGLE_CHECK":
      return { ...s, setup: { ...s.setup, checks: { ...s.setup.checks, [a.check]: !s.setup.checks[a.check] } }, run: markStale(s) };

    case "RUN_STARTED": {
      const cleared = clearDownstream(s);
      return { ...cleared, run: { ...cleared.run, status: "running", startedAt: a.at } };
    }

    case "RUN_EVENT": {
      if (s.run.status !== "running") return s;
      const e = a.event;
      const run = { ...s.run, stages: { ...s.run.stages }, liveCounts: { ...s.run.liveCounts } };
      if (e.type === "stage_started") run.stages[e.stage] = { status: "running" };
      else if (e.type === "stage_completed") run.stages[e.stage] = { status: "done", summary: e.summary };
      else if (e.type === "card_extracted") run.liveCounts.cards += 1;
      else run.liveCounts.issues += 1;
      return { ...s, run };
    }

    case "RUN_COMPLETED": {
      if (s.run.status !== "running") return s;
      const failures = validateResult(a.result);
      if (failures.length > 0) {
        console.error("Decomposition result failed validation", failures);
        return { ...s, run: { ...s.run, status: "failed", error: INVALID_RESULT } };
      }
      const liveCounts = { cards: a.result.cards.length, issues: a.result.issues.length };
      return {
        ...s,
        result: a.result,
        run: { ...s.run, status: "completed", stale: false, error: undefined, liveCounts },
        review: { ...s.review, selectedCardId: defaultSelection(s, a.result), tab: "card", filter: "all" },
      };
    }

    case "RUN_FAILED": {
      // The stage that was running when the run failed is marked failed; earlier stages stay done.
      const stages = { ...s.run.stages };
      for (const [id, st] of Object.entries(stages)) if (st.status === "running") stages[id as keyof typeof stages] = { status: "failed" };
      return { ...s, run: { ...s.run, status: "failed", stages, error: a.error } };
    }

    case "RUN_CANCELLED":
      return s.run.status === "running" ? { ...s, run: { ...s.run, status: "cancelled" } } : s;

    case "REVIEW_SELECT_CARD":
      if (!s.result?.cards.some((c) => c.shortId === a.shortId)) return s; // RED-07
      return { ...s, review: { ...s.review, selectedCardId: a.shortId } };

    case "REVIEW_SET_TAB":
      return { ...s, review: { ...s.review, tab: a.tab } };

    case "REVIEW_SET_FILTER":
      return { ...s, review: { ...s.review, filter: a.filter } };

    case "CARD_APPROVE": {
      const card = s.result?.cards.find((c) => c.shortId === a.shortId);
      if (!card || decision(s, card) !== "pending" || isBlocked(s, card)) return s; // RED-01
      return withDecision(s, card.shortId, "approved");
    }

    case "CARD_REJECT": {
      const card = s.result?.cards.find((c) => c.shortId === a.shortId);
      if (!card || decision(s, card) !== "pending") return s; // RED-02
      return withDecision(s, card.shortId, "rejected");
    }

    case "CARD_REOPEN": {
      const card = s.result?.cards.find((c) => c.shortId === a.shortId);
      if (!card || decision(s, card) === "pending") return s; // RED-03
      return withDecision(s, card.shortId, "pending");
    }

    case "ISSUE_RESOLVE": {
      if (!issueById(s, a.issueId) || s.review.resolutions[a.issueId]) return s; // RED-04
      return { ...s, review: { ...s.review, resolutions: { ...s.review.resolutions, [a.issueId]: { issueId: a.issueId, at: a.at } } } };
    }

    case "ISSUE_UNRESOLVE": {
      const issue = issueById(s, a.issueId);
      if (!issue || isOpen(s, issue)) return s;
      const resolutions = { ...s.review.resolutions };
      delete resolutions[a.issueId];
      let next: AppState = { ...s, review: { ...s.review, resolutions } };
      // RED-05: a reopened error sends every approved card it is attached to back to pending.
      if (issue.severity === "error") {
        const notices = [...next.review.notices];
        for (const shortId of issue.cardIds) {
          if (next.review.decisions[shortId] === "approved") {
            next = withDecision(next, shortId, "pending");
            notices.push(`${shortId} returned to Pending because ${issue.id} was reopened.`);
          }
        }
        next = { ...next, review: { ...next.review, notices } };
      }
      return next;
    }

    case "BULK_APPROVE_CLEAN": {
      // RED-06: only pending cards with no issues at all (even resolved ones are skipped).
      const clean = (s.result?.cards ?? []).filter((c) => decision(s, c) === "pending" && c.issueIds.length === 0);
      if (clean.length === 0) return s;
      const decisions = { ...s.review.decisions };
      for (const c of clean) decisions[c.shortId] = "approved";
      return { ...s, review: { ...s.review, decisions } };
    }

    case "NOTICES_DISMISS":
      return s.review.notices.length ? { ...s, review: { ...s.review, notices: [] } } : s;

    case "PUBLISH_STARTED":
      return { ...s, publish: { ...s.publish, status: "publishing", error: undefined } };

    case "PUBLISH_SUCCEEDED":
      return { ...s, publish: { ...s.publish, status: "published", receipt: a.receipt, error: undefined } };

    case "PUBLISH_FAILED":
      return { ...s, publish: { ...s.publish, status: "failed", error: a.error } };

    case "PUBLISH_EXPORTED":
      return { ...s, publish: { ...s.publish, exported: true } };

    case "SAVE_STATUS":
      return { ...s, save: { status: a.status, lastSavedAt: a.at ?? s.save.lastSavedAt, manual: a.manual } };

    case "DRAFT_RESTORED":
      return { ...a.state, document: { ...a.state.document, restoredFromDraft: true } };

    case "RESET":
      return initialState();
  }
}
