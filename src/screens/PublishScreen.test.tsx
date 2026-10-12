import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import type { PublishAdapter } from "../adapters/types";
import { AT, reviewState, run } from "../test/fixtures";
import { renderWithProviders } from "../test/render";
import { PublishScreen } from "./PublishScreen";

afterEach(() => localStorage.clear());

const allDecided = () =>
  run(
    reviewState(),
    ...["F-001", "R-002", "R-003", "C-004", "R-005", "C-006", "P-007"].map((shortId) => ({ type: "CARD_APPROVE" as const, shortId })),
    { type: "CARD_REJECT", shortId: "R-008" },
    { type: "ISSUE_RESOLVE", issueId: "ISS-03", at: AT },
  );

describe("TEST-24 Publish", () => {
  it("renders failing gates with their fail text and Fix in review links", () => {
    const s = run(reviewState(), { type: "BULK_APPROVE_CLEAN" });
    renderWithProviders(<PublishScreen />, { state: s, route: "/publish" });
    const checks = screen.getByRole("region", { name: "Sign-off checks" });
    expect(within(checks).getByText("5 cards still need a decision")).toBeInTheDocument();
    expect(within(checks).getByText("1 uncovered passage needs acknowledging: 4.2")).toBeInTheDocument();
    expect(within(checks).getAllByRole("link", { name: "Fix in review" })).toHaveLength(2);
    expect(screen.getByText("Some sign-off checks no longer pass.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Publish 3 cards/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Export JSON/ })).toBeDisabled();
  });

  it("shows the success banner after confirming", async () => {
    const user = userEvent.setup();
    renderWithProviders(<PublishScreen />, { state: allDecided(), route: "/publish" });
    await user.click(screen.getByRole("button", { name: "Publish 7 cards" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Publish" }));
    expect((await screen.findAllByText("Published 7 cards as package POL-HL-0142@3.1. 1 rejected."))[0]).toBeInTheDocument();
    // jsdom never finishes Salt's dialog close transition, so query the DOM rather than the a11y tree
    // (the real-browser check is e2e/flow.spec.ts).
    const published = [...document.querySelectorAll("button")].find((b) => b.textContent === "Published");
    expect(published).toBeDisabled();
  });

  it("shows the failure with Try again and does not mark anything published", async () => {
    const user = userEvent.setup();
    const failing: PublishAdapter = {
      publish: () => Promise.reject({ code: "unavailable", message: "The publishing service is unavailable.", retryable: true }),
      exportFile: () => {},
    };
    renderWithProviders(<PublishScreen />, { state: allDecided(), route: "/publish", adapters: { publish: failing } });
    await user.click(screen.getByRole("button", { name: "Publish 7 cards" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Publish" }));
    expect((await screen.findAllByText("The publishing service is unavailable."))[0]).toBeInTheDocument();
    // DOM query for the same jsdom dialog reason as above.
    const buttons = [...document.querySelectorAll("button")].map((b) => `${b.textContent}${b.disabled ? "(disabled)" : ""}`);
    expect(buttons).toContain("Try again");
    expect(buttons).toContain("Publish 7 cards");
  });
});
