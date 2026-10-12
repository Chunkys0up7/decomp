// Runs the decomposition outside any screen, so leaving /decompose does not cancel it (ADP-01).
// Only cancel() aborts. A run token ignores late results from a run that was superseded.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { isAbort, toAdapterError } from "../adapters/types";
import { useAppState, useDispatch } from "../store/StoreProvider";
import { useAdapters } from "./adapters";

interface RunControl {
  start: () => void;
  cancel: () => void;
}

const RunContext = createContext<RunControl | null>(null);

export function RunProvider({ children }: { children: ReactNode }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const { decompose } = useAdapters();
  const controller = useRef<AbortController | null>(null);
  const token = useRef(0);
  const latest = useRef(state);
  useEffect(() => { latest.current = state; }, [state]);

  const start = useCallback(() => {
    const s = latest.current;
    if (!s.document.passages) return;
    controller.current?.abort();
    const ac = new AbortController();
    controller.current = ac;
    const mine = ++token.current;
    const current = () => mine === token.current;

    dispatch({ type: "RUN_STARTED", at: new Date().toISOString() });
    decompose
      .run(
        { meta: s.meta, setup: s.setup, passages: s.document.passages, extraDocuments: s.document.extraDocuments.map((d) => ({ name: d.name })) },
        (event) => { if (current()) dispatch({ type: "RUN_EVENT", event }); },
        ac.signal,
      )
      .then((result) => { if (current()) dispatch({ type: "RUN_COMPLETED", result }); })
      .catch((e: unknown) => {
        if (!current()) return;
        if (isAbort(e)) dispatch({ type: "RUN_CANCELLED" });
        else {
          const err = toAdapterError(e);
          dispatch({ type: "RUN_FAILED", error: { message: err.message, retryable: err.retryable } });
        }
      });
  }, [decompose, dispatch]);

  const cancel = useCallback(() => controller.current?.abort(), []);
  const value = useMemo(() => ({ start, cancel }), [start, cancel]);
  return <RunContext.Provider value={value}>{children}</RunContext.Provider>;
}

export function useRun(): RunControl {
  const v = useContext(RunContext);
  if (!v) throw new Error("useRun must be used inside <RunProvider>");
  return v;
}
