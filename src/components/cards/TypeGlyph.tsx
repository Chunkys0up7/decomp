import type { CardType } from "../../domain/types";

// Shape carries type as well as colour (spec 10.4, A.1): circle, diamond, square, triangle.
const PATH: Record<CardType, string> = {
  fact: "M7 1.5a5.5 5.5 0 1 0 0 11a5.5 5.5 0 1 0 0-11Z",
  rule: "M7 1 13 7 7 13 1 7Z",
  calculation: "M1.5 1.5h11v11h-11Z",
  procedure: "M7 1.5 13 12.5H1Z",
};

// Spelled out so scripts/verify-tokens.mjs can check every token exists.
const FILL: Record<CardType, string> = {
  fact: "var(--pc-type-fact)",
  rule: "var(--pc-type-rule)",
  calculation: "var(--pc-type-calculation)",
  procedure: "var(--pc-type-procedure)",
};

/** Decorative: always rendered next to the type name or short ID (UI-49). */
export function TypeGlyph({ type, size = 14 }: { type: CardType; size?: 12 | 14 | 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true" focusable="false">
      <path d={PATH[type]} fill={FILL[type]} />
    </svg>
  );
}
