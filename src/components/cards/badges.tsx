import { Text } from "@salt-ds/core";
import { CheckmarkIcon, CloseIcon, ErrorIcon, InfoIcon, WarningIcon } from "@salt-ds/icons";
import type { ReactNode } from "react";
import { copy } from "../../app/copy";
import type { CardType, Decision, Severity } from "../../domain/types";
import { TypeGlyph } from "./TypeGlyph";
import styles from "./badges.module.css";

/** Card-type chip: glyph + label on the type tint (visual spec 4.4). */
export function TypeChip({ type, children }: { type: CardType; children?: ReactNode }) {
  return (
    <span className={styles.typeChip} data-type={type}>
      <TypeGlyph type={type} size={12} />
      <Text styleAs="label" className={styles.inherit}>{children ?? copy.types[type].label}</Text>
    </span>
  );
}

const SEVERITY_ICON: Record<Severity, ReactNode> = {
  error: <ErrorIcon aria-hidden />,
  warning: <WarningIcon aria-hidden />,
  info: <InfoIcon aria-hidden />,
};

/** Severity badge: the label is always shown (UI-47, A11Y-08). */
export function SeverityBadge({ severity, size = "small" }: { severity: Severity; size?: "small" | "large" }) {
  return (
    <span className={styles.badge} data-severity={severity} data-size={size}>
      {SEVERITY_ICON[severity]}
      <Text styleAs="label" className={styles.inherit}>{copy.severity[severity]}</Text>
    </span>
  );
}

/** Decision badge. Approved always pairs green with a check and the word (visual spec 4.3). */
export function StatusBadge({ decision, size = "small" }: { decision: Decision; size?: "small" | "large" }) {
  return (
    <span className={styles.badge} data-decision={decision} data-size={size}>
      {decision === "approved" && <CheckmarkIcon aria-hidden />}
      {decision === "rejected" && <CloseIcon aria-hidden />}
      <Text styleAs="label" className={styles.inherit}>{copy.decision[decision]}</Text>
    </span>
  );
}
