import { act, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { renderWithProviders } from "../test/render";
import { reviewState } from "../test/fixtures";
import { DRAFT_KEY } from "./persistence";
import { useAppState, useDispatch } from "./StoreProvider";

function Probe() {
  const s = useAppState();
  const dispatch = useDispatch();
  return (
    <div>
      <span data-testid="approved">{Object.keys(s.review.decisions).join(",")}</span>
      <span data-testid="save">{s.save.status}</span>
      <button onClick={() => dispatch({ type: "BULK_APPROVE_CLEAN" })}>bulk</button>
    </div>
  );
}

describe("StoreProvider", () => {
  afterEach(() => localStorage.clear());

  it("autosaves after changes and a fresh provider restores the draft (PER-02, PER-03)", async () => {
    const { unmount } = renderWithProviders(<Probe />, { state: reviewState() });
    act(() => screen.getByText("bulk").click());
    expect(screen.getByTestId("save").textContent).toBe("saving");
    await act(() => new Promise((r) => setTimeout(r, 600)));
    expect(localStorage.getItem(DRAFT_KEY)).toContain("F-001");
    unmount();

    renderWithProviders(<Probe />);
    expect(screen.getByTestId("approved").textContent).toBe("F-001,R-002,C-006");
  });
});
