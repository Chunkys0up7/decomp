// Domain model (build spec 6.1). Pure data; no behaviour.

export type CardType = "fact" | "rule" | "calculation" | "procedure";
export type Severity = "error" | "warning" | "info";
export type Decision = "pending" | "approved" | "rejected";
export type Granularity = "atomic" | "section";
export type CheckKey = "ambiguity" | "references" | "conflicts" | "inferred";
export type StageId = "parse" | "extract" | "lineage" | "check" | "assign_ids";

export const CARD_TYPES: readonly CardType[] = ["fact", "rule", "calculation", "procedure"];
export const STAGE_IDS: readonly StageId[] = ["parse", "extract", "lineage", "check", "assign_ids"];
export const CHECK_KEYS: readonly CheckKey[] = ["ambiguity", "references", "conflicts", "inferred"];

export interface PolicyMeta {
  policyId: string;
  version: string;
  effectiveFrom: string;
  domain: string;
  channel: string;
  owner: string;
}

export interface PolicyApplicability {
  loanType?: string;
  lien?: string;
  occupancy?: string;
  channel?: string;
}

export interface Passage {
  id: string;
  order: number;
  /** Section number without a section sign, e.g. "2" (deviation D-C1). */
  sectionNo: string;
  sectionTitle: string;
  /** Clause reference, e.g. "2.3" or "4.2(b)(i)". */
  ref: string;
  label?: string;
  text: string;
}

export interface Evidence {
  passageId: string;
  start: number;
  end: number;
  quote: string;
}

export interface CardField {
  key: string;
  label: string;
  value: string;
  mono?: boolean;
  inferred?: boolean;
}

export interface Relation {
  kind: "depends_on";
  shortId: string;
}

export interface Card {
  seq: number;
  shortId: string;
  cardId: string;
  uri: string;
  type: CardType;
  title: string;
  fields: CardField[];
  evidence: Evidence[];
  tags: string[];
  confidence: number;
  machineEvaluable: boolean;
  issueIds: string[];
  relations: Relation[];
}

export type IssueKind = "not_evaluable" | "conflict" | "unresolved_reference" | "undefined_term" | "inferred" | "no_card";

export interface Issue {
  id: string;
  severity: Severity;
  kind: IssueKind;
  title: string;
  detail: string;
  fix: string;
  cardIds: string[];
  passageId?: string;
}

export interface DecompositionResult {
  runId: string;
  policy: PolicyMeta;
  applicability: PolicyApplicability;
  passages: Passage[];
  cards: Card[];
  issues: Issue[];
}

export interface Resolution {
  issueId: string;
  at: string;
}

export const TYPE_CODE: Record<CardType, "F" | "R" | "C" | "P"> = {
  fact: "F",
  rule: "R",
  calculation: "C",
  procedure: "P",
};
