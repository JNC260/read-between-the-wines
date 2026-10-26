import { fireEvent, screen, within } from "@testing-library/react";
import { type SuggestedBookDTO } from "shared";
import { getBookSuggestions } from "../api";
import { renderRoutes, Route } from "../test-utils";
import SuggestionsPage from "./SuggestionsPage";

vi.mock("../api", () => ({ getBookSuggestions: vi.fn() }));

const ada = {
  id: "00000000-0000-4000-8000-000000000001",
  firstName: "Ada",
  lastName: "Lovelace",
};
const ben = {
  id: "00000000-0000-4000-8000-000000000002",
  firstName: "Ben",
  lastName: "Okri",
};

const book = (overrides: Partial<SuggestedBookDTO> = {}): SuggestedBookDTO => ({
  id: "00000000-0000-4000-8000-000000000010",
  title: "Circe",
  author: "Madeline Miller",
  yearPublished: 2018,
  genres: [],
  coverUrl: null,
  pageCount: 404,
  openLibraryWorkId: "OL18012166W",
  goodreadsUrl: null,
  createdAt: new Date("2026-10-01T00:00:00Z"),
  suggestedBy: [ada],
  suggestedByMe: false,
  suggestedAt: new Date("2026-10-01T00:00:00Z"),
  ...overrides,
});

// Arrives from the API newest first, as the server sorts it.
const books = [
  book({
    id: "00000000-0000-4000-8000-000000000011",
    title: "Piranesi",
    author: "Susanna Clarke",
    yearPublished: null,
    pageCount: 272,
    suggestedAt: new Date("2026-10-09T00:00:00Z"),
  }),
  book({ suggestedBy: [ada, ben] }),
  book({
    id: "00000000-0000-4000-8000-000000000012",
    title: "Beloved",
    author: "Toni Morrison",
    yearPublished: 1987,
    pageCount: 324,
    suggestedAt: new Date("2026-09-20T00:00:00Z"),
  }),
];

const renderPage = (at = "/books/suggestions") =>
  renderRoutes(
    at,
    <Route path="/books/suggestions" element={<SuggestionsPage />} />,
  );

const titles = async () => {
  const list = await screen.findByRole("list", { name: "Suggested books" });
  return within(list)
    .getAllByRole("heading")
    .map((h) => h.textContent);
};

describe("SuggestionsPage", () => {
  it("shows an empty state", async () => {
    vi.mocked(getBookSuggestions).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText(/No suggestions yet/)).toBeTruthy();
  });

  it("shows who suggested each book and marks the member's own", async () => {
    vi.mocked(getBookSuggestions).mockResolvedValue([
      book({ suggestedBy: [ada, ben], suggestedByMe: true }),
    ]);
    renderPage();
    expect(await screen.findByText(/Suggested by Ada L\., Ben O\./)).toBeTruthy();
    expect(screen.getByText("by Madeline Miller · 2018 · 404 pages")).toBeTruthy();
    expect(screen.getByText("You suggested this.")).toBeTruthy();
  });

  it("defaults to newest suggestion first", async () => {
    vi.mocked(getBookSuggestions).mockResolvedValue(books);
    renderPage();
    expect(await titles()).toEqual(["Piranesi", "Circe", "Beloved"]);
  });

  it("sorts by title A to Z when picked, and flips order", async () => {
    vi.mocked(getBookSuggestions).mockResolvedValue(books);
    renderPage();
    await titles();
    fireEvent.change(screen.getByLabelText("Sort by"), {
      target: { value: "title" },
    });
    expect(await titles()).toEqual(["Beloved", "Circe", "Piranesi"]);
    fireEvent.click(screen.getByRole("button", { name: "Ascending" }));
    expect(await titles()).toEqual(["Piranesi", "Circe", "Beloved"]);
  });

  it("puts books with no year last either way", async () => {
    vi.mocked(getBookSuggestions).mockResolvedValue(books);
    renderPage("/books/suggestions?sort=yearPublished&order=asc");
    expect(await titles()).toEqual(["Beloved", "Circe", "Piranesi"]);
    fireEvent.click(screen.getByRole("button", { name: "Ascending" }));
    expect(await titles()).toEqual(["Circe", "Beloved", "Piranesi"]);
  });

  it("sorts by number of suggestions", async () => {
    vi.mocked(getBookSuggestions).mockResolvedValue(books);
    renderPage("/books/suggestions?sort=suggesters");
    expect((await titles())[0]).toBe("Circe");
  });

  it("ignores an unknown sort in the URL", async () => {
    vi.mocked(getBookSuggestions).mockResolvedValue(books);
    renderPage("/books/suggestions?sort=nonsense");
    expect(await titles()).toEqual(["Piranesi", "Circe", "Beloved"]);
  });
});
