import { Text } from "@salt-ds/core";
import { CheckmarkIcon, ErrorIcon } from "@salt-ds/icons";
import { copy } from "../../app/copy";
import type { Card } from "../../domain/types";
import mono from "../../styles/mono.module.css";
import pane from "./pane.module.css";
import styles from "./tabs.module.css";

/** What an agent reads (spec 9.3.6, DATA-07, DATA-08). */
export function CardTab({ card }: { card: Card }) {
  return (
    <div className={styles.section}>
      <div className={styles.headingRow}>
        <Text styleAs="label" className={pane.microHeading}>{copy.review.agentReads}</Text>
        {card.machineEvaluable ? (
          <Text color="success" className={styles.iconText}><CheckmarkIcon aria-hidden />{copy.review.machine.yes}</Text>
        ) : (
          <Text color="error" className={styles.iconText}><ErrorIcon aria-hidden />{copy.review.machine.no}</Text>
        )}
      </div>
      <dl className={styles.rows}>
        {card.fields.map((f) => (
          <div key={f.key} className={styles.row}>
            <dt><Text styleAs="label" color="secondary">{f.label}{f.inferred ? copy.review.inferredSuffix : ""}</Text></dt>
            <dd><Text className={f.mono ? mono.mono : undefined}>{f.value}</Text></dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
