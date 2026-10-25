import { fireEvent, screen } from "@testing-library/react";
import { type BookCandidateDTO } from "shared";
import { ApiError, createBookSuggestion, searchBooks } from "../api";
import { renderRoutes, Route } from "../test-utils";
import SuggestBookPage from "./SuggestBookPage";

vi.mock("../api", async (importOriginal) => ({
  ApiError: (await importOriginal<typeof import("../api")>()).ApiError,
  searchBooks: vi.fn(),
  createBookSuggestion: vi.fn(),
}));

const LINK = "https://www.goodreads.com/book/show/35959740-circe";

const candidate = (
  overrides: Partial<BookCandidateDTO> = {},
): BookCandidateDTO => ({
  openLibraryWorkId: "OL18012166W",
  title: "Circe",
  author: "Madeline Miller",
  yearPublished: 2018,
  coverUrl: "https://covers.openlibrary.org/b/id/8739376-L.jpg",
  pageCount: 404,
  alreadySuggested: false,
  suggestedByMe: false,
  ...overrides,
});

const renderPage = () =>
  renderRoutes(
    "/books/suggest",
    <Route path="/books/suggest" element={<SuggestBookPage />} />,
  );

const type = (text: string) =>
  fireEvent.change(screen.getByLabelText("Goodreads link or title"), {
    target: { value: text },
  });

describe("SuggestBookPage", () => {
  beforeEach(() => vi.resetAllMocks());

  it("searches a pasted Goodreads link and lists the matches", async () => {
    vi.mocked(searchBooks).mockResolvedValue([candidate()]);
    renderPage();
    type(LINK);
    expect(await screen.findByText("Circe")).toBeTruthy();
    expect(screen.getByText("by Madeline Miller · 2018 · 404 pages")).toBeTruthy();
    expect(searchBooks).toHaveBeenCalledWith(LINK);
  });

  it("searches typed titles once typing pauses", async () => {
    vi.mocked(searchBooks).mockResolvedValue([candidate()]);
    renderPage();
    type("ci");
    type("circe");
    expect(await screen.findByText("Circe")).toBeTruthy();
    expect(searchBooks).toHaveBeenCalledOnce();
    expect(searchBooks).toHaveBeenCalledWith("circe");
  });

  it("points out a link that isn't a Goodreads book, without searching", async () => {
    renderPage();
    type("https://www.goodreads.com/author/show/7357817.Madeline_Miller");
    expect(await screen.findByText(/That isn't a Goodreads book link/)).toBeTruthy();
    expect(
      screen.getByLabelText("Goodreads link or title").getAttribute("aria-invalid"),
    ).toBe("true");
    await new Promise((r) => setTimeout(r, 500));
    expect(searchBooks).not.toHaveBeenCalled();
  });

  it("says when nothing matches", async () => {
    vi.mocked(searchBooks).mockResolvedValue([]);
    renderPage();
    type(LINK);
    expect(await screen.findByText("No matches found.")).toBeTruthy();
  });

  it("shows a search error", async () => {
    vi.mocked(searchBooks).mockRejectedValue(
      new ApiError(502, "An outside service is unavailable"),
    );
    renderPage();
    type(LINK);
    expect((await screen.findByRole("alert")).textContent).toBe(
      "An outside service is unavailable",
    );
  });

  it("suggests the picked book with the pasted link, then confirms", async () => {
    vi.mocked(searchBooks).mockResolvedValue([candidate()]);
    vi.mocked(createBookSuggestion).mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000004",
      title: "Circe",
      author: "Madeline Miller",
      yearPublished: 2018,
      genres: [],
      coverUrl: null,
      synopsis: null,
      pageCount: 404,
      openLibraryWorkId: "OL18012166W",
      goodreadsUrl: LINK,
      createdAt: new Date(),
    });
    renderPage();
    type(LINK);
    fireEvent.click(await screen.findByRole("button", { name: "Suggest Circe" }));
    expect(await screen.findByRole("heading", { name: "Book suggested" })).toBeTruthy();
    expect(vi.mocked(createBookSuggestion).mock.calls[0][0]).toEqual({
      openLibraryWorkId: "OL18012166W",
      goodreadsUrl: LINK,
    });

    fireEvent.click(screen.getByRole("button", { name: "Suggest another book" }));
    expect(
      (screen.getByLabelText("Goodreads link or title") as HTMLInputElement).value,
    ).toBe("");
  });

  it("sends no Goodreads link for a typed title", async () => {
    vi.mocked(searchBooks).mockResolvedValue([candidate()]);
    vi.mocked(createBookSuggestion).mockReturnValue(new Promise(() => undefined));
    renderPage();
    type("circe");
    fireEvent.click(await screen.findByRole("button", { name: "Suggest Circe" }));
    expect(await screen.findByText("Suggesting...")).toBeTruthy();
    await vi.waitFor(() =>
      expect(vi.mocked(createBookSuggestion).mock.calls[0][0]).toEqual({
        openLibraryWorkId: "OL18012166W",
        goodreadsUrl: undefined,
      }),
    );
  });

  it("shows the server's error when suggesting fails", async () => {
    vi.mocked(searchBooks).mockResolvedValue([candidate()]);
    vi.mocked(createBookSuggestion).mockRejectedValue(
      new ApiError(409, "You've already suggested this book"),
    );
    renderPage();
    type(LINK);
    fireEvent.click(await screen.findByRole("button", { name: "Suggest Circe" }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "You've already suggested this book",
    );
  });

  it("notes books others suggested, and hides the button for your own", async () => {
    vi.mocked(searchBooks).mockResolvedValue([
      candidate({ alreadySuggested: true }),
      candidate({
        openLibraryWorkId: "OL27482W",
        title: "The Hobbit",
        alreadySuggested: true,
        suggestedByMe: true,
      }),
    ]);
    renderPage();
    type("some title");
    expect(await screen.findByText("Another member has suggested this.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Suggest Circe" })).toBeTruthy();
    expect(screen.getByText("You've already suggested this.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Suggest The Hobbit" })).toBeNull();
  });
});
