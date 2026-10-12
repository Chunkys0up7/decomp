import { Text } from "@salt-ds/core";
import { Fragment } from "react";
import { copy } from "../../app/copy";
import { isEvidenceVerified } from "../../domain/evidence";
import type { Card } from "../../domain/types";
import { dependsOn, usedBy } from "../../store/selectors";
import { useAppState } from "../../store/StoreProvider";
import mono from "../../styles/mono.module.css";
import { TypeGlyph } from "../cards/TypeGlyph";
import pane from "./pane.module.css";
import styles from "./tabs.module.css";
import { useReviewActions } from "./useReviewActions";

const unique = <T,>(xs: T[]) => [...new Set(xs)];

/** Trace, evidence, relations and confidence (spec 9.3.7). */
export function LineageTab({ card }: { card: Card }) {
  const state = useAppState();
  const { select } = useReviewActions();
  const result = state.result!;
  const passages = unique(card.evidence.map((e) => e.passageId))
    .map((id) => result.passages.find((p) => p.id === id))
    .filter((p) => p !== undefined)
    .sort((a, b) => a.order - b.order);
  const sections = unique(passages.map((p) => copy.section(p.sectionNo, p.sectionTitle)));
  const relations = [
    ...dependsOn(state, card).map((c) => ({ kind: copy.review.lineage.dependsOn, card: c })),
    ...usedBy(state, card).map((c) => ({ kind: copy.review.lineage.usedBy, card: c })),
  ];
  const level = card.confidence < 0.6 ? "low" : card.confidence < 0.9 ? "mid" : "high";

  const nodes = [
    { label: copy.review.lineage.nodes.document, value: copy.app.context(result.policy.policyId, result.policy.version), mono: true },
    { label: copy.review.lineage.nodes.section, value: sections.join(", "), mono: false },
    { label: copy.review.lineage.nodes.passage, value: passages.map((p) => p.ref).join(", "), mono: true },
    { label: copy.review.lineage.nodes.card, value: card.cardId, mono: true, current: true },
  ];

  return (
    <div className={styles.stack}>
      <section className={styles.section}>
        <Text styleAs="label" className={pane.microHeading}>{copy.review.lineage.trace}</Text>
        <div className={styles.trace}>
          {nodes.map((n, i) => (
            <Fragment key={n.label}>
              {i > 0 && <span className={styles.connector} aria-hidden="true" />}
              <div className={styles.node} data-current={n.current || undefined}>
                <Text color="secondary">{n.label}</Text>
                <Text className={n.mono ? mono.mono : undefined}>{n.current ? <strong>{n.value}</strong> : n.value}</Text>
              </div>
            </Fragment>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <Text styleAs="label" className={pane.microHeading}>{copy.review.lineage.evidence}</Text>
        {card.evidence.map((e, i) => {
          const p = result.passages.find((x) => x.id === e.passageId);
          const verified = isEvidenceVerified(e, result.passages);
          return (
            <blockquote key={i} className={styles.quote} data-unverified={!verified || undefined}>
              <Text color="secondary" className={mono.mono}><strong>{p ? `${p.ref} · ${copy.section(p.sectionNo, p.sectionTitle)}` : e.passageId}</strong></Text>
              {!verified && <Text styleAs="label" className={styles.unverifiedTag}>{copy.review.lineage.unverified}</Text>}
              <Text>“{e.quote}”</Text>
              {!verified && <Text color="error">{copy.review.lineage.unverifiedNote}</Text>}
            </blockquote>
          );
        })}
      </section>

      <section className={styles.section}>
        <Text styleAs="label" className={pane.microHeading}>{copy.review.lineage.relations}</Text>
        {relations.length === 0 ? (
          <Text color="secondary">{copy.review.lineage.alone}</Text>
        ) : (
          <ul className={styles.relations}>
            {relations.map((r) => (
              <li key={`${r.kind}-${r.card.shortId}`}>
                <button type="button" className={styles.relation} onClick={() => select(r.card.shortId)}>
                  <Text color="secondary">{r.kind}</Text>
                  <TypeGlyph type={r.card.type} />
                  <Text className={mono.mono}><strong>{r.card.shortId}</strong></Text>
                  <Text>{r.card.title}</Text>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <Text styleAs="label" className={pane.microHeading}>{copy.review.lineage.confidence}</Text>
        <div className={styles.confidence}>
          <span className={styles.track} aria-hidden="true">
            <span className={styles.fill} data-level={level} style={{ display: "block", width: `${card.confidence * 100}%` }} />
          </span>
          <Text className={mono.mono}>{card.confidence.toFixed(2)}</Text>
        </div>
      </section>
    </div>
  );
}
