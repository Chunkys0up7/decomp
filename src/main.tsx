// 1. Fonts (Salt does not ship fonts). Fontsource is self-hosted: works offline and under strict CSP.
import "@fontsource/open-sans/300.css";
import "@fontsource/open-sans/400.css";
import "@fontsource/open-sans/500.css";
import "@fontsource/open-sans/600.css";
import "@fontsource/open-sans/700.css";
import "@fontsource/pt-mono/400.css";

// 2. Salt baseline reset, before the theme.
import "@salt-ds/theme/css/baseline.css";

// 3. Salt theme. SaltProviderNext pairs with global.css + theme-next.css
//    (installed @salt-ds/theme CHANGELOG 1.46.0; see docs/salt-api-notes.md). Never mix with index.css.
import "@salt-ds/theme/css/global.css";
import "@salt-ds/theme/css/theme-next.css";

// 4. App palette (the only file with raw colours) and layout CSS, after Salt so they win by order.
import "./styles/palette.css";
import "./styles/app.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AriaAnnouncerProvider } from "@salt-ds/core";
import { RouterProvider } from "react-router-dom";
import { AdaptersProvider } from "./app/adapters";
import { demoFromUrl } from "./app/demo";
import { RunProvider } from "./app/run";
import { router } from "./app/routes";
import { SaltRoot } from "./salt/SaltRoot";
import { StoreProvider } from "./store/StoreProvider";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SaltRoot>
      <AriaAnnouncerProvider>
        <AdaptersProvider>
          <StoreProvider initial={demoFromUrl(window.location.search)}>
            <RunProvider>
              <RouterProvider router={router} />
            </RunProvider>
          </StoreProvider>
        </AdaptersProvider>
      </AriaAnnouncerProvider>
    </SaltRoot>
  </StrictMode>,
);
