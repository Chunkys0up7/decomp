import type { Density } from "@salt-ds/core";

/** App-wide density. The only place it changes (SALT-11 as revised by visual spec 7.1). */
export const APP_DENSITY: Density = (import.meta.env.VITE_APP_DENSITY as Density | undefined) ?? "low";

/** The Salt smoke-test route exists in dev and in builds made with VITE_SALT_CHECK=1 (spec 4.9). */
export const SALT_CHECK_ENABLED = import.meta.env.DEV || import.meta.env.VITE_SALT_CHECK === "1";
