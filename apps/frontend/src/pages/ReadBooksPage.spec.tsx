import { fireEvent, screen, within } from "@testing-library/react";
import { type ReadBookDTO } from "shared";
import { getReadBooks, rateBook } from "../api";
import { mockSession, renderRoutes, Route, testUser } from "../test-utils";
import ReadBooksPage from "./ReadBooksPage";

vi.mock("../lib/auth-client", () => ({ authClient: { useSession: vi.fn() } }));
vi.mock("../api", () => ({ getReadBooks: vi.fn(), rateBook: vi.fn() }));

let nextId = 0;
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const book = (overrides: Partial<ReadBookDTO> = {}): ReadBookDTO => {
  nextId++;
  return {
    id: uuid(nextId),
    title: "Circe",
    author: "Madeline Miller",
    yearPublished: 2018,
    genres: [],
    coverUrl: null,
    pageCount: 404,
    openLibraryWorkId: "OL18012166W",
    goodreadsUrl: null,
    createdAt: new Date("2026-08-01T00:00:00Z"),
    suggestedByMe: false,
    meetingId: uuid(1000 + nextId),
    meetingStart: new Date("2020-09-10T12:00"),
    averageRating: null,
    ratingCount: 0,
    myRating: null,
    ...overrides,
  };
};

// As the API sends them: latest meeting first. Local noon, so the year
// doesn't shift in any test time zone.
const piranesi = book({
  title: "Piranesi",
  author: "Susanna Clarke",
  pageCount: 272,
  meetingStart: new Date("2021-03-10T12:00"),
});
const beloved = book({
  title: "Beloved",
  author: "Toni Morrison",
  pageCount: null,
  meetingStart: new Date("2020-11-10T12:00"),
});
const circe = book();
const slewfoot = book({
  title: "Slewfoot",
  author: "Brom",
  pageCount: 320,
  yearPublished: 2021,
  meetingStart: new Date("2099-11-17T18:00"),
});

const renderPage = () =>
  renderRoutes("/books/read", <Route path="/books/read" element={<ReadBooksPage />} />);

const shelf = (year: string) => screen.getByRole("region", { name: year });
const titlesOn = (region: HTMLElement) =>
  within(region)
    .getAllByRole("button", { name: / by / })
    .map((b) => b.getAttribute("aria-label")?.split(" by ")[0]);
const details = () => screen.getByRole("complementary", { name: "Book details" });
const spine = (title: string) =>
  screen.getByRole("button", { name: new RegExp(`^${title} by`) });

