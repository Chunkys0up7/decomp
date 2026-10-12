import { Text } from "@salt-ds/core";
import { Fragment } from "react";
import { Link } from "react-router-dom";
import { copy } from "../../app/copy";
import { startsSection } from "../../domain/passages";
import type { Passage } from "../../domain/types";
import { passageCards } from "../../store/selectors";
import { useAppState } from "../../store/StoreProvider";
import mono from "../../styles/mono.module.css";
import panel from "../../styles/panel.module.css";
import styles from "./decompose.module.css";

const label = (p: Passage) => p.label ?? `${p.text.split(/\s+/).slice(0, 6).join(" ")}…`;

/** Document structure and coverage (spec 9.2.3). Card IDs link into review. */
export function CoveragePanel() {
  const state = useAppState();
  const completed = state.run.status === "completed" && state.result !== undefined;
  const parsed = completed || state.run.stages.parse.status === "done";
  const passages = state.result?.passages ?? state.document.passages ?? [];
  const policyId = state.result?.policy.policyId ?? state.meta.policyId;

  return (
    <section className={`${panel.panel} ${styles.coverage}`} data-panel aria-labelledby="coverage-heading">
      <div className={panel.headingRow}>
        <Text styleAs="h3" id="coverage-heading">{copy.decompose.structureTitle}</Text>
        <Text color="secondary" className={mono.mono}>{policyId}</Text>
      </div>
      {parsed && (
        <ul className={styles.passages}>
          {passages.map((p, i) => {
            const showSection = startsSection(passages, i);
            const cards = completed ? passageCards(state, p) : [];
            const uncovered = completed && cards.length === 0;
            return (
              <Fragment key={p.id}>
                {showSection && (
                  <li className={styles.sectionRow} aria-hidden="true">
                    <Text styleAs="label">{copy.section(p.sectionNo, p.sectionTitle)}</Text>
                  </li>
                )}
                <li className={styles.passageRow} data-uncovered={uncovered || undefined}>
                  <Text color="secondary" className={mono.mono}>{p.ref}</Text>
                  <Text className={styles.passageLabel}>{label(p)}</Text>
                  <span className={styles.passageCards}>
                    {uncovered ? (
                      <Link to="/review?filter=attention" className={styles.noCard}><Text><strong>{copy.decompose.noCard}</strong></Text></Link>
                    ) : (
                      cards.map((c) => (
                        <Link key={c.shortId} to={`/review?card=${c.shortId}`} className={`${styles.cardLink} ${mono.mono}`}>{c.shortId}</Link>
                      ))
                    )}
                  </span>
                </li>
              </Fragment>
            );
          })}
        </ul>
      )}
    </section>
  );
}
