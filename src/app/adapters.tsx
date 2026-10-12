// Which backend the app talks to. Mocks are the default (spec 8); `?delay=0` makes them instant
// for end-to-end tests (spec 8.2).
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createLocalPublish } from "../adapters/local-publish";
import { createMockDecompose } from "../adapters/mock-decompose";
import { createMockIngest } from "../adapters/mock-ingest";
import type { DecompositionAdapter, IngestAdapter, PublishAdapter } from "../adapters/types";

export interface Adapters {
  ingest: IngestAdapter;
  decompose: DecompositionAdapter;
  publish: PublishAdapter;
}

const AdaptersContext = createContext<Adapters | null>(null);

export function defaultAdapters(search: string = typeof window === "undefined" ? "" : window.location.search): Adapters {
  const instant = new URLSearchParams(search).get("delay") === "0";
  return {
    ingest: createMockIngest(instant ? { delayMs: 0 } : {}),
    decompose: createMockDecompose(instant ? { delayMs: 0 } : {}),
    publish: createLocalPublish(instant ? { delayMs: 0 } : {}),
  };
}

export function AdaptersProvider({ children, adapters }: { children: ReactNode; adapters?: Adapters }) {
  const value = useMemo(() => adapters ?? defaultAdapters(), [adapters]);
  return <AdaptersContext.Provider value={value}>{children}</AdaptersContext.Provider>;
}

export function useAdapters(): Adapters {
  const v = useContext(AdaptersContext);
  if (!v) throw new Error("useAdapters must be used inside <AdaptersProvider>");
  return v;
}
