import type { Step } from "../store/selectors";

/** Route for each workflow step (spec 5.3). */
export const STEP_PATHS: Record<Step, string> = { 1: "/", 2: "/decompose", 3: "/review", 4: "/publish" };
export const STEPS: readonly Step[] = [1, 2, 3, 4];

export function stepForPath(pathname: string): Step | undefined {
  return STEPS.find((s) => STEP_PATHS[s] === pathname);
}
