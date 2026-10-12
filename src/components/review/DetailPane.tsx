import { Banner, BannerActions, BannerContent, Button, H2, Tab, TabBar, TabList, TabPanel, Tabs, TabTrigger, Text, Tooltip } from "@salt-ds/core";
import { CloseIcon } from "@salt-ds/icons";
import { useEffect, useRef } from "react";
import { copy } from "../../app/copy";
import { isEvidenceVerified } from "../../domain/evidence";
import { decision, isBlocked, selectedCard } from "../../store/selectors";
import type { ReviewTab } from "../../store/state";
import { useAppState, useDispatch } from "../../store/StoreProvider";
import mono from "../../styles/mono.module.css";
import { StatusBadge, TypeChip } from "../cards/badges";
import { ArtifactTab } from "./ArtifactTab";
import { CardTab } from "./CardTab";
import styles from "./DetailPane.module.css";
import { IssuePanel } from "./IssuePanel";
import { LineageTab } from "./LineageTab";
import pane from "./pane.module.css";
import { useReviewActions } from "./useReviewActions";

const TABS: readonly ReviewTab[] = ["card", "lineage", "artifact"];

/** Card detail (spec 9.3.4a to 9.3.8, UI-35, visual spec 8.4). */
export function DetailPane() {
  const state = useAppState();
  const dispatch = useDispatch();
  const { approve, reject, reopen } = useReviewActions();
  const card = selectedCard(state);

  const approveRef = useRef<HTMLButtonElement>(null);
  const rejectRef = useRef<HTMLButtonElement>(null);
  const reopenRef = useRef<HTMLButtonElement>(null);
  const focusAfter = useRef<"reopen" | "decide" | null>(null);

  const status = card ? decision(state, card) : "pending";
  const blocked = card ? isBlocked(state, card) : false;

  // UI-35 / A11Y-02: after a decision, focus Reopen; after Reopen, focus Approve (or Reject if blocked).
  useEffect(() => {
    if (focusAfter.current === "reopen") reopenRef.current?.focus();
    if (focusAfter.current === "decide") (blocked ? rejectRef : approveRef).current?.focus();
    focusAfter.current = null;
  }, [status, blocked]);

  if (!card) return <section className={pane.pane} aria-label={copy.review.panes.detail} data-panel />;
  const unverified = card.evidence.some((e) => !isEvidenceVerified(e, state.result!.passages));

  return (
    <section className={pane.pane} aria-label={copy.review.panes.detail} data-panel>
      <div className={`${pane.header} ${styles.header}`}>
        <div className={styles.identity}>
          <div className={styles.idRow}>
            <TypeChip type={card.type} />
            <Text color="secondary" className={mono.mono}>{card.cardId}</Text>
          </div>
          <H2 className={styles.title}>{card.title}</H2>
        </div>
        <StatusBadge decision={status} size="large" />

        <div className={styles.actions}>
          {status === "pending" ? (
            <>
              <Tooltip content={copy.review.needResolve} disabled={!blocked}>
                <Button
                  ref={approveRef}
                  appearance="solid"
                  sentiment="accented"
                  disabled={blocked}
                  focusableWhenDisabled
                  onClick={() => { if (approve(card.shortId)) focusAfter.current = "reopen"; }}
                >
                  {copy.review.approve}
                </Button>
              </Tooltip>
              <Button
                ref={rejectRef}
                appearance="bordered"
                sentiment="negative"
                onClick={() => { if (reject(card.shortId)) focusAfter.current = "reopen"; }}
              >
                {copy.review.reject}
              </Button>
              {blocked && <Text color="error">{copy.review.needResolve}</Text>}
            </>
          ) : (
            <>
              <Button ref={reopenRef} appearance="transparent" sentiment="accented" onClick={() => { if (reopen(card.shortId)) focusAfter.current = "decide"; }}>
                {copy.review.reopen}
              </Button>
              <Text color="secondary">{status === "approved" ? copy.review.approvedNote : copy.review.rejectedNote}</Text>
            </>
          )}
        </div>
      </div>

      <div className={pane.body}>
        {unverified && (
          <Banner status="error"><BannerContent><Text>{copy.review.unverifiedBanner}</Text></BannerContent></Banner>
        )}
        {state.review.notices.length > 0 && (
          <Banner status="info">
            <BannerContent>{state.review.notices.map((n) => <Text key={n}>{n}</Text>)}</BannerContent>
            <BannerActions>
              <Button appearance="transparent" aria-label={copy.review.dismissNotices} onClick={() => dispatch({ type: "NOTICES_DISMISS" })}>
                <CloseIcon aria-hidden />
              </Button>
            </BannerActions>
          </Banner>
        )}

        <IssuePanel card={card} />

        <Tabs value={state.review.tab} onChange={(_e, value) => dispatch({ type: "REVIEW_SET_TAB", tab: value as ReviewTab })}>
          {/* TabBar is required: TabList measures its free width against its parent's other children. */}
          <TabBar>
            <TabList appearance="transparent" aria-label={copy.review.tabsLabel}>
              {TABS.map((t) => (
                <Tab key={t} value={t}><TabTrigger>{copy.review.tabs[t]}</TabTrigger></Tab>
              ))}
            </TabList>
          </TabBar>
          <TabPanel value="card" className={styles.panel}><CardTab card={card} /></TabPanel>
          <TabPanel value="lineage" className={styles.panel}><LineageTab card={card} /></TabPanel>
          <TabPanel value="artifact" className={styles.panel}><ArtifactTab card={card} /></TabPanel>
        </Tabs>
      </div>
    </section>
  );
}
