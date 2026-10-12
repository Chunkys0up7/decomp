import { useAriaAnnouncer } from "@salt-ds/core";
import { useCallback } from "react";
import { copy } from "../../app/copy";
import type { Issue } from "../../domain/types";
import type { Action } from "../../store/actions";
import { reducer } from "../../store/reducer";
import { counts } from "../../store/selectors";
import { useAppState, useDispatch } from "../../store/StoreProvider";

/** Review actions with their live announcements (spec 11.3). */
export function useReviewActions() {
  const state = useAppState();
  const dispatch = useDispatch();
  const { announce } = useAriaAnnouncer();

  const decide = useCallback(
    (action: Extract<Action, { type: "CARD_APPROVE" | "CARD_REJECT" | "CARD_REOPEN" }>) => {
      const next = reducer(state, action);
      if (next === state) return false;
      dispatch(action);
      const c = counts(next);
      const decided = c.approved + c.rejected;
      const say = action.type === "CARD_APPROVE" ? copy.review.announce.approved : action.type === "CARD_REJECT" ? copy.review.announce.rejected : copy.review.announce.reopened;
      announce(say(action.shortId, decided, c.total));
      return true;
    },
    [state, dispatch, announce],
  );

  return {
    approve: (shortId: string) => decide({ type: "CARD_APPROVE", shortId }),
    reject: (shortId: string) => decide({ type: "CARD_REJECT", shortId }),
    reopen: (shortId: string) => decide({ type: "CARD_REOPEN", shortId }),
    resolve: (issue: Issue) => {
      dispatch({ type: "ISSUE_RESOLVE", issueId: issue.id, at: new Date().toISOString() });
      announce(issue.severity === "error" ? copy.review.announce.resolved(issue.id) : copy.review.announce.acknowledged(issue.id));
    },
    unresolve: (issue: Issue) => {
      dispatch({ type: "ISSUE_UNRESOLVE", issueId: issue.id });
      announce(copy.review.announce.issueReopened(issue.id));
    },
    bulkApprove: (k: number) => {
      dispatch({ type: "BULK_APPROVE_CLEAN" });
      announce(copy.review.bulkDone(k));
    },
    select: (shortId: string) => dispatch({ type: "REVIEW_SELECT_CARD", shortId }),
  };
}
