import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { CardList } from "../components/review/CardList";
import { DetailPane } from "../components/review/DetailPane";
import { ProgressStrip } from "../components/review/ProgressStrip";
import { SourcePane } from "../components/review/SourcePane";
import type { ReviewFilter, ReviewTab } from "../store/state";
import { useAppState, useDispatch } from "../store/StoreProvider";
import styles from "./ReviewScreen.module.css";

const TABS: readonly ReviewTab[] = ["card", "lineage", "artifact"];
const FILTERS: readonly ReviewFilter[] = ["all", "attention", "decided"];

/**
 * UI-10: selected card, tab and filter mirror into the query string (replace, not push).
 * The URL wins once on arrival; after that the store drives the URL. Invalid values are ignored.
 */
function useReviewUrlState() {
  const state = useAppState();
  const dispatch = useDispatch();
  const [params, setParams] = useSearchParams();
  const applied = useRef(false);

  useEffect(() => {
    if (applied.current) return;
    applied.current = true;
    const card = params.get("card");
    const tab = params.get("tab") as ReviewTab | null;
    const filter = params.get("filter") as ReviewFilter | null;
    if (card) dispatch({ type: "REVIEW_SELECT_CARD", shortId: card });
    if (tab && TABS.includes(tab)) dispatch({ type: "REVIEW_SET_TAB", tab });
    if (filter && FILTERS.includes(filter)) dispatch({ type: "REVIEW_SET_FILTER", filter });
  }, [params, dispatch]);

  const { selectedCardId, tab, filter } = state.review;
  useEffect(() => {
    if (!applied.current) return;
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (selectedCardId) next.set("card", selectedCardId); else next.delete("card");
      next.set("tab", tab);
      next.set("filter", filter);
      return next;
    }, { replace: true });
  }, [selectedCardId, tab, filter, setParams]);
}

/**
 * UI-31: the workspace fills the viewport below the chrome. Its top offset is measured with a
 * ResizeObserver (decision D4) rather than hard-coding header, stepper and strip heights.
 */
function useWorkspaceHeight() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => el.style.setProperty("--workspace-top", `${Math.round(el.getBoundingClientRect().top + window.scrollY)}px`);
    const observer = new ResizeObserver(update);
    observer.observe(document.body);
    if (el.previousElementSibling) observer.observe(el.previousElementSibling);
    update();
    return () => observer.disconnect();
  }, []);
  return ref;
}

export function ReviewScreen() {
  useReviewUrlState();
  const workspace = useWorkspaceHeight();
  return (
    <>
      <ProgressStrip />
      <div className={styles.workspace} ref={workspace}>
        <CardList />
        <SourcePane />
        <DetailPane />
      </div>
    </>
  );
}
