import { Button, Text } from "@salt-ds/core";
import { Fragment, useEffect, useRef } from "react";
import { copy } from "../../app/copy";
import { splitMarks } from "../../domain/evidence";
import { startsSection } from "../../domain/passages";
import type { Passage, Severity } from "../../domain/types";
import { passageCards, passageLevelIssues, passageOpenIssues, selectedCard, uncoveredPassages, isOpen } from "../../store/selectors";
import { useAppState } from "../../store/StoreProvider";
import mono from "../../styles/mono.module.css";
import { TypeGlyph } from "../cards/TypeGlyph";
import pane from "./pane.module.css";
import styles from "./SourcePane.module.css";
import { scrollWithin } from "./scrollWithin";
import { useReviewActions } from "./useReviewActions";

const RANK: Record<Severity, number> = { error: 3, warning: 2, info: 1 };

/** Source pane (spec 9.3.4, visual spec 8.4). Passage text is rendered verbatim (DATA-04). */
export function SourcePane() {
  const state = useAppState();
  const { select, resolve, unresolve } = useReviewActions();
  const paneRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const result = state.result!;
  const card = selectedCard(state);
  const linked = new Set(card?.evidence.map((e) => e.passageId));
  const covered = result.passages.length - uncoveredPassages(state).length;
  const title = state.document.fileName?.replace(/\.[^.]+$/, "") ?? result.policy.policyId;

  // UI-34: bring the first linked passage into view only if it is not already visible.
  useEffect(() => {
    scrollWithin(paneRef.current, bodyRef.current?.querySelector<HTMLElement>("[data-linked='true']"), "start");
  }, [card?.shortId]);

  const renderText = (p: Passage) => {
    const spans = card?.evidence.filter((e) => e.passageId === p.id) ?? [];
    return splitMarks(p.text, spans).map((seg, i) =>
      seg.marked ? <mark key={i} className={styles.evidence}>{seg.text}</mark> : <Fragment key={i}>{seg.text}</Fragment>,
    );
  };

  return (
    <section className={pane.pane} aria-label={copy.review.panes.source} data-panel ref={paneRef}>
      <div className={pane.header} data-sticky>
        <div className={styles.headerText}>
          <div className={styles.titleRow}>
            <Text styleAs="h3">{copy.review.sourceTitle(title)}</Text>
            <Text color="secondary" className={mono.mono}>{copy.app.context(result.policy.policyId, result.policy.version)}</Text>
          </div>
          <Text color="secondary" className={styles.legend}>
            <span className={styles.swatch} aria-hidden="true" />
            {copy.review.sourceLegend(covered, result.passages.length)}
          </Text>
        </div>
      </div>

      <div className={styles.body} ref={bodyRef}>
        {result.passages.map((p, i) => {
          const showSection = startsSection(result.passages, i);
          const cards = passageCards(state, p);
          const open = passageOpenIssues(state, p);
          const top = open.reduce<Severity | null>((t, i) => (!t || RANK[i.severity] > RANK[t] ? i.severity : t), null);
          const uncovered = cards.length === 0;
          const ack = passageLevelIssues(state, p)[0];
          return (
            <Fragment key={p.id}>
              {showSection && <Text styleAs="label" className={pane.microHeading}>{copy.section(p.sectionNo, p.sectionTitle)}</Text>}
              <article
                className={styles.passage}
                data-linked={linked.has(p.id) ? "true" : undefined}
                data-uncovered={uncovered ? "true" : undefined}
                data-passage={p.id}
                aria-label={p.ref}
              >
                <div className={styles.passageTop}>
                  <Text className={mono.mono} color="secondary"><strong>{p.ref}</strong></Text>
                  {top && <span className={styles.issueTag} data-severity={top}><Text styleAs="label" className={styles.inherit}>{copy.review.openIssueTag(open.length)}</Text></span>}
                </div>
                <Text className={styles.text}>{renderText(p)}</Text>
                {cards.length > 0 && (
                  <div className={styles.chips}>
                    {cards.map((c) => (
                      <button
                        key={c.shortId}
                        type="button"
                        className={styles.chip}
                        data-type={c.type}
                        aria-pressed={c.shortId === card?.shortId}
                        onClick={() => select(c.shortId)}
                      >
                        <TypeGlyph type={c.type} size={12} />
                        <Text styleAs="label" className={`${mono.mono} ${styles.inherit}`}>{c.shortId}</Text>
                      </button>
                    ))}
                  </div>
                )}
                {uncovered && ack && (
                  <div className={styles.uncoveredRow}>
                    <Text className={styles.noCard}><strong>{copy.review.noCardGenerated}</strong></Text>
                    <Button appearance="bordered" sentiment="neutral" onClick={() => (isOpen(state, ack) ? resolve(ack) : unresolve(ack))}>
                      {isOpen(state, ack) ? copy.review.acknowledge : copy.review.acknowledged}
                    </Button>
                  </div>
                )}
              </article>
            </Fragment>
          );
        })}
      </div>
    </section>
  );
}
