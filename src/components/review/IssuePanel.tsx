import { Button, Text } from "@salt-ds/core";
import { copy } from "../../app/copy";
import type { Card } from "../../domain/types";
import { cardIssues, isOpen } from "../../store/selectors";
import { useAppState } from "../../store/StoreProvider";
import mono from "../../styles/mono.module.css";
import { SeverityBadge } from "../cards/badges";
import pane from "./pane.module.css";
import styles from "./IssuePanel.module.css";
import { useReviewActions } from "./useReviewActions";

/** "Issues on this card" (spec 9.3.5). The only place severity colours appear in the detail pane. */
export function IssuePanel({ card }: { card: Card }) {
  const state = useAppState();
  const { resolve, unresolve } = useReviewActions();
  const issues = cardIssues(state, card);
  if (issues.length === 0) return null;

  return (
    <section className={styles.block} aria-labelledby="issues-heading">
      <Text styleAs="label" id="issues-heading" className={pane.microHeading}>{copy.review.issuesHeading}</Text>
      <ul className={styles.list}>
        {issues.map((issue) => {
          const open = isOpen(state, issue);
          const isError = issue.severity === "error";
          return (
            <li key={issue.id} className={styles.issue} data-severity={issue.severity} data-open={open}>
              <div className={styles.top}>
                <SeverityBadge severity={issue.severity} />
                <Text className={styles.title}><strong>{issue.title}</strong></Text>
                <Text color="secondary" className={mono.mono}>{issue.id}</Text>
              </div>
              <Text>{issue.detail}</Text>
              <Text><strong>{copy.review.suggestedFix}</strong> {issue.fix}</Text>
              <div className={styles.actions}>
                {open ? (
                  <Button appearance="bordered" sentiment="neutral" onClick={() => resolve(issue)}>
                    {isError ? copy.review.markResolved : copy.review.ack}
                  </Button>
                ) : (
                  <>
                    <Text color="success">{isError ? copy.review.resolved : copy.review.ackDone}</Text>
                    <Button appearance="transparent" sentiment="neutral" onClick={() => unresolve(issue)}>{copy.review.undo}</Button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
