// Policy metadata validation (build spec 9.1.6, UI-21). Returns message keys, not copy:
// screens map keys to text through the copy catalog.
import { STANDARD_POLICY_ID } from "./ids";
import type { PolicyMeta } from "./types";

export type MetaField = keyof PolicyMeta;
export type MetaError = "required" | "format";
export interface FieldCheck {
  error?: MetaError;
  /** Policy ID only: non-standard form is allowed but warned (DATA-06). */
  warning?: "nonStandardId";
}

const isCalendarDate = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
};

export function checkField(field: MetaField, raw: string): FieldCheck {
  const value = raw.trim();
  if (!value) return { error: "required" };
  switch (field) {
    case "policyId":
      return STANDARD_POLICY_ID.test(value) ? {} : { warning: "nonStandardId" };
    case "version":
      return /^[0-9]+(\.[0-9]+)*$/.test(value) ? {} : { error: "format" };
    case "effectiveFrom":
      return isCalendarDate(value) ? {} : { error: "format" };
    default:
      return {};
  }
}

export function isMetaValid(meta: PolicyMeta): boolean {
  return (Object.keys(meta) as MetaField[]).every((f) => !checkField(f, meta[f]).error);
}

/** UI-21: trim on blur; Policy ID is upper-cased. */
export function normaliseField(field: MetaField, raw: string): string {
  const v = raw.trim();
  return field === "policyId" ? v.toUpperCase() : v;
}
