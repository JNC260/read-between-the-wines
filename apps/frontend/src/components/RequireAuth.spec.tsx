import { screen } from "@testing-library/react";
import { mockSession, renderRoutes, Route, testUser } from "../test-utils";
import RequireAuth from "./RequireAuth";

vi.mock("../lib/auth-client", () => ({ authClient: { useSession: vi.fn() } }));

const renderProtected = (admin = false) =>
  renderRoutes(
    "/private",
    <>
      <Route path="/" element="landing page" />
      <Route path="/reactivate" element="reactivate page" />
      <Route
        path="/private"
        element={
          <RequireAuth admin={admin}>
            <p>secret page</p>
          </RequireAuth>
        }
      />
    </>,
  );

describe("RequireAuth", () => {
  it("renders nothing while the session is loading", () => {
    mockSession("pending");
    const { container } = renderProtected();
    expect(container.textContent).toBe("");
  });

  it("redirects signed-out users to the landing page", () => {
    mockSession(null);
    renderProtected();
    expect(screen.getByText("landing page")).toBeTruthy();
    expect(screen.queryByText("secret page")).toBeNull();
  });

  it("shows the page to active members", () => {
    mockSession(testUser());
    renderProtected();
    expect(screen.getByText("secret page")).toBeTruthy();
  });

  it("sends inactive members to reactivate", () => {
    mockSession(testUser({ status: "INACTIVE" }));
    renderProtected();
    expect(screen.getByText("reactivate page")).toBeTruthy();
  });

  it("blocks banned members with a session from before the ban", () => {
    mockSession(testUser({ status: "BANNED" }));
    renderProtected();
    expect(screen.getByText("This account has been banned.")).toBeTruthy();
    expect(screen.queryByText("secret page")).toBeNull();
  });

  it("blocks members who aren't admins from admin pages", () => {
    mockSession(testUser());
    renderProtected(true);
    expect(screen.getByText("Only admins can see this page.")).toBeTruthy();
    expect(screen.queryByText("secret page")).toBeNull();
  });

  it("shows admin pages to admins", () => {
    mockSession(testUser({ isAdmin: true }));
    renderProtected(true);
    expect(screen.getByText("secret page")).toBeTruthy();
  });
});
