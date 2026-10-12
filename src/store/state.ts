// Store shape (build spec 7.1) and its initial value.
import type { PublishReceipt, SectionSummary } from "../adapters/types";
import type { CardType, CheckKey, Decision, DecompositionResult, Granularity, Passage, PolicyMeta, Resolution, StageId } from "../domain/types";

export type StageStatus = "pending" | "running" | "done" | "failed";
export type RunStatus = "idle" | "running" | "completed" | "failed" | "cancelled";
export type ReviewTab = "card" | "lineage" | "artifact";
export type ReviewFilter = "all" | "attention" | "decided";

export interface SetupState {
  types: Record<CardType, boolean>;
  granularity: Granularity;
  checks: Record<CheckKey, boolean>;
}

export interface AppState {
  schemaVersion: 1;
  document: {
    status: "empty" | "loading" | "ready" | "error";
    fileName?: string;
    sizeBytes?: number;
    pageCount?: number;
    sections?: SectionSummary[];
    passages?: Passage[];
    restoredFromDraft?: boolean;
    error?: { message: string; retryable: boolean };
    extraDocuments: { name: string; sizeBytes: number }[];
  };
  meta: PolicyMeta;
  metaTouched: Partial<Record<keyof PolicyMeta, boolean>>;
  setup: SetupState;
  run: {
    status: RunStatus;
    stages: Record<StageId, { status: StageStatus; summary?: string }>;
    startedAt?: string;
    error?: { message: string; retryable: boolean };
    liveCounts: { cards: number; issues: number };
    /** RED-10: metadata or setup changed after a completed run (out-of-spec field, X4). */
    stale?: boolean;
  };
  result?: DecompositionResult;
  review: {
    selectedCardId?: string;
    tab: ReviewTab;
    filter: ReviewFilter;
    decisions: Record<string, Decision>;
    resolutions: Record<string, Resolution>;
    notices: string[];
  };
  publish: {
    status: "idle" | "publishing" | "published" | "failed";
    receipt?: PublishReceipt;
    error?: string;
    /** Step 4 is also complete after a successful export (spec 5.2; out-of-spec field, X4). */
    exported?: boolean;
  };
  /** `manual` marks a Save draft press, shown as "Draft saved" for 2 seconds (spec 9.1.8). */
  save: { status: "idle" | "saving" | "failed"; lastSavedAt?: string; manual?: boolean };
}

export const EMPTY_META: PolicyMeta = { policyId: "", version: "", effectiveFrom: "", domain: "", channel: "", owner: "" };

export const initialStages = (): AppState["run"]["stages"] => ({
  parse: { status: "pending" },
  extract: { status: "pending" },
  lineage: { status: "pending" },
  check: { status: "pending" },
  assign_ids: { status: "pending" },
});

export const initialState = (): AppState => ({
  schemaVersion: 1,
  document: { status: "empty", extraDocuments: [] },
  meta: { ...EMPTY_META },
  metaTouched: {},
  setup: {
    types: { fact: true, rule: true, calculation: true, procedure: true },
    granularity: "atomic",
    checks: { ambiguity: true, references: true, conflicts: true, inferred: true },
  },
  run: { status: "idle", stages: initialStages(), liveCounts: { cards: 0, issues: 0 } },
  review: { tab: "card", filter: "all", decisions: {}, resolutions: {}, notices: [] },
  publish: { status: "idle" },
  save: { status: "idle" },
});
