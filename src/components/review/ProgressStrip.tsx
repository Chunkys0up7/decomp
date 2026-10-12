import { Button, Text, Tooltip } from "@salt-ds/core";
import { ArrowRightIcon } from "@salt-ds/icons";
import { useNavigate } from "react-router-dom";
import { copy } from "../../app/copy";
import { canPublish, cleanPendingCards, counts, needsAttention, openBlockingCount, openIssueCount, publishGates } from "../../store/selectors";
import { useAppState } from "../../store/StoreProvider";
import { ScreenTitle } from "../shell/ScreenTitle";
import styles from "./ProgressStrip.module.css";
import { useReviewActions } from "./useReviewActions";

/** Title, decision progress and the screen's two actions (spec 9.3.1, visual spec 8.4). */
export function ProgressStrip() {
  const state = useAppState();
  const navigate = useNavigate();
  const { bulkApprove } = useReviewActions();

  const c = counts(state);
  const decided = c.approved + c.rejected;
  const attention = needsAttention(state).length;
  const pendingQuiet = c.pending - attention;
  const clean = cleanPendingCards(state).length;
  const gates = publishGates(state);
  const ready = canPublish(state);
  const blockedReason = !gates.allDecided ? copy.review.contBlocked.undecided : !gates.uncoveredAcknowledged ? copy.review.contBlocked.uncovered : undefined;
  const pct = (n: number) => `${c.total ? (100 * n) / c.total : 0}%`;

  return (
    <section className={styles.strip} data-panel aria-labelledby="review-title">
      <div className={styles.titleBlock}>
        <ScreenTitle pageName={copy.titles.review}><span id="review-title">{copy.review.title}</span></ScreenTitle>
        <Text color="secondary">{copy.review.intro}</Text>
      </div>

      <div className={styles.progressBlock}>
        <div className={styles.progressTop}>
          <Text><strong>{copy.review.decided(decided, c.total)}</strong></Text>
          <Text color="secondary">{copy.review.openIssues(openIssueCount(state), openBlockingCount(state))}</Text>
        </div>
        <div className={styles.bar} role="img" aria-label={copy.review.barLabel(c.approved, c.rejected, c.pending)}>
          <span className={styles.segment} data-kind="approved" style={{ width: pct(c.approved) }} />
          <span className={styles.segment} data-kind="rejected" style={{ width: pct(c.rejected) }} />
          <span className={styles.segment} data-kind="attention" style={{ width: pct(attention) }} />
          <span className={styles.segment} data-kind="pending" style={{ width: pct(pendingQuiet) }} />
        </div>
        <div className={styles.legend} aria-hidden="true">
          <Text color="secondary"><span className={styles.dot} data-kind="approved" />{copy.review.legend.approved} {c.approved}</Text>
          <Text color="secondary"><span className={styles.dot} data-kind="rejected" />{copy.review.legend.rejected} {c.rejected}</Text>
          <Text color="secondary"><span className={styles.dot} data-kind="pending" />{copy.review.legend.pending} {c.pending}</Text>
        </div>
      </div>

      <div className={styles.actions}>
        <Tooltip content={copy.review.bulkNone} disabled={clean > 0}>
          <Button appearance="bordered" sentiment="neutral" disabled={clean === 0} focusableWhenDisabled onClick={() => bulkApprove(clean)}>
            {copy.review.bulk(clean)}
          </Button>
        </Tooltip>
        {/* One filled accent action per view (visual spec 4.3): this becomes the CTA only once publishing is possible. */}
        <Tooltip content={blockedReason ?? ""} disabled={ready || !blockedReason}>
          <Button
            appearance={ready ? "solid" : "bordered"}
            sentiment={ready ? "accented" : "neutral"}
            disabled={!ready}
            focusableWhenDisabled
            onClick={() => navigate("/publish")}
          >
            {copy.review.cont}
            <ArrowRightIcon aria-hidden />
          </Button>
        </Tooltip>
      </div>
    </section>
  );
}
