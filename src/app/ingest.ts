// Loads a document through the ingest adapter (spec 8.1). Abortable; a retryable failure keeps
// the file so "Try again" can re-run it (ADP-02).
import { useCallback, useRef } from "react";
import { isAbort, toAdapterError } from "../adapters/types";
import { useDispatch } from "../store/StoreProvider";
import { useAdapters } from "./adapters";

export function useIngest() {
  const { ingest } = useAdapters();
  const dispatch = useDispatch();
  const controller = useRef<AbortController | null>(null);
  const lastFile = useRef<File | null>(null);

  const load = useCallback(
    (file: File) => {
      controller.current?.abort();
      const ac = new AbortController();
      controller.current = ac;
      lastFile.current = file;
      dispatch({ type: "DOC_LOADING", fileName: file.name, sizeBytes: file.size });
      ingest
        .ingest(file, ac.signal)
        .then((result) => { if (!ac.signal.aborted) dispatch({ type: "DOC_LOADED", ingest: result }); })
        .catch((e: unknown) => {
          if (isAbort(e) || ac.signal.aborted) return;
          const err = toAdapterError(e);
          dispatch({ type: "DOC_FAILED", error: { message: err.message, retryable: err.retryable } });
        });
    },
    [ingest, dispatch],
  );

  const retry = useCallback(() => { if (lastFile.current) load(lastFile.current); }, [load]);
  return { load, retry };
}
