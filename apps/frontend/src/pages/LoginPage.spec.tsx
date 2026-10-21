import { fireEvent, screen } from "@testing-library/react";
import { signIn } from "../api";
import { mockSession, renderRoutes, Route, testUser } from "../test-utils";
import LoginPage from "./LoginPage";

vi.mock("../lib/auth-client", () => ({ authClient: { useSession: vi.fn() } }));
vi.mock("../api", () => ({ signIn: vi.fn() }));

const renderLogin = (from?: string) =>
  renderRoutes(
    { pathname: "/login", state: from ? { from: { pathname: from } } : null },
    <>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element="landing page" />
      <Route path="/users" element="users page" />
      <Route path="/reactivate" element="reactivate page" />
    </>,
  );

const submit = () => {
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "reader@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "correct-horse-battery" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Log in" }));
};

describe("LoginPage", () => {
  beforeEach(() => mockSession(null));

  it("signs in and returns to the page RequireAuth redirected from", async () => {
    const refetch = mockSession(null);
    vi.mocked(signIn).mockResolvedValue(testUser() as never);
    renderLogin("/users");
    submit();
    expect(await screen.findByText("users page")).toBeTruthy();
    // Navigating before the session refreshes would bounce back to "/".
    expect(refetch).toHaveBeenCalled();
    expect(vi.mocked(signIn).mock.calls[0][0]).toEqual({
      email: "reader@example.com",
      password: "correct-horse-battery",
    });
  });

  it("goes to the landing page when there's nowhere to return to", async () => {
    vi.mocked(signIn).mockResolvedValue(testUser() as never);
    renderLogin();
    submit();
    expect(await screen.findByText("landing page")).toBeTruthy();
  });

  it("sends inactive members to reactivate", async () => {
    vi.mocked(signIn).mockResolvedValue(
      testUser({ status: "INACTIVE" }) as never,
    );
    renderLogin("/users");
    submit();
    expect(await screen.findByText("reactivate page")).toBeTruthy();
  });

  it("shows the server's error", async () => {
    vi.mocked(signIn).mockRejectedValue(new Error("Invalid email or password"));
    renderLogin();
    submit();
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Invalid email or password",
    );
  });

  it("skips the form for members who are already signed in", () => {
    mockSession(testUser());
    renderLogin();
    expect(screen.getByText("landing page")).toBeTruthy();
  });
});
