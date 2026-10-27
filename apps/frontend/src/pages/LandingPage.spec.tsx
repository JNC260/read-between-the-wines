import { fireEvent, screen } from "@testing-library/react";
import { useLocation } from "react-router-dom";
import { getCurrentPoll } from "../api";
import { circe, testPoll } from "../test/fixtures";
import { mockSession, renderRoutes, Route, testUser } from "../test-utils";
import LandingPage from "./LandingPage";

vi.mock("../lib/auth-client", () => ({ authClient: { useSession: vi.fn() } }));
vi.mock("../api", () => ({ getCurrentPoll: vi.fn() }));

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
      { pathname: "/", state: { from: { pathname: "/members" } } },
      <>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginStub />} />
      </>,
    );
    fireEvent.click(screen.getByRole("link", { name: "Log in" }));
    expect(screen.getByText("login, then /members")).toBeTruthy();
  });

  describe("poll message", () => {
    const renderLanding = () =>
      renderRoutes("/", <Route path="/" element={<LandingPage />} />);

    beforeEach(() => mockSession(testUser()));

    it("invites members who haven't voted to vote", async () => {
      vi.mocked(getCurrentPoll).mockResolvedValue(testPoll());
      renderLanding();
      expect((await screen.findByRole("status")).textContent).toMatch(
        /^There's a new poll available! Vote now/,
      );
      expect(
        screen.getByRole("link", { name: "Vote now" }).getAttribute("href"),
      ).toBe(`/polls/${testPoll().id}`);
    });

    it("tells members who voted they can still change their votes", async () => {
      vi.mocked(getCurrentPoll).mockResolvedValue(
        testPoll({ myVotes: [circe.id] }),
      );
      renderLanding();
      expect((await screen.findByRole("status")).textContent).toMatch(
        /^You've voted in the current poll. You can change your votes until /,
      );
      expect(
        screen.getByRole("link", { name: "change your votes" }).getAttribute("href"),
      ).toBe(`/polls/${testPoll().id}`);
    });

    it("says nothing when no poll is open", async () => {
      vi.mocked(getCurrentPoll).mockResolvedValue(null);
      renderLanding();
      await screen.findByText(/Welcome, Ada/);
      await vi.waitFor(() => expect(getCurrentPoll).toHaveBeenCalled());
      expect(screen.queryByRole("status")).toBeNull();
    });

    it("doesn't ask for the poll while signed out", () => {
      mockSession(null);
      renderLanding();
      expect(getCurrentPoll).not.toHaveBeenCalled();
    });
  });
});
