import { screen } from "@testing-library/react";
import { type MeetingDTO } from "shared";
import { getMeetings } from "../api";
import { mockSession, renderRoutes, Route, testUser } from "../test-utils";
import EventsPage from "./EventsPage";

vi.mock("../lib/auth-client", () => ({ authClient: { useSession: vi.fn() } }));
vi.mock("../api", () => ({ getMeetings: vi.fn() }));

const event = (overrides: Partial<MeetingDTO> = {}): MeetingDTO => ({
  id: "00000000-0000-4000-8000-000000000002",
  title: "November: Piranesi",
  start: new Date("2030-11-04T19:00:00"),
  end: new Date("2030-11-04T21:00:00"),
  description: "Bring a snack",
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

const renderPage = () =>
  renderRoutes("/events", <Route path="/events" element={<EventsPage />} />);

describe("EventsPage", () => {
  beforeEach(() => mockSession(testUser()));

  it("asks only for upcoming events", async () => {
    vi.mocked(getMeetings).mockResolvedValue([]);
    renderPage();
    await screen.findByText(/Nothing scheduled yet/);
    expect(vi.mocked(getMeetings).mock.calls[0][0]).toBe("upcoming");
  });

  it("lists each event with its venue and description", async () => {
    vi.mocked(getMeetings).mockResolvedValue([event()]);
    renderPage();
    expect(
      await screen.findByRole("heading", { name: "November: Piranesi" }),
    ).toBeTruthy();
    expect(screen.getByText("Ada's house, 1 Main St, Springfield")).toBeTruthy();
    expect(screen.getByText("Bring a snack")).toBeTruthy();
  });

  it("shows the book once one is assigned", async () => {
    vi.mocked(getMeetings).mockResolvedValue([
      event({
        bookId: "00000000-0000-4000-8000-000000000010",
        book: {
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
        },
      }),
    ]);
    renderPage();
    const line = await screen.findByText(/Reading/);
    expect(line.textContent).toBe("Reading Slewfoot by Brom");
  });

  it("says when the venue hasn't been picked", async () => {
    vi.mocked(getMeetings).mockResolvedValue([
      event({ venueId: null, venue: null }),
    ]);
    renderPage();
    expect(await screen.findByText("Location to be announced")).toBeTruthy();
  });

  it("shows admins a link to create an event", async () => {
    mockSession(testUser({ isAdmin: true }));
    vi.mocked(getMeetings).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByRole("link", { name: "New event" })).toBeTruthy();
  });

  it("lets admins edit each event", async () => {
    mockSession(testUser({ isAdmin: true }));
    vi.mocked(getMeetings).mockResolvedValue([event()]);
    renderPage();
    const link = await screen.findByRole("link", {
      name: "Edit November: Piranesi",
    });
    expect(link.getAttribute("href")).toBe(
      "/events/00000000-0000-4000-8000-000000000002/edit",
    );
  });

  it("hides the new and edit links from other members", async () => {
    vi.mocked(getMeetings).mockResolvedValue([event()]);
    renderPage();
    await screen.findByRole("heading", { name: "November: Piranesi" });
    expect(screen.queryByRole("link", { name: "New event" })).toBeNull();
    expect(screen.queryByRole("link", { name: /^Edit/ })).toBeNull();
  });
});
