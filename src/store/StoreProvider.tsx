// The store context: one reducer, draft restore on start (PER-03), debounced autosave (PER-02)
// with a flush when the page is hidden.
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type Dispatch, type ReactNode } from "react";
import type { Action } from "./actions";
import { createDraftWriter, DRAFT_KEY, parseDraft, type DraftWriter } from "./persistence";
import { reducer } from "./reducer";
import { initialState, type AppState } from "./state";

interface StoreValue {
  state: AppState;
  dispatch: Dispatch<Action>;
  /** Write the draft immediately (Save draft). Returns false if storage failed. */
  saveNow: () => boolean;
}

const StoreContext = createContext<StoreValue | null>(null);

/** localStorage can throw on access (private mode, blocked site data). */
function safeStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function boot(): AppState {
  const storage = safeStorage();
  let raw: string | null = null;
  try { raw = storage?.getItem(DRAFT_KEY) ?? null; } catch { raw = null; }
  const draft = parseDraft(raw, initialState().schemaVersion);
  return draft ? reducer(initialState(), { type: "DRAFT_RESTORED", state: draft }) : initialState();
}

export function StoreProvider({ children, initial }: { children: ReactNode; initial?: AppState }) {
  const [state, dispatch] = useReducer(reducer, initial, (i) => i ?? boot());
  // Created once; dispatch from useReducer is stable.
  const [writer] = useState<DraftWriter>(() =>
    createDraftWriter(
      safeStorage() ?? { setItem: () => { throw new Error("storage unavailable"); } },
      (status, at) => dispatch({ type: "SAVE_STATUS", status, at }),
    ),
  );

  const latest = useRef(state);
  useEffect(() => { latest.current = state; }, [state]);

  // Persist when any persisted slice changes identity. `save` is excluded (writing it would loop).
  // Comparing against the last scheduled slices, rather than skipping the first effect run, stays
  // correct when StrictMode runs effects twice on mount.
  const { document: doc, meta, metaTouched, setup, run, result, review, publish } = state;
  const lastScheduled = useRef<unknown[]>([doc, meta, metaTouched, setup, run, result, review, publish]);
  useEffect(() => {
    const slices = [doc, meta, metaTouched, setup, run, result, review, publish];
    if (slices.every((x, i) => x === lastScheduled.current[i])) return;
    lastScheduled.current = slices;
    writer.schedule(latest.current);
  }, [doc, meta, metaTouched, setup, run, result, review, publish, writer]);

  useEffect(() => {
    const onHide = () => { if (document.visibilityState === "hidden") writer.flush(); };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      writer.cancel();
    };
  }, [writer]);

  const saveNow = useCallback(() => {
    writer.schedule(latest.current);
    const ok = writer.flush();
    if (ok) dispatch({ type: "SAVE_STATUS", status: "idle", at: new Date().toISOString(), manual: true });
    return ok;
  }, [writer]);

  const value = useMemo(() => ({ state, dispatch, saveNow }), [state, saveNow]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

function useStoreValue(): StoreValue {
  const v = useContext(StoreContext);
  if (!v) throw new Error("useStore must be used inside <StoreProvider>");
  return v;
}

export const useAppState = (): AppState => useStoreValue().state;
export const useDispatch = (): Dispatch<Action> => useStoreValue().dispatch;
export const useSaveNow = () => useStoreValue().saveNow;
