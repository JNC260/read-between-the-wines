import { fireEvent, screen, within } from "@testing-library/react";
import { type ReadBookDTO } from "shared";
import { getReadBooks, rateBook } from "../api";
import { mockSession, renderRoutes, Route, testUser } from "../test-utils";
import ReadBooksPage from "./ReadBooksPage";

vi.mock("../lib/auth-client", () => ({ authClient: { useSession: vi.fn() } }));
vi.mock("../api", () => ({ getReadBooks: vi.fn(), rateBook: vi.fn() }));

const book = (overrides: Partial<ReadBookDTO> = {}): ReadBookDTO => ({
  id: "00000000-0000-4000-8000-000000000010",
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
  meetingId: "00000000-0000-4000-8000-000000000020",
  meetingStart: new Date("2020-09-10T19:00:00Z"),
  averageRating: null,
  ratingCount: 0,
  myRating: null,
  ...overrides,
});

const renderPage = () =>
  renderRoutes("/books/read", <Route path="/books/read" element={<ReadBooksPage />} />);

describe("ReadBooksPage", () => {
  beforeEach(() => {
    mockSession(testUser());
  });

  it("shows an empty state", async () => {
    vi.mocked(getReadBooks).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText("No books read yet.")).toBeTruthy();
  });

  it("labels past meetings as discussed and a future one as up next", async () => {
    vi.mocked(getReadBooks).mockResolvedValue([
      book({
        id: "00000000-0000-4000-8000-000000000011",
        title: "Piranesi",
        meetingId: "00000000-0000-4000-8000-000000000021",
        meetingStart: new Date("2099-01-10T19:00:00Z"),
      }),
      book(),
    ]);
    renderPage();
    expect(await screen.findByRole("heading", { name: "Piranesi" })).toBeTruthy();
    expect(screen.getByText(/Up next:/)).toBeTruthy();
    expect(screen.getByText(/Discussed/)).toBeTruthy();
  });

  it("shows the club's average rating", async () => {
    vi.mocked(getReadBooks).mockResolvedValue([
      book({ averageRating: 13 / 3, ratingCount: 3 }),
    ]);
    renderPage();
    expect(
      await screen.findByText("Club rating: 4.3 / 5 from 3 ratings"),
    ).toBeTruthy();
  });

  it("says when nobody has rated it", async () => {
    vi.mocked(getReadBooks).mockResolvedValue([book()]);
    renderPage();
    expect(await screen.findByText("Club rating: Not rated yet")).toBeTruthy();
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
    vi.mocked(getReadBooks).mockResolvedValue([book()]);
    vi.mocked(rateBook).mockResolvedValue({
      bookId: book().id,
      score: 4,
    });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "4 stars" }));
    await vi.waitFor(() =>
      expect(vi.mocked(getReadBooks)).toHaveBeenCalledTimes(2),
    );
    expect(vi.mocked(rateBook).mock.calls[0][0]).toEqual({
      bookId: book().id,
      score: 4,
    });
  });

  it("shows an error if the rating doesn't save", async () => {
    vi.mocked(getReadBooks).mockResolvedValue([book()]);
    vi.mocked(rateBook).mockRejectedValue(
      new Error("Only books the club has read can be rated"),
    );
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "2 stars" }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Only books the club has read can be rated",
    );
  });

  describe("edit links", () => {
    const piranesi = book({
      id: "00000000-0000-4000-8000-000000000011",
      title: "Piranesi",
      meetingId: "00000000-0000-4000-8000-000000000021",
      suggestedByMe: true,
    });

    it("shows members an edit link only on books they suggested", async () => {
      vi.mocked(getReadBooks).mockResolvedValue([piranesi, book()]);
      renderPage();
      const link = await screen.findByRole("link", { name: "Edit Piranesi" });
      expect(link.getAttribute("href")).toBe(`/books/${piranesi.id}/edit`);
      expect(screen.queryByRole("link", { name: "Edit Circe" })).toBeNull();
    });

    it("shows admins an edit link on every book", async () => {
      mockSession(testUser({ isAdmin: true }));
      vi.mocked(getReadBooks).mockResolvedValue([piranesi, book()]);
      renderPage();
      expect(await screen.findByRole("link", { name: "Edit Piranesi" })).toBeTruthy();
      expect(screen.getByRole("link", { name: "Edit Circe" })).toBeTruthy();
    });
  });
});
