import { Banner, BannerContent, Button, Text } from "@salt-ds/core";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { copy } from "../app/copy";
import { useIngest } from "../app/ingest";
import { useRun } from "../app/run";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ActionBar } from "../components/load/ActionBar";
import { DocumentPanel } from "../components/load/DocumentPanel";
import { ExtractionSetup } from "../components/load/ExtractionSetup";
import { PolicyDetails } from "../components/load/PolicyDetails";
import { ReferencedDocs } from "../components/load/ReferencedDocs";
import { ScreenTitle } from "../components/shell/ScreenTitle";
import { clearDraft } from "../store/persistence";
import { useAppState, useDispatch } from "../store/StoreProvider";
import panel from "../styles/panel.module.css";
import styles from "../components/load/load.module.css";

type Pending = { kind: "rerun" } | { kind: "replace"; file: File } | { kind: "reset" } | null;

/** Load policy (spec 9.1). Destructive steps confirm first (UI-09, RED-11, PER-05). */
export function LoadScreen() {
  const state = useAppState();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { start } = useRun();
  const { load, retry } = useIngest();
  const [pending, setPending] = useState<Pending>(null);
  const [showAllErrors, setShowAllErrors] = useState(false);
  const hasResult = state.result !== undefined || state.run.status === "running";

  const onFile = (file: File) => (hasResult ? setPending({ kind: "replace", file }) : load(file));
  const decompose = () => {
    if (hasResult) return setPending({ kind: "rerun" });
    start();
    navigate("/decompose");
  };

  const confirm = () => {
    if (!pending) return;
    if (pending.kind === "rerun") { start(); navigate("/decompose"); }
    if (pending.kind === "replace") load(pending.file);
    if (pending.kind === "reset") {
      try { clearDraft(window.localStorage); } catch { /* storage unavailable: nothing to clear */ }
      dispatch({ type: "RESET" });
      setShowAllErrors(false);
    }
    setPending(null);
  };

  const dialog = {
    rerun: { title: copy.load.rerunTitle, body: copy.load.rerunBody, confirmLabel: copy.load.rerunConfirm },
    replace: { title: copy.load.replaceTitle, body: copy.load.replaceBody, confirmLabel: copy.load.replaceConfirm },
    reset: { title: copy.load.startOverTitle, body: copy.load.startOverBody, confirmLabel: copy.load.startOverConfirm },
  }[pending?.kind ?? "rerun"];

  return (
    <>
      {state.document.restoredFromDraft && (
        <Banner status="info" className={panel.banner}><BannerContent><Text>{copy.load.draftRestored}</Text></BannerContent></Banner>
      )}
      <header className={`${panel.pageHeader} ${styles.pageHeader}`}>
        <div className={panel.pageHeaderText}>
          <ScreenTitle pageName={copy.titles.load}>{copy.load.title}</ScreenTitle>
          <Text color="secondary">{copy.load.intro}</Text>
        </div>
        {state.document.status !== "empty" && (
          <Button appearance="transparent" sentiment="neutral" onClick={() => setPending({ kind: "reset" })}>{copy.load.startOver}</Button>
        )}
      </header>

      <div className={styles.columns}>
        <div className={styles.left}>
          <DocumentPanel onFile={onFile} onRetry={retry} />
          <ReferencedDocs />
          <PolicyDetails showAllErrors={showAllErrors} />
        </div>
        <div className={styles.right}>
          <ExtractionSetup />
        </div>
      </div>

      <ActionBar onDecompose={decompose} onBlockedAttempt={() => setShowAllErrors(true)} />

      <ConfirmDialog
        open={pending !== null}
        {...dialog}
        cancelLabel={copy.load.cancel}
        onConfirm={confirm}
        onCancel={() => setPending(null)}
      />
    </>
  );
}
