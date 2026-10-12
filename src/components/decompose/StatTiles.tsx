import { Text } from "@salt-ds/core";
import { copy } from "../../app/copy";
import { CARD_TYPES } from "../../domain/types";
import { openBlockingCount, openIssueBreakdown, openIssueCount, uncoveredPassages } from "../../store/selectors";
import { useAppState } from "../../store/StoreProvider";
import panel from "../../styles/panel.module.css";
import { TypeChip } from "../cards/badges";
import styles from "./decompose.module.css";

/** Four stat tiles (spec 9.2.2, visual spec 8.3). Values show "-" until known. */
export function StatTiles() {
  const state = useAppState();
  const { run, result } = state;
  const done = run.status === "completed" && result !== undefined;
  const dash = copy.decompose.tiles.pendingValue;

  const cardsValue = done ? result.cards.length : run.status === "running" && run.liveCounts.cards > 0 ? run.liveCounts.cards : dash;
  const uncovered = done ? uncoveredPassages(state) : [];
  const passages = state.document.passages?.length ?? 0;
  const open = done ? openIssueCount(state) : null;
  const blocking = done ? openBlockingCount(state) : 0;
  const breakdown = openIssueBreakdown(state);
  const byType = done ? CARD_TYPES.map((t) => [t, result.cards.filter((c) => c.type === t).length] as const).filter(([, n]) => n > 0) : [];

  return (
    <div className={styles.tiles}>
      <div className={panel.tile} data-testid="tile-cards">
        <Text styleAs="label" color="secondary">{copy.decompose.tiles.cards}</Text>
        <Text styleAs="h1" className={styles.value}>{cardsValue}</Text>
        <Text color="secondary">{copy.decompose.tiles.cardsNote}</Text>
      </div>
      <div className={panel.tile} data-testid="tile-covered">
        <Text styleAs="label" color="secondary">{copy.decompose.tiles.covered}</Text>
        <Text styleAs="h1" className={styles.value}>{done ? copy.decompose.tiles.coveredValue(passages - uncovered.length, passages) : dash}</Text>
        <Text color="secondary">{done ? (uncovered.length ? copy.decompose.tiles.uncoveredNote(uncovered.map((p) => p.ref)) : copy.decompose.tiles.allCovered) : ""}</Text>
      </div>
      <div className={panel.tile} data-testid="tile-issues" data-attention={open ? "true" : undefined}>
        <Text styleAs="label" color="secondary">{copy.decompose.tiles.issues}</Text>
        <Text styleAs="h1" className={styles.value} data-blocking={blocking > 0 || undefined}>{open ?? (run.status === "running" && run.liveCounts.issues > 0 ? run.liveCounts.issues : dash)}</Text>
        <Text color="secondary">{done ? (open ? copy.decompose.tiles.issuesNote(breakdown.error, breakdown.warning, breakdown.info) : copy.decompose.tiles.noIssues) : ""}</Text>
      </div>
      <div className={panel.tile} data-testid="tile-types">
        <Text styleAs="label" color="secondary">{copy.decompose.tiles.byType}</Text>
        {done ? (
          <div className={styles.typeList}>
            {byType.map(([t, n]) => <TypeChip key={t} type={t}>{`${copy.types[t].label} ${n}`}</TypeChip>)}
          </div>
        ) : (
          <Text styleAs="h1" className={styles.value}>{dash}</Text>
        )}
      </div>
    </div>
  );
}
