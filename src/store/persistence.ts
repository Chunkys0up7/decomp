// Local draft persistence (build spec 7.5).
import type { AppState } from "./state";

export const DRAFT_KEY = "pc:draft:v1";

interface DraftEnvelope {
  schemaVersion: number;
  savedAt: string;
  state: AppState;
}

/** PER-01: what is stored. Transient notices are dropped; a running run is stored as cancelled; publish is idle unless published. */
export function toDraft(state: AppState): AppState {
  return {
    ...state,
    run: state.run.status === "running" ? { ...state.run, status: "cancelled" } : state.run,
    review: { ...state.review, notices: [] },
    publish: state.publish.status === "published" ? state.publish : { status: "idle", exported: state.publish.exported },
    save: { status: "idle", lastSavedAt: state.save.lastSavedAt },
  };
}

export function serializeDraft(state: AppState, savedAt: string): string {
  const envelope: DraftEnvelope = { schemaVersion: state.schemaVersion, savedAt, state: toDraft(state) };
  return JSON.stringify(envelope);
}

/** PER-03: a draft with a different schemaVersion is discarded with a console warning. */
export function parseDraft(raw: string | null, expectedVersion: number): AppState | null {
  if (!raw) return null;
  try {
    const envelope = JSON.parse(raw) as DraftEnvelope;
    if (envelope.schemaVersion !== expectedVersion || envelope.state?.schemaVersion !== expectedVersion) {
      console.warn(`Discarding draft with schemaVersion ${envelope.schemaVersion}; expected ${expectedVersion}.`);
      return null;
    }
    return { ...envelope.state, save: { status: "idle", lastSavedAt: envelope.savedAt } };
  } catch {
    console.warn("Discarding unreadable draft.");
    return null;
  }
}

export interface DraftWriter {
  /** Schedule a write 500 ms after the last change (PER-02). */
  schedule(state: AppState): void;
  /** Write now (Save draft button, page hidden). Resolves false on failure (PER-04). */
  flush(): boolean;
  cancel(): void;
}

/**
 * Debounced writer. `onStatus` mirrors the save indicator: "saving" while a write is pending,
 * "idle" with the time after a write, "failed" when storage throws (quota, private mode).
 */
export function createDraftWriter(
  storage: Pick<Storage, "setItem">,
  onStatus: (status: AppState["save"]["status"], at?: string) => void,
  now: () => string = () => new Date().toISOString(),
  delayMs = 500,
): DraftWriter {
  let pending: AppState | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (timer) { clearTimeout(timer); timer = null; }
    if (!pending) return true;
    const state = pending;
    pending = null;
    const at = now();
    try {
      storage.setItem(DRAFT_KEY, serializeDraft(state, at));
      onStatus("idle", at);
      return true;
    } catch (e) {
      console.error("Autosave failed", e);
      onStatus("failed");
      return false;
    }
  };

  return {
    schedule(state) {
      pending = state;
      if (timer) clearTimeout(timer);
      else onStatus("saving");
      timer = setTimeout(flush, delayMs);
    },
    flush,
    cancel() {
      if (timer) clearTimeout(timer);
      timer = null;
      pending = null;
    },
  };
}

export function clearDraft(storage: Pick<Storage, "removeItem">): void {
  storage.removeItem(DRAFT_KEY);
}
