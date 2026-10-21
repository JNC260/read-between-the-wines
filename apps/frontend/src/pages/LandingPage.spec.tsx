import { fireEvent, screen } from "@testing-library/react";
import { useLocation } from "react-router-dom";
import { mockSession, renderRoutes, Route, testUser } from "../test-utils";
import LandingPage from "./LandingPage";

vi.mock("../lib/auth-client", () => ({ authClient: { useSession: vi.fn() } }));

// Stands in for LoginPage and prints the destination it was handed.
const LoginStub = () => {
  const { state } = useLocation();
  return <p>login, then {state?.from?.pathname}</p>;
};

describe("LandingPage", () => {
  it("sends inactive members to reactivate", () => {
    mockSession(testUser({ status: "INACTIVE" }));
    renderRoutes(
      "/",
      <>
        <Route path="/" element={<LandingPage />} />
        <Route path="/reactivate" element="reactivate page" />
      </>,
    );
    expect(screen.getByText("reactivate page")).toBeTruthy();
  });

  it("passes RequireAuth's saved destination on to the log in link", () => {
    mockSession(null);
    renderRoutes(
      { pathname: "/", state: { from: { pathname: "/users" } } },
      <>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginStub />} />
      </>,
    );
    fireEvent.click(screen.getByRole("link", { name: "Log in" }));
    expect(screen.getByText("login, then /users")).toBeTruthy();
  });
});
