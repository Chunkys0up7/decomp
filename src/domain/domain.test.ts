import { describe, expect, it } from "vitest";
import { isEvidenceVerified, splitMarks } from "./evidence";
import { cardId, cardUri, shortId } from "./ids";
import { checkField, isMetaValid, normaliseField } from "./meta";
import { cloneSample, sampleDecomposition as sample } from "./sample";
import { validateResult } from "./validate";

describe("TEST-01 evidence validation", () => {
  it("every evidence item in the sample matches its passage (DATA-01)", () => {
    for (const c of sample.cards) for (const e of c.evidence) expect(isEvidenceVerified(e, sample.passages), `${c.shortId} ${e.passageId}`).toBe(true);
    expect(validateResult(sample)).toEqual([]);
  });

  it("a mutated quote fails VAL-01", () => {
    const r = cloneSample();
    r.cards[0]!.evidence[0]!.quote = r.cards[0]!.evidence[0]!.quote.replace("conventional", "jumbo");
    expect(validateResult(r).map((f) => f.code)).toContain("VAL-01");
  });

  it("covers the remaining result checks", () => {
    const r = cloneSample();
    r.cards[1]!.evidence = [];
    r.cards[2]!.seq = r.cards[3]!.seq;
    r.cards[4]!.relations.push({ kind: "depends_on", shortId: "X-999" });
    r.cards[5]!.confidence = 1.2;
    r.issues = r.issues.filter((i) => i.passageId !== "p8");
    r.cards[5]!.relations.push({ kind: "depends_on", shortId: "R-005" }); // R-005 -> C-006 -> R-005
    const codes = new Set(validateResult(r).map((f) => f.code));
    for (const code of ["VAL-02", "VAL-03", "VAL-04", "VAL-05", "VAL-06", "VAL-07", "VAL-08"]) expect(codes, code).toContain(code);
  });
});

describe("TEST-02 ID rules", () => {
  it("matches spec 6.2 for every sample card", () => {
    for (const c of sample.cards) {
      expect(c.shortId).toBe(shortId(c.type, c.seq));
      expect(c.cardId).toBe(cardId("POL-HL-0142", c.type, c.seq));
      expect(c.uri).toBe(cardUri("POL-HL-0142", "3.1", c.type, c.seq));
    }
    expect(cardId("POL-HL-0142", "rule", 5)).toBe("PC-HL0142-R005");
    expect(cardUri("POL-HL-0142", "3.1", "rule", 5)).toBe("pc://hl/pol-0142/v3.1/rule/005");
  });

  it("uses the fallback URI for a non-standard policy ID", () => {
    expect(cardUri("ABC123", "1.0", "fact", 1)).toBe("pc://default/abc123/v1.0/fact/001");
    expect(cardId("ABC123", "fact", 1)).toBe("PC-ABC123-F001");
  });
});

describe("TEST-17 metadata validation", () => {
  it("applies each rule in spec 9.1.6", () => {
    expect(checkField("policyId", "")).toEqual({ error: "required" });
    expect(checkField("policyId", "POL-HL-0142")).toEqual({});
    expect(checkField("policyId", "ABC123")).toEqual({ warning: "nonStandardId" });
    expect(checkField("version", "3.1")).toEqual({});
    expect(checkField("version", "10")).toEqual({});
    expect(checkField("version", "v3")).toEqual({ error: "format" });
    expect(checkField("version", "3.")).toEqual({ error: "format" });
    expect(checkField("effectiveFrom", "2026-01-01")).toEqual({});
    expect(checkField("effectiveFrom", "2026-02-30")).toEqual({ error: "format" });
    expect(checkField("effectiveFrom", "01/01/2026")).toEqual({ error: "format" });
    for (const f of ["domain", "channel", "owner"] as const) {
      expect(checkField(f, "   ")).toEqual({ error: "required" });
      expect(checkField(f, "retail")).toEqual({});
    }
    expect(isMetaValid(sample.policy)).toBe(true);
    expect(isMetaValid({ ...sample.policy, owner: "" })).toBe(false);
  });

  it("trims and upper-cases on blur (UI-21)", () => {
    expect(normaliseField("policyId", "  pol-hl-0142 ")).toBe("POL-HL-0142");
    expect(normaliseField("domain", "  retail ")).toBe("retail");
  });
});

describe("TEST-18 evidence marks", () => {
  const text = "abcdefghij";
  const join = (spans: { start: number; end: number }[]) => splitMarks(text, spans).map((s) => s.text).join("");

  it("handles overlapping, adjacent, out-of-range and empty spans", () => {
    expect(splitMarks(text, [{ start: 2, end: 5 }, { start: 4, end: 7 }])).toEqual([
      { text: "ab", marked: false },
      { text: "cdefg", marked: true },
      { text: "hij", marked: false },
    ]);
    expect(splitMarks(text, [{ start: 0, end: 3 }, { start: 3, end: 5 }])).toEqual([
      { text: "abcde", marked: true },
      { text: "fghij", marked: false },
    ]);
    expect(splitMarks(text, [{ start: -4, end: 99 }])).toEqual([{ text, marked: true }]);
    expect(splitMarks(text, [{ start: 4, end: 4 }])).toEqual([{ text, marked: false }]);
  });

  it("always concatenates back to the original text", () => {
    for (const spans of [[], [{ start: 9, end: 10 }], [{ start: 5, end: 2 }], [{ start: 1, end: 3 }, { start: 6, end: 8 }]]) {
      expect(join(spans)).toBe(text);
    }
  });
});
