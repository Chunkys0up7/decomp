import type { Passage } from "./types";

/** True when the passage at `i` is the first of its section, so a section label goes before it. */
export const startsSection = (passages: readonly Passage[], i: number): boolean =>
  i === 0 || passages[i - 1]?.sectionNo !== passages[i]?.sectionNo;
