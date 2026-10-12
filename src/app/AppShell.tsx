import { Banner, BannerContent, Text } from "@salt-ds/core";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { AppHeader } from "../components/shell/AppHeader";
import { WorkflowStepper } from "../components/shell/WorkflowStepper";
import { furthestStep, isStepNavigable, type Step } from "../store/selectors";
import { useAppState } from "../store/StoreProvider";
import styles from "./AppShell.module.css";
import { copy } from "./copy";
import { STEP_PATHS } from "./steps";

interface RedirectState {
  redirected?: boolean;
}

/**
 * Header, workflow stepper and main landmark around one screen (spec 5.1, A11Y-05).
 * UI-08: a screen whose prerequisites are not met redirects to the earliest incomplete step,
 * which then shows "Finish this step first." `wide` lets the review workspace use the full width (UI-44).
 */
export function AppShell({ step, wide = false, children }: { step: Step; wide?: boolean; children: ReactNode }) {
  const state = useAppState();
  const location = useLocation();

  if (!isStepNavigable(state, step)) {
    return <Navigate to={STEP_PATHS[furthestStep(state)]} replace state={{ redirected: true } satisfies RedirectState} />;
  }
  const redirected = (location.state as RedirectState | null)?.redirected;

  return (
    <>
      <AppHeader decisions={step >= 3} />
      <WorkflowStepper current={step} />
      <main className={styles.main} data-wide={wide || undefined}>
        {redirected && (
          <Banner status="info" className={styles.notice}>
            <BannerContent><Text>{copy.stepper.redirect}</Text></BannerContent>
          </Banner>
        )}
        {children}
      </main>
    </>
  );
}
