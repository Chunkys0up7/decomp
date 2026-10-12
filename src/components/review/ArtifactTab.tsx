import { Button, Text, useAriaAnnouncer } from "@salt-ds/core";
import { CopyIcon } from "@salt-ds/icons";
import { copy } from "../../app/copy";
import { ARTIFACT_SCHEMA, buildArtifact } from "../../domain/artifact";
import type { Card } from "../../domain/types";
import { decision } from "../../store/selectors";
import { useAppState } from "../../store/StoreProvider";
import mono from "../../styles/mono.module.css";
import pane from "./pane.module.css";
import styles from "./tabs.module.css";

/** Identity, metadata and the artifact as it would publish (spec 9.3.8, DATA-14). */
export function ArtifactTab({ card }: { card: Card }) {
  const state = useAppState();
  const { announce } = useAriaAnnouncer();
  const result = state.result!;
  const status = decision(state, card);
  const artifact = buildArtifact(card, result, status, state.review.resolutions);
  const json = JSON.stringify(artifact, null, 2);
  const { policy, applicability: a } = result;
  const appliesTo = [a.loanType, a.lien && `${a.lien} lien`, a.occupancy, a.channel].filter(Boolean).join(" · ");
  const refs = [...new Set(card.evidence.map((e) => result.passages.find((p) => p.id === e.passageId)))]
    .filter((p) => p !== undefined)
    .sort((x, y) => x.order - y.order)
    .map((p) => p.ref)
    .join(", ");

  const values = [
    card.cardId, card.uri, copy.types[card.type].label, `${policy.policyId} · v${policy.version}`, refs,
    policy.effectiveFrom, appliesTo, policy.domain, card.tags.join(", "), copy.decision[status],
    copy.review.artifact.hashPending, ARTIFACT_SCHEMA,
  ];

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      announce(copy.review.artifact.copied);
    } catch {
      // Clipboard can be blocked (permissions, insecure context); the JSON stays selectable.
    }
  };

  return (
    <div className={styles.stack}>
      <section className={styles.section}>
        <Text styleAs="label" className={pane.microHeading}>{copy.review.artifact.identity}</Text>
        <dl className={styles.rows}>
          {copy.review.artifact.rows.map((label, i) => (
            <div key={label} className={styles.row}>
              <dt><Text styleAs="label" color="secondary">{label}</Text></dt>
              <dd><Text className={mono.mono}>{values[i]}</Text></dd>
            </div>
          ))}
        </dl>
        <Text color="secondary">{copy.review.artifact.note}</Text>
      </section>

      <section className={styles.section}>
        <div className={styles.previewHead}>
          <Text styleAs="label" className={pane.microHeading}>{copy.review.artifact.preview}</Text>
          <Button appearance="transparent" sentiment="neutral" onClick={onCopy}>
            <CopyIcon aria-hidden />
            {copy.review.artifact.copy}
          </Button>
        </div>
        <pre className={`${styles.json} ${mono.mono}`} role="region" tabIndex={0} aria-label={copy.review.artifact.previewLabel}>{json}</pre>
      </section>
    </div>
  );
}
