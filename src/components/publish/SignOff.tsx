import { Text } from "@salt-ds/core";
import { CheckmarkIcon, ErrorIcon, InfoIcon } from "@salt-ds/icons";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { copy } from "../../app/copy";
import { acceptedIssues } from "../../domain/artifact";
import { counts, decision, isBlocked, isOpen, publishGates } from "../../store/selectors";
import { useAppState } from "../../store/StoreProvider";
import panel from "../../styles/panel.module.css";
import styles from "./publish.module.css";

type Kind = "pass" | "fail" | "info";
const ICON: Record<Kind, ReactNode> = { pass: <CheckmarkIcon aria-hidden />, fail: <ErrorIcon aria-hidden />, info: <InfoIcon aria-hidden /> };

function Check({ kind, children }: { kind: Kind; children: ReactNode }) {
  return (
    <li className={styles.check}>
      <span className={styles.checkIcon} data-kind={kind}>{ICON[kind]}</span>
      <span className={styles.checkText}>{children}</span>
    </li>
  );
}

/** Sign-off checks and what every artifact carries (spec 9.4.4). */
export function SignOff() {
  const state = useAppState();
  const result = state.result!;
  const gates = publishGates(state);
  const c = counts(state);
  const blockingApproved = result.cards.filter((x) => decision(state, x) === "approved" && isBlocked(state, x)).length;
  const passageIssues = result.issues.filter((i) => i.cardIds.length === 0 && i.passageId);
  const unacknowledged = passageIssues.filter((i) => isOpen(state, i));
  const refOf = (id?: string) => result.passages.find((p) => p.id === id)?.ref ?? "";
  // Warnings and notes carried by approved cards (DATA-15), each counted once.
  const accepted = new Map(
    result.cards
      .filter((x) => decision(state, x) === "approved")
      .flatMap((x) => acceptedIssues(x, result.issues, state.review.resolutions))
      .map((i) => [i.id, i.severity] as const),
  );
  const warnings = [...accepted.values()].filter((sev) => sev === "warning").length;
  const notes = [...accepted.values()].filter((sev) => sev === "info").length;
  const fix = <Link to="/review?filter=attention">{copy.publish.fixInReview}</Link>;

  return (
    <div className={styles.side}>
      <section className={panel.panel} data-panel aria-labelledby="signoff-heading">
        <Text styleAs="h3" id="signoff-heading">{copy.publish.signoff}</Text>
        <ul className={styles.checks}>
          {gates.allDecided ? (
            <Check kind="pass"><Text>{copy.publish.checks.decided.pass(c.total)}</Text></Check>
          ) : (
            <Check kind="fail"><Text>{copy.publish.checks.decided.fail(c.pending)}</Text>{fix}</Check>
          )}
          {gates.noBlockingOnApproved ? (
            <Check kind="pass"><Text>{copy.publish.checks.blocking.pass}</Text></Check>
          ) : (
            <Check kind="fail"><Text>{copy.publish.checks.blocking.fail(blockingApproved)}</Text>{fix}</Check>
          )}
          {passageIssues.length === 0 ? (
            <Check kind="pass"><Text>{copy.publish.checks.uncovered.none}</Text></Check>
          ) : gates.uncoveredAcknowledged ? (
            <Check kind="pass"><Text>{copy.publish.checks.uncovered.pass}</Text></Check>
          ) : (
            <Check kind="fail"><Text>{copy.publish.checks.uncovered.fail(unacknowledged.length, unacknowledged.map((i) => refOf(i.passageId)).join(", "))}</Text>{fix}</Check>
          )}
          {warnings + notes > 0 && <Check kind="info"><Text>{copy.publish.checks.accepted(warnings, notes)}</Text></Check>}
        </ul>
      </section>

      <section className={panel.panel} data-panel aria-labelledby="carries-heading">
        <Text styleAs="h3" id="carries-heading">{copy.publish.carriesTitle}</Text>
        <dl className={styles.carries}>
          {copy.publish.carries.map(([term, def]) => (
            <div key={term} className={styles.carry}>
              <dt><Text styleAs="label" color="secondary">{term}</Text></dt>
              <dd><Text>{def}</Text></dd>
            </div>
          ))}
        </dl>
        <Text color="secondary">{copy.publish.carriesNote}</Text>
      </section>
    </div>
  );
}
