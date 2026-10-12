import { Table, TBody, TD, TH, THead, TR, Text } from "@salt-ds/core";
import { copy } from "../../app/copy";
import { decision } from "../../store/selectors";
import { useAppState } from "../../store/StoreProvider";
import mono from "../../styles/mono.module.css";
import panel from "../../styles/panel.module.css";
import { StatusBadge } from "../cards/badges";
import { TypeGlyph } from "../cards/TypeGlyph";
import styles from "./publish.module.css";

/** Artifacts in this package (spec 9.4.3, visual spec 8.5). Pending cards cannot reach this screen. */
export function ArtifactsTable() {
  const state = useAppState();
  const result = state.result!;
  const cards = [...result.cards].sort((a, b) => a.seq - b.seq);
  const refs = (passageIds: string[]) =>
    [...new Set(passageIds)]
      .map((id) => result.passages.find((p) => p.id === id))
      .filter((p) => p !== undefined)
      .sort((a, b) => a.order - b.order)
      .map((p) => p.ref)
      .join(", ");

  return (
    <section className={`${panel.panel} ${styles.artifacts}`} data-panel aria-labelledby="artifacts-heading">
      <div className={styles.tableHeader}>
        <Text styleAs="h2" id="artifacts-heading">{copy.publish.tableTitle}</Text>
        <Text color="secondary">{copy.publish.pkg(result.policy.policyId, result.policy.version)}</Text>
      </div>
      <div className={styles.scroller} tabIndex={0} role="region" aria-labelledby="artifacts-heading">
        <Table className={styles.table}>
          <THead>
            <TR>{copy.publish.cols.map((c) => <TH key={c} scope="col">{c}</TH>)}</TR>
          </THead>
          <TBody>
            {cards.map((c) => {
              const d = decision(state, c);
              const rejected = d === "rejected";
              return (
                <TR key={c.shortId} data-rejected={rejected || undefined} className={styles.row}>
                  <TD><Text className={`${mono.mono} ${styles.nowrap}`}>{c.cardId}</Text></TD>
                  <TD><span className={styles.type}><TypeGlyph type={c.type} />{copy.types[c.type].label}</span></TD>
                  <TD>{c.title}</TD>
                  <TD><Text className={mono.mono}>{refs(c.evidence.map((e) => e.passageId))}</Text></TD>
                  <TD><StatusBadge decision={d} /></TD>
                  <TD>{rejected ? <Text color="secondary">{copy.publish.notPublished}</Text> : <Text className={mono.mono}>{c.uri}</Text>}</TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </div>
    </section>
  );
}
