// ID and URI rules (build spec 6.2). The pipeline adapter generates IDs; the UI only displays
// them (DATA-02). These functions exist so adapters and validation (VAL-03) agree on one rule.
import { TYPE_CODE, type CardType } from "./types";

const pad3 = (n: number) => String(n).padStart(3, "0");

export function shortId(type: CardType, seq: number): string {
  return `${TYPE_CODE[type]}-${pad3(seq)}`;
}

/** "POL-HL-0142" -> "HL0142": leading "POL-" removed, then non-alphanumerics removed, uppercased. */
export function policyKey(policyId: string): string {
  return policyId.replace(/^POL-/i, "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export function cardId(policyId: string, type: CardType, seq: number): string {
  return `PC-${policyKey(policyId)}-${TYPE_CODE[type]}${pad3(seq)}`;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/**
 * "pc://{seg2}/{seg1}-{seg3}/v{version}/{type}/{seq}" when the policy ID has exactly three
 * dash-separated segments, else "pc://default/{slug(policyId)}/v{version}/{type}/{seq}".
 */
export function cardUri(policyId: string, version: string, type: CardType, seq: number): string {
  const segs = policyId.split("-");
  if (segs.length === 3 && segs.every(Boolean)) {
    const [s1, s2, s3] = segs.map((s) => s.toLowerCase());
    return `pc://${s2}/${s1}-${s3}/v${version}/${type}/${pad3(seq)}`;
  }
  return `pc://default/${slug(policyId)}/v${version}/${type}/${pad3(seq)}`;
}

/** Standard policy ID form (DATA-06). Non-matching IDs are allowed with a warning. */
export const STANDARD_POLICY_ID = /^[A-Z]{2,5}-[A-Z]{2,5}-[0-9]{3,6}$/;
