import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test/render";
import { reviewState, run } from "../../test/fixtures";
import { CardList } from "./CardList";
import { DetailPane } from "./DetailPane";
import { SourcePane } from "./SourcePane";

afterEach(() => localStorage.clear());
const rows = () => screen.getAllByRole("button").filter((b) => b.hasAttribute("data-card"));

describe("TEST-20 CardList", () => {
  it("renders 8 rows, filters to 5, moves with ArrowDown and marks the selection", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CardList />, { state: reviewState() });
    expect(rows()).toHaveLength(8);
    expect(rows().find((r) => r.dataset.card === "R-003")).toHaveAttribute("aria-current", "true");

    await user.click(screen.getByText(/Needs attention \(5\)/i));
    expect(rows()).toHaveLength(5);

    act(() => rows()[0]!.focus());
    await user.keyboard("{ArrowDown}");
    expect(rows().find((r) => r.dataset.card === "C-004")).toHaveAttribute("aria-current", "true");
  });
});

describe("TEST-21 DetailPane", () => {
  it("blocks approval until the error is resolved, then focuses Reopen", async () => {
    const user = userEvent.setup();
    const s = run(reviewState(), { type: "REVIEW_SELECT_CARD", shortId: "R-008" });
    renderWithProviders(<DetailPane />, { state: s });
    const approve = screen.getByRole("button", { name: "Approve card" });
    expect(approve).toHaveAttribute("aria-disabled", "true");
    expect(screen.getAllByText("Resolve the blocking issue to approve.").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Mark resolved" }));
    expect(screen.getByRole("button", { name: "Approve card" })).not.toHaveAttribute("aria-disabled", "true");

    await user.click(screen.getByRole("button", { name: "Approve card" }));
    expect(screen.getByRole("button", { name: "Reopen" })).toHaveFocus();
  });
});

describe("TEST-22 SourcePane", () => {
  it("links P-007 passages, shows chips and toggles acknowledgement on p8", async () => {
    const user = userEvent.setup();
    const s = run(reviewState(), { type: "REVIEW_SELECT_CARD", shortId: "P-007" });
    const { container } = renderWithProviders(<SourcePane />, { state: s });
    const passage = (id: string) => container.querySelector<HTMLElement>(`[data-passage="${id}"]`)!;

    expect(passage("p7")).toHaveAttribute("data-linked", "true");
    expect(passage("p5")).toHaveAttribute("data-linked", "true");
    expect(passage("p6")).not.toHaveAttribute("data-linked");
    const chips = within(passage("p5")).getAllByRole("button").map((b) => b.textContent);
    expect(chips).toEqual(["R-005", "P-007"]);

    const p8 = within(passage("p8"));
    expect(p8.getByText("No card generated")).toBeInTheDocument();
    await user.click(p8.getByRole("button", { name: "Acknowledge" }));
    expect(p8.getByRole("button", { name: "Acknowledged (undo)" })).toBeInTheDocument();
  });
});
