// Mock ingest (build spec 8.2): returns the Appendix B passages after a short delay.
import { sampleDecomposition } from "../domain/sample";
import type { Passage } from "../domain/types";
import { delay, type IngestAdapter, type SectionSummary } from "./types";

const SUPPORTED = ["pdf", "docx", "md"];

export function sectionsOf(passages: readonly Passage[]): SectionSummary[] {
  const out: SectionSummary[] = [];
  for (const p of passages) {
    const last = out[out.length - 1];
    if (last && last.no === p.sectionNo) last.passageCount += 1;
    else out.push({ no: p.sectionNo, title: p.sectionTitle, passageCount: 1 });
  }
  return out;
}

export function createMockIngest({ delayMs = 600 }: { delayMs?: number } = {}): IngestAdapter {
  return {
    async ingest(file, signal) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!SUPPORTED.includes(ext)) {
        throw { code: "unsupported_type", message: "This file type isn't supported. Use PDF, DOCX or Markdown.", retryable: false };
      }
      await delay(delayMs, signal);
      if (file.name.toLowerCase().includes("fail")) {
        throw { code: "unreadable", message: "This file could not be read.", retryable: false };
      }
      const passages = structuredClone(sampleDecomposition.passages);
      return {
        fileName: file.name,
        sizeBytes: file.size,
        pageCount: 14,
        sections: sectionsOf(passages),
        passages,
        suggestedMeta: { ...sampleDecomposition.policy },
      };
    },
  };
}
