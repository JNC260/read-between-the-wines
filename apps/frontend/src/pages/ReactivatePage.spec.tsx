import { fireEvent, screen } from "@testing-library/react";
import { reactivateAccount } from "../api";
import { mockSession, renderRoutes, Route, testUser } from "../test-utils";
import ReactivatePage from "./ReactivatePage";

vi.mock("../lib/auth-client", () => ({ authClient: { useSession: vi.fn() } }));
vi.mock("../api", () => ({ reactivateAccount: vi.fn(), signOut: vi.fn() }));

const renderReactivate = () =>
  renderRoutes(
    "/reactivate",
    <>
      <Route path="/reactivate" element={<ReactivatePage />} />
      <Route path="/" element="landing page" />
    </>,
  );

describe("ReactivatePage", () => {
  it("reactivates, refreshes the session, then goes home", async () => {
    const refetch = mockSession(
      testUser({ status: "INACTIVE", firstName: "Ada" }),
    );
    vi.mocked(reactivateAccount).mockResolvedValue();
    renderReactivate();
    expect(
      screen.getByRole("heading", { name: "Welcome back, Ada!" }),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Reactivate my account" }),
    );
    expect(await screen.findByText("landing page")).toBeTruthy();
    expect(reactivateAccount).toHaveBeenCalled();
    expect(refetch).toHaveBeenCalled();
  });

  it("shows the error if reactivating fails", async () => {
    mockSession(testUser({ status: "INACTIVE" }));
    vi.mocked(reactivateAccount).mockRejectedValue(
      new Error("Account is active"),
    );
    renderReactivate();
    fireEvent.click(
      screen.getByRole("button", { name: "Reactivate my account" }),
    );
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Account is active",
    );
  });

  it("sends active members home", () => {
    mockSession(testUser());
    renderReactivate();
    expect(screen.getByText("landing page")).toBeTruthy();
  });

  it("sends signed-out visitors home", () => {
    mockSession(null);
    renderReactivate();
    expect(screen.getByText("landing page")).toBeTruthy();
  });
});
