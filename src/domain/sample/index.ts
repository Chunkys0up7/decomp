// Appendix B sample dataset, extracted from the build spec by scripts/extract-sample.mjs.
import data from "./sample-decomposition.json";
import type { DecompositionResult } from "../types";

export const sampleDecomposition = data as DecompositionResult;

/** A fresh deep copy, so callers can mutate without touching the shared sample. */
export function cloneSample(): DecompositionResult {
  return structuredClone(sampleDecomposition);
}
