import { SaltProviderNext } from "@salt-ds/core";
import type { ReactNode } from "react";
import { APP_DENSITY } from "../app/config";

/** The one Salt provider (SALT-09). Rounded corners and blue accent come from Salt itself (visual spec 5.1). */
export function SaltRoot({ children }: { children: ReactNode }) {
  return (
    <SaltProviderNext density={APP_DENSITY} mode="light" corner="rounded" accent="blue">
      <div data-testid="app-root" className="appRoot">
        {children}
      </div>
    </SaltProviderNext>
  );
}
