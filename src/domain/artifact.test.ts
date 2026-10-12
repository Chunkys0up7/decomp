import { describe, expect, it } from "vitest";
import { artifactErrors } from "../adapters/local-publish";
import { buildArtifact, contentHash, type Artifact } from "./artifact";
import { sampleDecomposition as sample } from "./sample";

const card = (id: string) => sample.cards.find((c) => c.shortId === id)!;
const r005 = () => buildArtifact(card("R-005"), sample, "approved", {});

describe("TEST-10 artifact build", () => {
  it("R-005 validates against the schema and carries inferred content and accepted issues", () => {
    const a = r005();
    expect(artifactErrors([a])).toEqual([]);
    expect(Object.keys(a.content)).toContain("otherwise_inferred");
    expect(a.quality.accepted_issues).toEqual([
      { id: "ISS-04", severity: "warning" },
      { id: "ISS-05", severity: "info" },
    ]);
    expect(a.relations).toEqual([{ type: "depends_on", card_id: "PC-HL0142-C006" }]);
    expect(a.content_hash).toBeNull();
  });

  it("keeps the spec 6.6 key order", () => {
    expect(Object.keys(r005())).toEqual([
      "schema", "card_id", "uri", "type", "title", "policy", "applicability", "source",
      "content", "relations", "retrieval", "quality", "review", "content_hash",
    ]);
  });

  it("lists a resolved error as resolved (DATA-15)", () => {
    const a = buildArtifact(card("R-008"), sample, "approved", { "ISS-01": { issueId: "ISS-01", at: "x" } });
    expect(a.quality.accepted_issues).toEqual([{ id: "ISS-01", severity: "error", resolved: true }]);
  });

  it("every sample card builds a valid artifact", () => {
    expect(artifactErrors(sample.cards.map((c) => buildArtifact(c, sample, "approved", {})))).toEqual([]);
  });
});

describe("TEST-11 hash determinism", () => {
  it("is stable, changes with meaning, ignores review and quality", async () => {
    const base = await contentHash(r005());
    expect(base).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(await contentHash(r005())).toBe(base);

    const changed = r005();
    changed.content.then = `${changed.content.then} Changed.`;
    expect(await contentHash(changed)).not.toBe(base);

    const reviewed: Artifact = { ...r005(), review: { status: "rejected" } };
    expect(await contentHash(reviewed)).toBe(base);

    const a = r005();
    const requalified: Artifact = { ...a, quality: { ...a.quality, confidence: 0.1 } };
    expect(await contentHash(requalified)).toBe(base);
  });
});

describe("TEST-12 canonicalisation", () => {
  it("key order does not change the hash", async () => {
    const a = r005();
    const reordered = Object.fromEntries(Object.entries(a).reverse()) as unknown as Artifact;
    reordered.policy = Object.fromEntries(Object.entries(a.policy).reverse()) as Artifact["policy"];
    expect(await contentHash(reordered)).toBe(await contentHash(a));
  });
});
