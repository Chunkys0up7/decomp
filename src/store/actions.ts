// Actions (build spec 7.2). Timestamps travel in the action so the reducer stays pure (RED-12).
import type { AdapterError, IngestResult, PublishReceipt, RunEvent } from "../adapters/types";
import type { CardType, CheckKey, DecompositionResult, Granularity, PolicyMeta } from "../domain/types";
import type { AppState, ReviewFilter, ReviewTab } from "./state";

type ErrorInfo = Pick<AdapterError, "message" | "retryable">;

export type Action =
  | { type: "DOC_LOADING"; fileName: string; sizeBytes: number }
  | { type: "DOC_LOADED"; ingest: IngestResult }
  | { type: "DOC_FAILED"; error: ErrorInfo }
  | { type: "DOC_CLEARED" }
  | { type: "EXTRA_DOC_ADDED"; name: string; sizeBytes: number }
  | { type: "EXTRA_DOC_REMOVED"; name: string }
  | { type: "META_CHANGED"; field: keyof PolicyMeta; value: string; touched?: boolean }
  | { type: "SETUP_TOGGLE_TYPE"; cardType: CardType }
  | { type: "SETUP_SET_GRANULARITY"; granularity: Granularity }
  | { type: "SETUP_TOGGLE_CHECK"; check: CheckKey }
  | { type: "RUN_STARTED"; at: string }
  | { type: "RUN_EVENT"; event: RunEvent }
  | { type: "RUN_COMPLETED"; result: DecompositionResult }
  | { type: "RUN_FAILED"; error: ErrorInfo }
  | { type: "RUN_CANCELLED" }
  | { type: "REVIEW_SELECT_CARD"; shortId: string }
  | { type: "REVIEW_SET_TAB"; tab: ReviewTab }
  | { type: "REVIEW_SET_FILTER"; filter: ReviewFilter }
  | { type: "CARD_APPROVE"; shortId: string }
  | { type: "CARD_REJECT"; shortId: string }
  | { type: "CARD_REOPEN"; shortId: string }
  | { type: "ISSUE_RESOLVE"; issueId: string; at: string }
  | { type: "ISSUE_UNRESOLVE"; issueId: string }
  | { type: "BULK_APPROVE_CLEAN" }
  | { type: "NOTICES_DISMISS" }
  | { type: "PUBLISH_STARTED" }
  | { type: "PUBLISH_SUCCEEDED"; receipt: PublishReceipt }
  | { type: "PUBLISH_FAILED"; error: string }
  | { type: "PUBLISH_EXPORTED" }
  | { type: "SAVE_STATUS"; status: AppState["save"]["status"]; at?: string; manual?: boolean }
  | { type: "DRAFT_RESTORED"; state: AppState }
  | { type: "RESET" };
