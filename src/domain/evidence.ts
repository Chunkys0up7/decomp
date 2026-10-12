import type { Evidence, Passage } from "./types";

/** DATA-01: a quote must equal the slice of the passage it claims to come from. */
export function isEvidenceVerified(evidence: Evidence, passages: readonly Passage[]): boolean {
  const passage = passages.find((p) => p.id === evidence.passageId);
  return passage !== undefined && passage.text.slice(evidence.start, evidence.end) === evidence.quote;
}

export interface Span {
  start: number;
  end: number;
}

export interface Segment {
  text: string;
  marked: boolean;
}

/**
 * Splits passage text into marked and unmarked segments for evidence highlighting (build spec A.3).
 * Spans are clamped, sorted and merged when they overlap or touch. Invariant (TEST-18): the segment
 * texts concatenate back to the original text.
 */
export function splitMarks(text: string, spans: readonly Span[]): Segment[] {
  const clamp = (n: number) => Math.max(0, Math.min(text.length, n));
  const sorted = spans
    .map((s) => ({ start: clamp(s.start), end: clamp(s.end) }))
    .filter((s) => s.end > s.start)
    .sort((a, b) => a.start - b.start);

  const merged: Span[] = [];
  for (const s of sorted) {
    const last = merged[merged.length - 1];
    if (last && s.start <= last.end) last.end = Math.max(last.end, s.end);
    else merged.push({ ...s });
  }

  const out: Segment[] = [];
  let cursor = 0;
  for (const m of merged) {
    if (m.start > cursor) out.push({ text: text.slice(cursor, m.start), marked: false });
    out.push({ text: text.slice(m.start, m.end), marked: true });
    cursor = m.end;
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor), marked: false });
  return out;
}
