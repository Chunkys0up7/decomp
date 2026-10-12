import { Banner, BannerActions, BannerContent, Button, Spinner, Text } from "@salt-ds/core";
import { DownloadIcon } from "@salt-ds/icons";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { copy } from "../app/copy";
import { usePublish } from "../app/publish";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ArtifactsTable } from "../components/publish/ArtifactsTable";
import styles from "../components/publish/publish.module.css";
import { SignOff } from "../components/publish/SignOff";
import { ScreenTitle } from "../components/shell/ScreenTitle";
import { canPublish, counts } from "../store/selectors";
import { useAppState } from "../store/StoreProvider";
import panel from "../styles/panel.module.css";

/** Publish approved cards (spec 9.4, 9.4.5). */
export function PublishScreen() {
  const state = useAppState();
  const navigate = useNavigate();
  const { publishNow, exportNow } = usePublish();
  const [confirming, setConfirming] = useState(false);
  const c = counts(state);
  const policy = state.result!.policy;
  const { status, receipt, error } = state.publish;
  const gatesOk = canPublish(state);
  const noneApproved = c.approved === 0;
  const busy = status === "publishing";
  const published = status === "published";

  return (
    <>
      <header className={panel.pageHeader}>
        <div className={panel.pageHeaderText}>
          <ScreenTitle pageName={copy.titles.publish}>{copy.publish.title}</ScreenTitle>
          <Text color="secondary">{copy.publish.intro(c.approved, c.rejected)}</Text>
        </div>
        <div className={panel.actions}>
          <Button appearance="transparent" sentiment="neutral" onClick={() => navigate("/review")}>{copy.publish.back}</Button>
          <Button appearance="bordered" sentiment="neutral" disabled={!gatesOk || busy} onClick={() => void exportNow()}>
            <DownloadIcon aria-hidden />{copy.publish.exportJson}
          </Button>
          <Button appearance="solid" sentiment="accented" disabled={!gatesOk || busy || published} onClick={() => setConfirming(true)}>
            {busy && <Spinner size="small" aria-hidden />}
            {busy ? copy.publish.publishing : published ? copy.publish.published : copy.publish.publish(c.approved)}
          </Button>
        </div>
      </header>

      {published && receipt && (
        <Banner status="success" className={panel.banner}>
          <BannerContent><Text>{copy.publish.success(receipt.counts.published, receipt.packageId, receipt.counts.rejected)}</Text></BannerContent>
        </Banner>
      )}
      {status === "failed" && (
        <Banner status="error" className={panel.banner}>
          <BannerContent><Text>{error ?? copy.errors.unknown}</Text></BannerContent>
          <BannerActions><Button appearance="transparent" onClick={() => void publishNow()}>{copy.decompose.retry}</Button></BannerActions>
        </Banner>
      )}
      {noneApproved ? (
        <Banner status="warning" className={panel.banner}><BannerContent><Text>{copy.publish.noneApproved}</Text></BannerContent></Banner>
      ) : !gatesOk && (
        <Banner status="warning" className={panel.banner}>
          <BannerContent><Text>{copy.publish.gatesFailed} <Link to="/review?filter=attention">{copy.publish.fixInReview}</Link></Text></BannerContent>
        </Banner>
      )}

      <div className={styles.layout}>
        <ArtifactsTable />
        <SignOff />
      </div>

      <ConfirmDialog
        open={confirming}
        title={copy.publish.dialog.title(c.approved)}
        body={copy.publish.dialog.body(c.approved, policy.policyId, policy.version)}
        confirmLabel={copy.publish.dialog.confirm}
        cancelLabel={copy.publish.dialog.cancel}
        onConfirm={() => { setConfirming(false); void publishNow(); }}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
