import { fireEvent, screen } from "@testing-library/react";
import { unsubscribe } from "../api";
import { renderRoutes, Route } from "../test-utils";
import UnsubscribePage from "./UnsubscribePage";

vi.mock("../api", async (importOriginal) => ({
  ApiError: (await importOriginal<typeof import("../api")>()).ApiError,
  unsubscribe: vi.fn(),
}));

const U = "00000000-0000-4000-8000-000000000001";

const renderPage = (query: string) =>
  renderRoutes(`/unsubscribe?${query}`, <Route path="/unsubscribe" element={<UnsubscribePage />} />);

describe("UnsubscribePage", () => {
  it("asks first, then unsubscribes with the signed link's details", async () => {
    vi.mocked(unsubscribe).mockResolvedValue(undefined);
    renderPage(`u=${U}&k=VOTE_REMINDER&t=sig`);
    expect(screen.getByText(/Stop getting emails for “A day before a poll closes/)).toBeTruthy();
    // Nothing happens just from opening the link.
    expect(unsubscribe).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Unsubscribe" }));
    expect((await screen.findByRole("status")).textContent).toMatch(/You won't get emails for/);
    expect(vi.mocked(unsubscribe).mock.calls[0][0]).toEqual({ u: U, k: "VOTE_REMINDER", t: "sig" });
  });

  it("says when a link is incomplete", () => {
    renderPage(`u=${U}&k=SOMETHING&t=sig`);
    expect(screen.getByRole("alert").textContent).toMatch(/isn't complete/);
    expect(screen.queryByRole("button", { name: "Unsubscribe" })).toBeNull();
  });

  it("shows the server's error for a bad signature", async () => {
    vi.mocked(unsubscribe).mockRejectedValue(new Error("This unsubscribe link isn't valid"));
    renderPage(`u=${U}&k=NEW_POLL&t=wrong`);
    fireEvent.click(screen.getByRole("button", { name: "Unsubscribe" }));
    expect((await screen.findByRole("alert")).textContent).toBe("This unsubscribe link isn't valid");
  });
});
