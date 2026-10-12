import { Text, Tooltip } from "@salt-ds/core";
import { CheckmarkIcon } from "@salt-ds/icons";
import { Link } from "react-router-dom";
import { copy } from "../../app/copy";
import { STEP_PATHS, STEPS } from "../../app/steps";
import { isStepNavigable, stepStatus, type Step } from "../../store/selectors";
import { useAppState } from "../../store/StoreProvider";
import styles from "./WorkflowStepper.module.css";

/**
 * The four-step workflow nav (spec 5.2, UI-06, UI-07). Salt's Stepper cannot render steps as
 * links, so this is a nav of links per the spec's documented fallback (docs/salt-api-notes.md).
 */
export function WorkflowStepper({ current }: { current: Step }) {
  const state = useAppState();
  return (
    <nav aria-label={copy.stepper.label} className={styles.bar}>
      <ol className={styles.list}>
        {STEPS.map((step) => {
          const status = stepStatus(state, step, current);
          const label = copy.stepper.steps[step - 1];
          const marker = (
            <span className={styles.marker} data-status={status} aria-hidden="true">
              {status === "complete" ? <CheckmarkIcon /> : step}
            </span>
          );
          const text = <Text className={styles.label} data-status={status}>{label}</Text>;
          const srStatus = status === "complete" ? <span className="salt-visuallyHidden">, {copy.stepper.complete}</span> : null;

          if (isStepNavigable(state, step)) {
            return (
              <li key={step} className={styles.item}>
                <Link to={STEP_PATHS[step]} className={styles.step} aria-current={step === current ? "step" : undefined}>
                  {marker}{text}{srStatus}
                </Link>
              </li>
            );
          }
          return (
            <li key={step} className={styles.item}>
              <Tooltip content={copy.stepper.locked(step - 1)} placement="bottom">
                <span className={styles.step} role="link" aria-disabled="true" tabIndex={0} data-locked>
                  {marker}{text}
                </span>
              </Tooltip>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