describe("ReadBooksPage", () => {
  beforeEach(() => {
    mockSession(testUser());
  });

  it("shows an empty state", async () => {
    vi.mocked(getReadBooks).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText("No books read yet.")).toBeTruthy();
  });

  it("puts each year on its own shelf, newest year on top, in reading order", async () => {
    vi.mocked(getReadBooks).mockResolvedValue([piranesi, beloved, circe]);
    renderPage();
    await screen.findByRole("region", { name: "2021" });

    const shelves = screen
      .getAllByRole("region")
      .map((r) => r.getAttribute("aria-labelledby"));
    expect(shelves).toEqual(["shelf-2021", "shelf-2020"]);
    expect(titlesOn(shelf("2020"))).toEqual(["Circe", "Beloved"]);
    expect(titlesOn(shelf("2021"))).toEqual(["Piranesi"]);
    expect(within(shelf("2020")).getByText("2 books · 404 pages")).toBeTruthy();
  });

  it("totals the books and pages discussed", async () => {
    vi.mocked(getReadBooks).mockResolvedValue([slewfoot, piranesi, beloved, circe]);
    renderPage();
    // Slewfoot hasn't been discussed yet, and Beloved has no page count.
    expect(await screen.findByText(/3 books · 676 pages · since/)).toBeTruthy();
  });

  it("features the next meeting's book, linked to the meeting, and flags its spine", async () => {
    vi.mocked(getReadBooks).mockResolvedValue([slewfoot, circe]);
    renderPage();
    const banner = await screen.findByRole("region", { name: "Up next" });
    expect(within(banner).getByRole("heading", { name: "Slewfoot" })).toBeTruthy();
    expect(within(banner).getByText("Brom · 320 pages · published 2021")).toBeTruthy();
    expect(
      within(banner).getByRole("link", { name: "See the meeting" }).getAttribute("href"),
    ).toBe(`/meetings/${slewfoot.meetingId}`);
    expect(
      screen.getByRole("button", { name: /^Slewfoot by Brom, up next in/ }),
    ).toBeTruthy();
  });

  it("has no up-next banner when nothing is scheduled", async () => {
    vi.mocked(getReadBooks).mockResolvedValue([circe]);
    renderPage();
    await screen.findByRole("region", { name: "2020" });
    expect(screen.queryByRole("region", { name: "Up next" })).toBeNull();
  });

  it("shows the most recently discussed book until another is picked", async () => {
    vi.mocked(getReadBooks).mockResolvedValue([slewfoot, piranesi, circe]);
    renderPage();
    await screen.findByRole("region", { name: "2021" });
    expect(within(details()).getByRole("heading", { name: "Piranesi" })).toBeTruthy();
    expect(spine("Piranesi").getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(spine("Circe"));

    expect(within(details()).getByRole("heading", { name: "Circe" })).toBeTruthy();
    expect(within(details()).getByText("Madeline Miller")).toBeTruthy();
    expect(within(details()).getByText("404")).toBeTruthy();
    expect(spine("Circe").getAttribute("aria-pressed")).toBe("true");
    expect(spine("Piranesi").getAttribute("aria-pressed")).toBe("false");
    expect(
      within(details()).getByRole("link", { name: "See the meeting" }).getAttribute("href"),
    ).toBe(`/meetings/${circe.meetingId}`);
  });

  it("says when a page count is missing", async () => {
    vi.mocked(getReadBooks).mockResolvedValue([beloved]);
    renderPage();
    await screen.findByRole("region", { name: "2020" });
    expect(within(details()).getByText("Not listed")).toBeTruthy();
  });

  it("shows the club's average rating", async () => {
    vi.mocked(getReadBooks).mockResolvedValue([
      book({ averageRating: 13 / 3, ratingCount: 3 }),
    ]);
    renderPage();
    expect(await screen.findByText("4.3 / 5 from 3 ratings")).toBeTruthy();
  });

  it("says when nobody has rated it", async () => {
    vi.mocked(getReadBooks).mockResolvedValue([circe]);
    renderPage();
    expect(await screen.findByText("Not rated yet")).toBeTruthy();
  });

  it("marks the member's own rating", async () => {
    vi.mocked(getReadBooks).mockResolvedValue([book({ myRating: 3 })]);
    renderPage();
    const group = await screen.findByRole("group", {
      name: "Your rating for Circe",
    });
    const pressed = within(group)
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-pressed") === "true");
    expect(pressed.map((b) => b.getAttribute("aria-label"))).toEqual([
      "3 stars",
    ]);
  });

  it("saves a rating and refetches the list", async () => {
    vi.mocked(getReadBooks).mockResolvedValue([circe]);
    vi.mocked(rateBook).mockResolvedValue({ bookId: circe.id, score: 4 });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "4 stars" }));
    await vi.waitFor(() =>
      expect(vi.mocked(getReadBooks)).toHaveBeenCalledTimes(2),
    );
    expect(vi.mocked(rateBook).mock.calls[0][0]).toEqual({
      bookId: circe.id,
      score: 4,
    });
  });

  it("shows an error if the rating doesn't save", async () => {
    vi.mocked(getReadBooks).mockResolvedValue([circe]);
    vi.mocked(rateBook).mockRejectedValue(
      new Error("Only books the club has read can be rated"),
    );
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "2 stars" }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Only books the club has read can be rated",
    );
  });

  describe("edit link", () => {
    const mine = book({
      title: "Weyward",
      meetingStart: new Date("2021-01-10T12:00"),
      suggestedByMe: true,
    });

    it("is offered on a book the member suggested", async () => {
      vi.mocked(getReadBooks).mockResolvedValue([mine, circe]);
      renderPage();
      await screen.findByRole("region", { name: "2021" });
      const link = within(details()).getByRole("link", { name: "Edit book" });
      expect(link.getAttribute("href")).toBe(`/books/${mine.id}/edit`);
    });

    it("isn't offered on someone else's book", async () => {
      vi.mocked(getReadBooks).mockResolvedValue([mine, circe]);
      renderPage();
      await screen.findByRole("region", { name: "2021" });
      fireEvent.click(spine("Circe"));
      expect(within(details()).queryByRole("link", { name: "Edit book" })).toBeNull();
    });

    it("is offered to admins on every book", async () => {
      mockSession(testUser({ isAdmin: true }));
      vi.mocked(getReadBooks).mockResolvedValue([mine, circe]);
      renderPage();
      await screen.findByRole("region", { name: "2021" });
      fireEvent.click(spine("Circe"));
      expect(within(details()).getByRole("link", { name: "Edit book" })).toBeTruthy();
    });
  });
});
