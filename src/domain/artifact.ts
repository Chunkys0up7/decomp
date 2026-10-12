// Published artifact (build spec 6.6), content hash (DATA-13) and package manifest (DATA-17).
import canonicalize from "canonicalize";
import type { Card, Decision, DecompositionResult, Issue, Resolution, Severity } from "./types";

export const ARTIFACT_SCHEMA = "policy-card/1.0";
export const PACKAGE_SCHEMA = "policy-card-package/1.0";

export interface AcceptedIssue {
  id: string;
  severity: Severity;
  resolved?: true;
}

/** Key order matches spec 6.6 exactly; the preview (DATA-14) prints in this order. */
export interface Artifact {
  schema: typeof ARTIFACT_SCHEMA;
  card_id: string;
  uri: string;
  type: Card["type"];
  title: string;
  policy: { id: string; version: string; effective_from: string; domain: string; owner: string };
  applicability: { loan_type?: string; lien?: string; occupancy?: string; channel?: string };
  source: { passage: string; passage_id: string; section: string; start: number; end: number; quote: string }[];
  content: Record<string, string>;
  relations: { type: "depends_on"; card_id: string }[];
  retrieval: { tags: string[] };
  quality: { confidence: number; machine_evaluable: boolean; accepted_issues: AcceptedIssue[] };
  review: { status: Decision };
  content_hash: string | null;
}

/** DATA-07: the artifact content key is the field key, suffixed "_inferred" when inferred. */
export const contentKey = (key: string, inferred?: boolean) => (inferred ? `${key}_inferred` : key);

/** DATA-15: warnings and notes on the card, plus resolved errors flagged as resolved. */
export function acceptedIssues(card: Card, issues: readonly Issue[], resolutions: Record<string, Resolution>): AcceptedIssue[] {
  return card.issueIds
    .map((id) => issues.find((i) => i.id === id))
    .filter((i): i is Issue => i !== undefined)
    .flatMap((i): AcceptedIssue[] => {
      if (i.severity !== "error") return [{ id: i.id, severity: i.severity }];
      return resolutions[i.id] ? [{ id: i.id, severity: "error", resolved: true }] : [];
    });
}

export function buildArtifact(
  card: Card,
  result: DecompositionResult,
  decision: Decision,
  resolutions: Record<string, Resolution>,
): Artifact {
  const { policy, applicability, passages, cards, issues } = result;
  const applies = {
    ...(applicability.loanType ? { loan_type: applicability.loanType } : {}),
    ...(applicability.lien ? { lien: applicability.lien } : {}),
    ...(applicability.occupancy ? { occupancy: applicability.occupancy } : {}),
    ...(applicability.channel ? { channel: applicability.channel } : {}),
  };
  return {
    schema: ARTIFACT_SCHEMA,
    card_id: card.cardId,
    uri: card.uri,
    type: card.type,
    title: card.title,
    policy: { id: policy.policyId, version: policy.version, effective_from: policy.effectiveFrom, domain: policy.domain, owner: policy.owner },
    applicability: applies,
    source: card.evidence.map((e) => {
      const p = passages.find((x) => x.id === e.passageId);
      return {
        passage: p?.ref ?? e.passageId,
        passage_id: e.passageId,
        section: p ? `Section ${p.sectionNo} ${p.sectionTitle}` : "",
        start: e.start,
        end: e.end,
        quote: e.quote,
      };
    }),
    content: Object.fromEntries(card.fields.map((f) => [contentKey(f.key, f.inferred), f.value])),
    relations: card.relations.map((r) => ({
      type: "depends_on" as const,
      card_id: cards.find((c) => c.shortId === r.shortId)?.cardId ?? r.shortId,
    })),
    retrieval: { tags: [...card.tags] },
    quality: { confidence: card.confidence, machine_evaluable: card.machineEvaluable, accepted_issues: acceptedIssues(card, issues, resolutions) },
    review: { status: decision },
    content_hash: null,
  };
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

/**
 * DATA-13: sha256 over RFC 8785 canonical JSON of the artifact without quality, review and
 * content_hash. Identity, content, lineage, applicability and relations change the hash; review
 * status and confidence do not.
 */
export async function contentHash(artifact: Artifact): Promise<string> {
  const { quality: _q, review: _r, content_hash: _h, ...core } = artifact;
  const canonical = canonicalize(core);
  if (canonical === undefined) throw new Error("artifact could not be canonicalised");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return `sha256:${hex(digest)}`;
}

export async function withHash(artifact: Artifact): Promise<Artifact> {
  return { ...artifact, content_hash: await contentHash(artifact) };
}

export interface PackageManifest {
  schema: typeof PACKAGE_SCHEMA;
  policy: { id: string; version: string };
  published_at: string;
  counts: { cards: number; published: number; rejected: number; passages: number; uncovered_passages: number };
  cards: { card_id: string; uri: string; type: Card["type"]; title: string; content_hash: string }[];
  rejected: { card_id: string; title: string }[];
  uncovered_passages: { passage: string; acknowledged: boolean }[];
}

export function buildManifest(
  result: DecompositionResult,
  published: readonly Artifact[],
  decisions: Record<string, Decision>,
  resolutions: Record<string, Resolution>,
  publishedAt: string,
): PackageManifest {
  const rejected = result.cards.filter((c) => decisions[c.shortId] === "rejected");
  const passageIssues = result.issues.filter((i) => i.cardIds.length === 0 && i.passageId);
  return {
    schema: PACKAGE_SCHEMA,
    policy: { id: result.policy.policyId, version: result.policy.version },
    published_at: publishedAt,
    counts: {
      cards: result.cards.length,
      published: published.length,
      rejected: rejected.length,
      passages: result.passages.length,
      uncovered_passages: passageIssues.length,
    },
    cards: published.map((a) => ({ card_id: a.card_id, uri: a.uri, type: a.type, title: a.title, content_hash: a.content_hash ?? "" })),
    rejected: rejected.map((c) => ({ card_id: c.cardId, title: c.title })),
    uncovered_passages: passageIssues.map((i) => ({
      passage: result.passages.find((p) => p.id === i.passageId)?.ref ?? i.passageId ?? "",
      acknowledged: Boolean(resolutions[i.id]),
    })),
  };
}
