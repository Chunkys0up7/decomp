// `?demo=review` seeds the Review screen (spec 15 phase 3, 16.1 item 6): a completed run on the
// Appendix B sample with F-001, R-002 and C-006 approved.
import { sectionsOf } from "../adapters/mock-ingest";
import { cloneSample } from "../domain/sample";
import { STAGE_IDS } from "../domain/types";
import { reducer } from "../store/reducer";
import { initialState, type AppState } from "../store/state";

const SEEDED_AT = "2026-10-12T09:00:00.000Z";

/** `?demo=loaded`: document parsed and metadata valid, no run yet (step 2 reachable). */
export function demoLoadedState(): AppState {
  const sample = cloneSample();
  return reducer(initialState(), {
    type: "DOC_LOADED",
    ingest: { fileName: "POL-HL-0142 Underwriting policy.pdf", sizeBytes: 482_113, pageCount: 14, sections: sectionsOf(sample.passages), passages: sample.passages, suggestedMeta: sample.policy },
  });
}

export function demoReviewState(): AppState {
  const sample = cloneSample();
  let s = demoLoadedState();
  s = reducer(s, { type: "RUN_STARTED", at: SEEDED_AT });
  for (const stage of STAGE_IDS) s = reducer(s, { type: "RUN_EVENT", event: { type: "stage_completed", stage, summary: "" } });
  s = reducer(s, { type: "RUN_COMPLETED", result: sample });
  for (const shortId of ["F-001", "R-002", "C-006"]) s = reducer(s, { type: "CARD_APPROVE", shortId });
  return s;
}

export function demoFromUrl(search: string): AppState | undefined {
  const demo = new URLSearchParams(search).get("demo");
  return demo === "review" ? demoReviewState() : demo === "loaded" ? demoLoadedState() : undefined;
}
