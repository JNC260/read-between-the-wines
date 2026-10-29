import { screen, within } from "@testing-library/react";
import { type MeetingDTO } from "shared";
import { getMeetingRsvps, getMeetings } from "../api";
import { mockSession, renderRoutes, Route, testUser } from "../test-utils";
import EventsPage from "./EventsPage";

vi.mock("../lib/auth-client", () => ({ authClient: { useSession: vi.fn() } }));
vi.mock("../api", () => ({
  getMeetings: vi.fn(),
  getMeetingRsvps: vi.fn(),
  setRsvp: vi.fn(),
}));

const event = (overrides: Partial<MeetingDTO> = {}): MeetingDTO => ({
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

const lastMonth = event({
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
  renderRoutes("/events", <Route path="/events" element={<EventsPage />} />);

describe("EventsPage", () => {
  beforeEach(() => {
    mockSession(testUser());
    vi.mocked(getMeetingRsvps).mockResolvedValue({ myStatus: null, rsvps: [] });
  });

  it("shows each upcoming event as a card that opens its page", async () => {
    meetings([event()]);
    renderPage();
    const link = await screen.findByRole("link", { name: "November: Piranesi" });
    expect(link.getAttribute("href")).toBe(
      "/events/00000000-0000-4000-8000-000000000002",
    );
    expect(screen.getByText("Ada's house, Springfield")).toBeTruthy();
    expect(screen.getByRole("group", { name: "Are you coming?" })).toBeTruthy();
  });

  it("titles a card with its book once one is assigned", async () => {
    meetings([event({ bookId: slewfoot.id, book: slewfoot })]);
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
    meetings([event()], [lastMonth]);
    renderPage();
    const past = await screen.findByRole("region", { name: "Past meetings" });
    const link = within(past).getByRole("link", { name: "Slewfoot" });
    expect(link.getAttribute("href")).toBe(
      "/events/00000000-0000-4000-8000-000000000004",
    );
  });

  it("leaves out the past section when there are none", async () => {
    meetings([event()]);
    renderPage();
    await screen.findByRole("link", { name: "November: Piranesi" });
    expect(screen.queryByRole("region", { name: "Past meetings" })).toBeNull();
  });

  it("shows admins links to create and edit events", async () => {
    mockSession(testUser({ isAdmin: true }));
    meetings([event()]);
    renderPage();
    expect(await screen.findByRole("link", { name: "New event" })).toBeTruthy();
    const edit = await screen.findByRole("link", {
      name: "Edit November: Piranesi",
    });
    expect(edit.getAttribute("href")).toBe(
      "/events/00000000-0000-4000-8000-000000000002/edit",
    );
  });

  it("hides the new and edit links from other members", async () => {
    meetings([event()]);
    renderPage();
    await screen.findByRole("link", { name: "November: Piranesi" });
    expect(screen.queryByRole("link", { name: "New event" })).toBeNull();
    expect(screen.queryByRole("link", { name: /^Edit/ })).toBeNull();
  });
});
