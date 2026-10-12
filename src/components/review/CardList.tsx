import { Text, ToggleButton, ToggleButtonGroup } from "@salt-ds/core";
import { useEffect, useRef, type KeyboardEvent } from "react";
import { copy } from "../../app/copy";
import type { Card } from "../../domain/types";
import { decidedCards, decision, needsAttention, topOpenSeverity } from "../../store/selectors";
import type { ReviewFilter } from "../../store/state";
import { useAppState, useDispatch } from "../../store/StoreProvider";
import { SeverityBadge, StatusBadge } from "../cards/badges";
import { TypeGlyph } from "../cards/TypeGlyph";
import mono from "../../styles/mono.module.css";
import pane from "./pane.module.css";
import styles from "./CardList.module.css";
import { scrollWithin } from "./scrollWithin";
import { useReviewActions } from "./useReviewActions";

const FILTERS: readonly ReviewFilter[] = ["all", "attention", "decided"];

/** Cards pane (spec 9.3.3, UI-33, visual spec 8.4). */
export function CardList() {
  const state = useAppState();
  const dispatch = useDispatch();
  const { select } = useReviewActions();
  const paneRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const { filter, selectedCardId } = state.review;

  const all = state.result?.cards ?? [];
  const attention = needsAttention(state);
  const decided = decidedCards(state);
  const visible: Card[] = filter === "attention" ? attention : filter === "decided" ? decided : all;
  const label = { all: copy.review.filters.all(all.length), attention: copy.review.filters.attention(attention.length), decided: copy.review.filters.decided(decided.length) };

  // Keep the selected row visible when selection changes elsewhere (chips, relations, URL).
  useEffect(() => {
    scrollWithin(paneRef.current, listRef.current?.querySelector<HTMLElement>('[aria-current="true"]'));
  }, [selectedCardId]);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const idx = visible.findIndex((c) => c.shortId === selectedCardId);
    const target =
      e.key === "ArrowDown" ? Math.min(visible.length - 1, idx + 1)
      : e.key === "ArrowUp" ? Math.max(0, idx - 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? visible.length - 1
      : null;
    if (target === null || target < 0 || !visible[target]) return;
    e.preventDefault();
    select(visible[target].shortId);
    listRef.current?.querySelectorAll<HTMLButtonElement>("button[data-card]")[target]?.focus();
  };

  return (
    <section className={pane.pane} aria-label={copy.review.panes.cards} data-panel ref={paneRef}>
      <div className={`${pane.header} ${styles.header}`} data-sticky>
        <Text styleAs="h3">{copy.review.cardsTitle}</Text>
        <ToggleButtonGroup
          aria-label={copy.review.filterLabel}
          value={filter}
          onChange={(e) => dispatch({ type: "REVIEW_SET_FILTER", filter: e.currentTarget.value as ReviewFilter })}
          className={styles.filters}
        >
          {FILTERS.map((f) => <ToggleButton key={f} value={f}>{label[f]}</ToggleButton>)}
        </ToggleButtonGroup>
      </div>

      {visible.length === 0 ? (
        <Text color="secondary" className={styles.empty}>{copy.review.noMatch}</Text>
      ) : (
        <ul className={styles.list} ref={listRef}>
          {visible.map((c) => {
            const severity = topOpenSeverity(state, c);
            const selected = c.shortId === selectedCardId;
            return (
              <li key={c.shortId}>
                <button
                  type="button"
                  data-card={c.shortId}
                  className={styles.row}
                  aria-current={selected ? "true" : undefined}
                  tabIndex={selected || (!visible.some((v) => v.shortId === selectedCardId) && c === visible[0]) ? 0 : -1}
                  onClick={() => select(c.shortId)}
                  onKeyDown={onKeyDown}
                >
                  <span className={styles.glyph} data-type={c.type}><TypeGlyph type={c.type} size={16} /></span>
                  <span className={styles.body}>
                    <span className={styles.meta}>
                      <Text className={mono.mono}><strong>{c.shortId}</strong></Text>
                      <Text color="secondary">{copy.types[c.type].label}</Text>
                    </span>
                    <Text maxRows={2} className={styles.title}>{c.title}</Text>
                    {severity && <SeverityBadge severity={severity} />}
                  </span>
                  <StatusBadge decision={decision(state, c)} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
