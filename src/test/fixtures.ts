import { cloneSample } from "../domain/sample";
import type { Action } from "../store/actions";
import { reducer } from "../store/reducer";
import { initialState, type AppState } from "../store/state";

export const AT = "2026-10-12T10:00:00.000Z";

export const run = (state: AppState, ...actions: Action[]): AppState => actions.reduce(reducer, state);

/** State after a completed run on the Appendix B sample, everything pending. */
export function reviewState(): AppState {
  return run(initialState(), { type: "RUN_STARTED", at: AT }, { type: "RUN_COMPLETED", result: cloneSample() });
}

export const ids = (cards: { shortId: string }[]) => cards.map((c) => c.shortId);
