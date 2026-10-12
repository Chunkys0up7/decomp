// SALT-16: every component test renders inside the Salt provider and the store.
// CSS is not asserted here (jsdom has none); visual checks live in Playwright.
import { AriaAnnouncerProvider, SaltProviderNext } from "@salt-ds/core";
import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { AdaptersProvider, defaultAdapters, type Adapters } from "../app/adapters";
import { RunProvider } from "../app/run";
import { StoreProvider } from "../store/StoreProvider";
import type { AppState } from "../store/state";

interface Options extends Omit<RenderOptions, "wrapper"> {
  state?: AppState;
  route?: string;
  adapters?: Partial<Adapters>;
}

export function renderWithProviders(ui: ReactElement, { state, route = "/", adapters, ...options }: Options = {}) {
  const all = { ...defaultAdapters("?delay=0"), ...adapters };
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <SaltProviderNext density="low" mode="light" corner="rounded" accent="blue">
      <AriaAnnouncerProvider>
        <AdaptersProvider adapters={all}>
          <StoreProvider initial={state}>
            <RunProvider>
              <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
            </RunProvider>
          </StoreProvider>
        </AdaptersProvider>
      </AriaAnnouncerProvider>
    </SaltProviderNext>
  );
  return render(ui, { wrapper: Wrapper, ...options });
}
