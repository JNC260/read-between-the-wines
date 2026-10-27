import { fireEvent, screen, within } from "@testing-library/react";
import { getMeeting, getMeetingRsvps, setRsvp } from "../api";
import { testMeeting, testRsvp, testRsvps } from "../test/fixtures";
import { mockSession, renderRoutes, Route, testUser } from "../test-utils";
import MeetingPage from "./MeetingPage";

vi.mock("../lib/auth-client", () => ({ authClient: { useSession: vi.fn() } }));
vi.mock("../api", () => ({
  getMeeting: vi.fn(),
  getMeetingRsvps: vi.fn(),
  setRsvp: vi.fn(),
}));

const meeting = testMeeting();

const renderPage = () =>
  renderRoutes(
    `/events/${meeting.id}`,
    <Route path="/events/:id" element={<MeetingPage />} />,
  );

describe("MeetingPage", () => {
  beforeEach(() => {
    mockSession(testUser());
    vi.mocked(getMeeting).mockResolvedValue(meeting);
    vi.mocked(getMeetingRsvps).mockResolvedValue(testRsvps());
  });

  it("shows the book, time, place and synopsis", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Circe" })).toBeTruthy();
    expect(screen.getByText("Madeline Miller")).toBeTruthy();
    expect(screen.getByText(/14 Elm St, Springfield, IL 62701/)).toBeTruthy();
    expect(screen.getByText("A witch on an island.")).toBeTruthy();
    expect(vi.mocked(getMeeting).mock.calls[0][0]).toBe(meeting.id);
  });

  it("falls back to the meeting title before a book is picked", async () => {
    vi.mocked(getMeeting).mockResolvedValue(
      testMeeting({ book: null, bookId: null }),
    );
    renderPage();
    expect(
      await screen.findByRole("heading", { level: 1, name: "November meeting" }),
    ).toBeTruthy();
    expect(screen.getByText("Book to be announced")).toBeTruthy();
  });

  it("groups who's coming by answer", async () => {
    vi.mocked(getMeetingRsvps).mockResolvedValue(
      testRsvps({
        rsvps: [
          testRsvp("Priya", "YES", 1),
          testRsvp("Dani", "MAYBE", 2),
          testRsvp("Jen", "YES", 3),
        ],
      }),
    );
    renderPage();
    const going = (await screen.findByRole("heading", { name: /Going/ }))
      .parentElement as HTMLElement;
    expect(within(going).getAllByRole("listitem").map((li) => li.textContent))
      .toEqual(["Priya Reader", "Jen Reader"]);
    expect(screen.getByRole("heading", { name: /Maybe/ })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: /Can't make it/ })).toBeNull();
  });

  it("saves an RSVP and marks it as picked", async () => {
    vi.mocked(setRsvp).mockResolvedValue(testRsvps({ myStatus: "MAYBE" }));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Maybe" }));
    await vi.waitFor(() =>
      expect(vi.mocked(setRsvp).mock.calls[0][0]).toEqual({
        meetingId: meeting.id,
        status: "MAYBE",
      }),
    );
    await vi.waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Maybe" }).getAttribute("aria-pressed"),
      ).toBe("true"),
    );
  });

  it("shows why an RSVP didn't save", async () => {
    vi.mocked(setRsvp).mockRejectedValue(new Error("This meeting is over"));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "I'm in" }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "This meeting is over",
    );
  });

  it("hides the RSVP buttons once the meeting is over", async () => {
    vi.mocked(getMeeting).mockResolvedValue(
      testMeeting({
        start: new Date("2020-01-01T19:00:00"),
        end: new Date("2020-01-01T21:00:00"),
      }),
    );
    renderPage();
    expect(await screen.findByText("This meeting is over.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "I'm in" })).toBeNull();
  });

  it("links admins to the edit page", async () => {
    mockSession(testUser({ isAdmin: true }));
    renderPage();
    expect(
      (await screen.findByRole("link", { name: "Edit event" })).getAttribute(
        "href",
      ),
    ).toBe(`/events/${meeting.id}/edit`);
  });

  it("doesn't show members the edit link", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Circe" });
    expect(screen.queryByRole("link", { name: "Edit event" })).toBeNull();
  });
});
