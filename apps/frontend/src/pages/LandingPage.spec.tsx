import { fireEvent, screen } from "@testing-library/react";
import { useLocation } from "react-router-dom";
import {
  getBookSuggestions,
  getCurrentPoll,
  getMeetingRsvps,
  getMeetings,
  getReadBooks,
} from "../api";
import {
  circe,
  piranesi,
  testMeeting,
  testPoll,
  testReadBook,
  testRsvp,
  testRsvps,
  testSuggestedBook,
} from "../test/fixtures";
import { mockSession, renderRoutes, Route, testUser } from "../test-utils";
import LandingPage from "./LandingPage";

vi.mock("../lib/auth-client", () => ({ authClient: { useSession: vi.fn() } }));
vi.mock("../api", () => ({
  getBookSuggestions: vi.fn(),
  getCurrentPoll: vi.fn(),
  getMeetingRsvps: vi.fn(),
  getMeetings: vi.fn(),
  getReadBooks: vi.fn(),
  setRsvp: vi.fn(),
}));

// Stands in for LoginPage and prints the destination it was handed.
const LoginStub = () => {
  const { state } = useLocation();
  return <p>login, then {state?.from?.pathname}</p>;
};

const renderLanding = () =>
  renderRoutes("/", <Route path="/" element={<LandingPage />} />);

const linkTo = (name: string | RegExp) =>
  screen.getByRole("link", { name }).getAttribute("href");

