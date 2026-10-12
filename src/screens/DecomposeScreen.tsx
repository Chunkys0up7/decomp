import { Banner, BannerActions, BannerContent, Button, Text } from "@salt-ds/core";
import { ArrowRightIcon } from "@salt-ds/icons";
import { useNavigate } from "react-router-dom";
import { copy } from "../app/copy";
import { useRun } from "../app/run";
import { CoveragePanel } from "../components/decompose/CoveragePanel";
import { IssuesPanel } from "../components/decompose/IssuesPanel";
import { PipelinePanel } from "../components/decompose/PipelinePanel";
import { StatTiles } from "../components/decompose/StatTiles";
import { ScreenTitle } from "../components/shell/ScreenTitle";
import { openIssueCount, uncoveredPassages } from "../store/selectors";
import { useAppState } from "../store/StoreProvider";
import panel from "../styles/panel.module.css";

/** Decompose screen: progress and results of one run, in every state (spec 9.2). */
export function DecomposeScreen() {
  const state = useAppState();
  const { start, cancel } = useRun();
  const navigate = useNavigate();
  const { run, result } = state;
  const status = run.status;
  const cards = result?.cards.length ?? 0;
  const zeroCards = status === "completed" && cards === 0;

  const text =
    status === "running" ? copy.decompose.runningText
    : status === "completed" && result ? copy.decompose.completedText(cards, result.passages.length, uncoveredPassages(state).length, openIssueCount(state))
    : status === "failed" ? run.error?.message ?? copy.errors.unknown
    : status === "cancelled" ? copy.decompose.cancelledText
    : copy.decompose.idleText(state.document.passages?.length ?? 0);

  const actions = (() => {
    switch (status) {
      case "running":
        return <Button appearance="bordered" sentiment="neutral" onClick={cancel}>{copy.decompose.cancelRun}</Button>;
      case "completed":
        return zeroCards ? null : (
          <Button appearance="solid" sentiment="accented" onClick={() => navigate("/review")}>
            {copy.decompose.review(cards)}<ArrowRightIcon aria-hidden />
          </Button>
        );
      case "failed":
        return (
          <>
            {run.error?.retryable && <Button appearance="solid" sentiment="accented" onClick={start}>{copy.decompose.retry}</Button>}
            <Button appearance="bordered" sentiment="neutral" onClick={() => navigate("/")}>{copy.decompose.back}</Button>
          </>
        );
      case "cancelled":
        return <Button appearance="solid" sentiment="accented" onClick={start}>{copy.decompose.again}</Button>;
      default:
        return <Button appearance="solid" sentiment="accented" onClick={start}>{copy.decompose.start}</Button>;
    }
  })();

  return (
    <>
      <header className={panel.pageHeader}>
        <div className={panel.pageHeaderText}>
          <ScreenTitle pageName={copy.titles.decompose}>{copy.decompose.title[status]}</ScreenTitle>
          <Text color="secondary">{text}</Text>
        </div>
        <div className={panel.actions}>{actions}</div>
      </header>

      {status === "failed" && (
        <Banner status="error" className={panel.banner}>
          <BannerContent><Text>{run.error?.message ?? copy.errors.unknown}</Text></BannerContent>
          {run.error?.retryable && (
            <BannerActions><Button appearance="transparent" onClick={start}>{copy.decompose.retry}</Button></BannerActions>
          )}
        </Banner>
      )}
      {status === "cancelled" && (
        <Banner status="info" className={panel.banner}><BannerContent><Text>{copy.decompose.cancelledBanner}</Text></BannerContent></Banner>
      )}
      {zeroCards && (
        <Banner status="warning" className={panel.banner}>
          <BannerContent><Text>{copy.decompose.zeroCards}</Text></BannerContent>
          <BannerActions><Button appearance="bordered" onClick={() => navigate("/")}>{copy.decompose.back}</Button></BannerActions>
        </Banner>
      )}
      {status === "completed" && run.stale && (
        <Banner status="info" className={panel.banner}><BannerContent><Text>{copy.decompose.staleText}</Text></BannerContent></Banner>
      )}

      {status !== "failed" && status !== "idle" && <StatTiles />}

      <div className={panel.row}>
        <PipelinePanel />
        {status !== "failed" && status !== "idle" && <CoveragePanel />}
        {status === "completed" && <IssuesPanel />}
      </div>
    </>
  );
}
