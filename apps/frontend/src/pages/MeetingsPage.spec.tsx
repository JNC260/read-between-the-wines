import { screen, within } from "@testing-library/react";
import { type MeetingDTO } from "shared";
import { getMeetingRsvps, getMeetings } from "../api";
import { mockSession, renderRoutes, Route, testUser } from "../test-utils";
import MeetingsPage from "./MeetingsPage";

vi.mock("../lib/auth-client", () => ({ authClient: { useSession: vi.fn() } }));
vi.mock("../api", () => ({
  getMeetings: vi.fn(),
  getMeetingRsvps: vi.fn(),
  setRsvp: vi.fn(),
}));

const aMeeting = (overrides: Partial<MeetingDTO> = {}): MeetingDTO => ({
  id: "00000000-0000-4000-8000-000000000002",
  title: "November: Piranesi",
  start: new Date("2030-11-04T19:00:00"),
  end: new Date("2030-11-04T21:00:00"),
  description: "Bring a snack",
  craft: null,
  venueId: "00000000-0000-4000-8000-000000000003",
  bookId: null,
  venue: {
    id: "00000000-0000-4000-8000-000000000003",
    name: "Ada's house",
    streetAddress: "1 Main St",
    city: "Springfield",
    state: "IL",
    zip: "62701",
  },
  book: null,
  ...overrides,
});

const slewfoot = {
  id: "00000000-0000-4000-8000-000000000010",
  title: "Slewfoot",
  author: "Brom",
  yearPublished: 2021,
  genres: [],
  coverUrl: null,
  synopsis: null,
  pageCount: 336,
  openLibraryWorkId: null,
  goodreadsUrl: null,
  createdAt: new Date("2026-10-01T00:00:00Z"),
};

const lastMonth = aMeeting({
  id: "00000000-0000-4000-8000-000000000004",
  title: "October",
  start: new Date("2025-10-14T19:00:00"),
  end: new Date("2025-10-14T21:00:00"),
  bookId: slewfoot.id,
  book: slewfoot,
});

// getMeetings is asked for "upcoming" and "past" separately.
const meetings = (upcoming: MeetingDTO[], past: MeetingDTO[] = []) =>
  vi
    .mocked(getMeetings)
    .mockImplementation(async (when) => (when === "past" ? past : upcoming));

const renderPage = () =>
  renderRoutes("/meetings", <Route path="/meetings" element={<MeetingsPage />} />);

describe("MeetingsPage", () => {
  beforeEach(() => {
    mockSession(testUser());
    vi.mocked(getMeetingRsvps).mockResolvedValue({ myStatus: null, rsvps: [] });
  });

  it("shows each upcoming meeting as a card that opens its page", async () => {
    meetings([aMeeting()]);
    renderPage();
    const link = await screen.findByRole("link", { name: "November: Piranesi" });
    expect(link.getAttribute("href")).toBe(
      "/meetings/00000000-0000-4000-8000-000000000002",
    );
    expect(screen.getByText("Ada's house, Springfield")).toBeTruthy();
    expect(screen.getByRole("group", { name: "Are you coming?" })).toBeTruthy();
  });

  it("titles a card with its book once one is assigned", async () => {
    meetings([aMeeting({ bookId: slewfoot.id, book: slewfoot })]);
    renderPage();
    expect(await screen.findByRole("link", { name: "Slewfoot" })).toBeTruthy();
    // The byline, not the cover placeholder, which shows the author too.
    expect(screen.getByText("Brom", { selector: ".byline" })).toBeTruthy();
  });

  it("says when nothing is scheduled", async () => {
    meetings([]);
    renderPage();
    expect(await screen.findByText(/Nothing scheduled yet/)).toBeTruthy();
  });

  it("lists past meetings below, linking to their pages", async () => {
    meetings([aMeeting()], [lastMonth]);
    renderPage();
    const past = await screen.findByRole("region", { name: "Past meetings" });
    const link = within(past).getByRole("link", { name: "Slewfoot" });
    expect(link.getAttribute("href")).toBe(
      "/meetings/00000000-0000-4000-8000-000000000004",
    );
  });

  it("groups past meetings by year, newest first, with a count for each", async () => {
    const at = (id: number, start: string, title: string) =>
      aMeeting({
        id: `00000000-0000-4000-8000-0000000001${id}`,
        title,
        start: new Date(start),
        end: new Date(start),
      });
    meetings(
      [aMeeting()],
      [
        at(10, "2025-10-14T19:00:00", "October"),
        at(11, "2025-03-11T19:00:00", "March"),
        at(12, "2024-12-10T19:00:00", "December"),
      ],
    );
    renderPage();
    const past = await screen.findByRole("region", { name: "Past meetings" });
    const years = within(past).getAllByRole("region");
    expect(years.map((y) => y.getAttribute("aria-labelledby"))).toEqual([
      "year-2025",
      "year-2024",
    ]);
    expect(within(years[0]).getByRole("heading", { level: 3 }).textContent).toBe("2025 2 meetings");
    expect(
      within(years[0])
        .getAllByRole("link")
        .map((a) => a.textContent),
    ).toEqual(["October", "March"]);
    expect(within(years[1]).getByRole("link").textContent).toBe("December");
    // And the total, under the page title.
    expect(screen.getByText("3 meetings since 2024")).toBeTruthy();
  });

  it("dates each past meeting and says where it was", async () => {
    meetings([], [lastMonth]);
    renderPage();
    const past = await screen.findByRole("region", { name: "Past meetings" });
    const stamp = past.querySelector("time");
    expect(stamp?.getAttribute("dateTime")).toBe(lastMonth.start.toISOString());
    expect(stamp?.textContent).toBe("Oct14");
    expect(within(past).getByText("Brom", { selector: ".byline" })).toBeTruthy();
    expect(within(past).getByText("Ada's house")).toBeTruthy();
  });

  it("marks today between what's coming and what's past", async () => {
    meetings([aMeeting()], [lastMonth]);
    renderPage();
    const past = await screen.findByRole("region", { name: "Past meetings" });
    const today = screen.getByText(/^Today/);
    const upcoming = screen.getByRole("region", { name: "Coming up" });
    expect(upcoming.compareDocumentPosition(today)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(today.compareDocumentPosition(past)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("leaves out the past section when there are none", async () => {
    meetings([aMeeting()]);
    renderPage();
    await screen.findByRole("link", { name: "November: Piranesi" });
    expect(screen.queryByRole("region", { name: "Past meetings" })).toBeNull();
  });

  it("shows admins links to create and edit meetings", async () => {
    mockSession(testUser({ isAdmin: true }));
    meetings([aMeeting()]);
    renderPage();
    expect(await screen.findByRole("link", { name: "New meeting" })).toBeTruthy();
    const edit = await screen.findByRole("link", {
      name: "Edit November: Piranesi",
    });
    expect(edit.getAttribute("href")).toBe(
      "/meetings/00000000-0000-4000-8000-000000000002/edit",
    );
  });

  it("hides the new and edit links from other members", async () => {
    meetings([aMeeting()]);
    renderPage();
    await screen.findByRole("link", { name: "November: Piranesi" });
    expect(screen.queryByRole("link", { name: "New meeting" })).toBeNull();
    expect(screen.queryByRole("link", { name: /^Edit/ })).toBeNull();
  });
});