describe("LandingPage", () => {
  beforeEach(() => {
    vi.mocked(getMeetings).mockResolvedValue([]);
    vi.mocked(getCurrentPoll).mockResolvedValue(null);
    vi.mocked(getBookSuggestions).mockResolvedValue([]);
    vi.mocked(getReadBooks).mockResolvedValue([]);
    vi.mocked(getMeetingRsvps).mockResolvedValue(testRsvps());
  });

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

  it("doesn't ask for anything while signed out", () => {
    mockSession(null);
    renderLanding();
    expect(getMeetings).not.toHaveBeenCalled();
    expect(getCurrentPoll).not.toHaveBeenCalled();
  });

  describe("signed in", () => {
    beforeEach(() => mockSession(testUser()));

    it("greets the member by name", () => {
      renderLanding();
      expect(screen.getByRole("heading", { name: "Hi, Ada." })).toBeTruthy();
    });

    describe("next meeting", () => {
      it("shows the soonest upcoming meeting, linking to its page", async () => {
        const meeting = testMeeting();
        vi.mocked(getMeetings).mockResolvedValue([
          meeting,
          testMeeting({ id: "00000000-0000-4000-8000-000000000031", book: piranesi }),
        ]);
        renderLanding();
        expect(await screen.findByRole("heading", { name: "Circe" })).toBeTruthy();
        expect(screen.queryByRole("heading", { name: "Piranesi" })).toBeNull();
        expect(linkTo("Circe")).toBe(`/events/${meeting.id}`);
        expect(vi.mocked(getMeetings).mock.calls[0][0]).toBe("upcoming");
      });

      it("counts who's going", async () => {
        vi.mocked(getMeetings).mockResolvedValue([testMeeting()]);
        vi.mocked(getMeetingRsvps).mockResolvedValue(
          testRsvps({
            rsvps: [
              testRsvp("Priya", "YES", 1),
              testRsvp("Dani", "MAYBE", 2),
              testRsvp("Jen", "YES", 3),
              testRsvp("Lee", "NO", 4),
            ],
          }),
        );
        renderLanding();
        expect(await screen.findByText("2 going · 1 maybe")).toBeTruthy();
      });

      it("has RSVP buttons", async () => {
        vi.mocked(getMeetings).mockResolvedValue([testMeeting()]);
        vi.mocked(getMeetingRsvps).mockResolvedValue(
          testRsvps({ myStatus: "YES" }),
        );
        renderLanding();
        const yes = await screen.findByRole("button", { name: /I'm in/ });
        await vi.waitFor(() =>
          expect(yes.getAttribute("aria-pressed")).toBe("true"),
        );
        expect(screen.getByRole("button", { name: "Maybe" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Can't go" })).toBeTruthy();
      });

      it("says when nothing is scheduled", async () => {
        renderLanding();
        expect(await screen.findByText(/Nothing scheduled yet/)).toBeTruthy();
        expect(screen.queryByRole("link", { name: "Schedule a meeting" })).toBeNull();
      });

      it("offers admins a link to schedule one", async () => {
        mockSession(testUser({ isAdmin: true }));
        renderLanding();
        await screen.findByText(/Nothing scheduled yet/);
        expect(linkTo("Schedule a meeting")).toBe("/events/new");
      });
    });

    describe("open poll", () => {
      it("shows the ballot and asks members who haven't voted to vote", async () => {
        vi.mocked(getCurrentPoll).mockResolvedValue(testPoll());
        renderLanding();
        expect(await screen.findByText("What should we read next?")).toBeTruthy();
        expect(screen.getByText("Piranesi")).toBeTruthy();
        expect(linkTo("Vote now")).toBe(`/polls/${testPoll().id}`);
      });

      it("marks the member's votes and lets them change them", async () => {
        vi.mocked(getCurrentPoll).mockResolvedValue(
          testPoll({ myVotes: [circe.id], voterCount: 1, theme: "Winter reads" }),
        );
        renderLanding();
        expect(await screen.findByText("Winter reads")).toBeTruthy();
        expect(screen.getByText("Your vote")).toBeTruthy();
        expect(screen.getByText(/1 member voted/)).toBeTruthy();
        expect(linkTo("Change your votes")).toBe(`/polls/${testPoll().id}`);
      });

      it("shows nothing when no poll is open", async () => {
        renderLanding();
        await vi.waitFor(() => expect(getCurrentPoll).toHaveBeenCalled());
        expect(screen.queryByRole("link", { name: "Vote now" })).toBeNull();
      });
    });

    describe("suggestions", () => {
      it("shows the three newest, with who suggested them", async () => {
        const by = (firstName: string, n: number) => testRsvp(firstName, "YES", n).member;
        vi.mocked(getBookSuggestions).mockResolvedValue([
          testSuggestedBook({ id: "00000000-0000-4000-8000-000000000201", title: "Oldest", suggestedAt: new Date("2026-01-01") }),
          testSuggestedBook({ id: "00000000-0000-4000-8000-000000000202", title: "Newest", suggestedAt: new Date("2026-10-01"), suggestedBy: [by("Dani", 1), by("Jen", 2), by("Lee", 3)] }),
          testSuggestedBook({ id: "00000000-0000-4000-8000-000000000203", title: "Middle", suggestedAt: new Date("2026-05-01"), suggestedBy: [by("Jen", 2)] }),
          testSuggestedBook({ id: "00000000-0000-4000-8000-000000000204", title: "Second", suggestedAt: new Date("2026-09-01") }),
        ]);
        renderLanding();
        const list = await screen.findAllByText(/^(Oldest|Newest|Middle|Second)$/);
        expect(list.map((el) => el.textContent)).toEqual(["Newest", "Second", "Middle"]);
        expect(screen.getByText(/suggested by Dani and 2 others/)).toBeTruthy();
        expect(screen.getByText(/suggested by Jen$/)).toBeTruthy();
      });

      it("links to the full list and the suggest form", () => {
        renderLanding();
        const [suggestions] = screen.getAllByRole("link", { name: "See all" });
        expect(suggestions.getAttribute("href")).toBe("/books/suggestions");
        expect(linkTo("Suggest a book")).toBe("/books/suggest");
      });
    });

    describe("shelf", () => {
      it("shows books from meetings that have happened, with a count", async () => {
        vi.mocked(getReadBooks).mockResolvedValue([
          testReadBook({ id: "00000000-0000-4000-8000-000000000301", title: "Up next", meetingStart: new Date("2099-01-01") }),
          testReadBook({ id: "00000000-0000-4000-8000-000000000302", title: "Beartown", meetingStart: new Date("2026-06-10T19:00:00") }),
          testReadBook({ id: "00000000-0000-4000-8000-000000000303", title: "Rebecca", meetingStart: new Date("2023-03-10T19:00:00") }),
        ]);
        renderLanding();
        const shelf = await screen.findByRole("list", { name: "Books we've read" });
        expect(shelf.textContent).toBe("BeartownRebecca");
        expect(screen.getByText("2 books since March 2023")).toBeTruthy();
      });

      it("links to the full list", () => {
        renderLanding();
        const [, shelf] = screen.getAllByRole("link", { name: "See all" });
        expect(shelf.getAttribute("href")).toBe("/books/read");
      });
    });
  });
});
