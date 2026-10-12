// The backend seam (build spec 8.1). The UI talks to the outside world only through these.
import type { DecompositionResult, Passage, PolicyMeta, Severity, StageId } from "../domain/types";
import type { SetupState } from "../store/state";

export interface AdapterError {
  code: string;
  message: string;
  retryable: boolean;
}

export const isAdapterError = (e: unknown): e is AdapterError =>
  typeof e === "object" && e !== null && "code" in e && "message" in e && "retryable" in e;

/** ADP-03: anything else becomes a retryable unknown error. */
export function toAdapterError(e: unknown): AdapterError {
  if (isAdapterError(e)) return e;
  console.error(e);
  return { code: "unknown", message: "Something went wrong. Try again.", retryable: true };
}

export const isAbort = (e: unknown) => e instanceof DOMException && e.name === "AbortError";

export interface SectionSummary {
  no: string;
  title: string;
  passageCount: number;
}

export interface IngestResult {
  fileName: string;
  sizeBytes: number;
  pageCount?: number;
  sections: SectionSummary[];
  passages: Passage[];
  suggestedMeta?: Partial<PolicyMeta>;
}

export interface IngestAdapter {
  ingest(file: File, signal: AbortSignal): Promise<IngestResult>;
}

export interface DecomposeRequest {
  meta: PolicyMeta;
  setup: SetupState;
  passages: Passage[];
  extraDocuments: { name: string }[];
}

export type RunEvent =
  | { type: "stage_started"; stage: StageId }
  | { type: "stage_completed"; stage: StageId; summary: string }
  | { type: "card_extracted"; shortId: string }
  | { type: "issue_found"; issueId: string; severity: Severity };

export interface DecompositionAdapter {
  run(req: DecomposeRequest, onEvent: (e: RunEvent) => void, signal: AbortSignal): Promise<DecompositionResult>;
}

export interface PublishReceipt {
  packageId: string;
  publishedAt: string;
  counts: { published: number; rejected: number };
  location?: string;
}

export interface PublishAdapter {
  publish(manifest: unknown, artifacts: unknown[], signal: AbortSignal): Promise<PublishReceipt>;
  exportFile(manifest: unknown, artifacts: unknown[]): void;
}

/** Shared helper: resolves after `ms`, rejects with AbortError if the signal fires first. */
export function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(t); reject(new DOMException("Aborted", "AbortError")); }, { once: true });
  });
}
