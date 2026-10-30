import { fireEvent, screen, within } from "@testing-library/react";
import { useLocation } from "react-router-dom";
import { type PollDTO, type SuggestedBookDTO } from "shared";
import { getBookSuggestions, getCurrentPoll } from "../api";
import { mockSession, renderRoutes, Route, testUser } from "../test-utils";
import SuggestionsPage from "./SuggestionsPage";

vi.mock("../lib/auth-client", () => ({ authClient: { useSession: vi.fn() } }));
vi.mock("../api", () => ({
  getBookSuggestions: vi.fn(),
  getCurrentPoll: vi.fn(),
}));

const ada = {
  id: "00000000-0000-4000-8000-000000000001",
  firstName: "Ada",
  lastName: "Lovelace",
  image: null,
};
const ben = {
  id: "00000000-0000-4000-8000-000000000002",
  firstName: "Ben",
  lastName: "Okri",
  image: null,
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

// Stands in for NewPollPage and prints the query it was sent.
const NewPollStub = () => <p>new poll {useLocation().search}</p>;

const renderPage = (at = "/books/suggestions") =>
  renderRoutes(
    at,
    <>
      <Route path="/books/suggestions" element={<SuggestionsPage />} />
      <Route path="/polls/new" element={<NewPollStub />} />
    </>,
  );

const titles = async () => {
  const list = await screen.findByRole("list", { name: "Suggested books" });
  return within(list)
    .getAllByRole("heading")
    .map((h) => h.textContent);
};

describe("SuggestionsPage", () => {
  beforeEach(() => {
    mockSession(testUser());
    vi.mocked(getCurrentPoll).mockResolvedValue(null);
  });

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
    expect(screen.getByText("Madeline Miller")).toBeTruthy();
    expect(screen.getByText("2018 · 404 pages")).toBeTruthy();
    expect(screen.getByText("You suggested this")).toBeTruthy();
  });

  it("shows a suggester's photo, and initials for one without", async () => {
    const photo = "/api/uploads/00000000-0000-4000-8000-000000000003.webp";
    vi.mocked(getBookSuggestions).mockResolvedValue([
      book({ suggestedBy: [{ ...ada, image: photo }, ben] }),
    ]);
    renderPage();
    await screen.findByText(/Suggested by Ada L\., Ben O\./);
    const faces = document.querySelector(".faces");
    expect(faces?.querySelector("img")?.getAttribute("src")).toBe(photo);
    expect(faces?.textContent).toBe("BO");
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

  describe("filters", () => {
    it("searches titles and authors", async () => {
      vi.mocked(getBookSuggestions).mockResolvedValue(books);
      renderPage();
      await titles();
      fireEvent.change(screen.getByLabelText("Search titles and authors"), {
        target: { value: "morrison" },
      });
      expect(await titles()).toEqual(["Beloved"]);
      expect(screen.getByText("1 of 3 books")).toBeTruthy();
    });

    it("filters by length, and a second tap turns it off", async () => {
      vi.mocked(getBookSuggestions).mockResolvedValue(books);
      renderPage();
      await titles();
      const short = screen.getByRole("button", { name: "Under 300 pages" });
      fireEvent.click(short);
      expect(await titles()).toEqual(["Piranesi"]);
      expect(short.getAttribute("aria-pressed")).toBe("true");
      fireEvent.click(short);
      expect(await titles()).toHaveLength(3);
    });

    it("shows only the member's own suggestions", async () => {
      vi.mocked(getBookSuggestions).mockResolvedValue([
        ...books.slice(0, 2),
        { ...books[2], suggestedByMe: true },
      ]);
      renderPage();
      await titles();
      fireEvent.click(screen.getByRole("button", { name: "Suggested by me" }));
      expect(await titles()).toEqual(["Beloved"]);
    });

    it("reads filters from the URL", async () => {
      vi.mocked(getBookSuggestions).mockResolvedValue(books);
      renderPage("/books/suggestions?length=medium&q=c");
      expect(await titles()).toEqual(["Circe"]);
    });

    it("offers genre chips only for genres some book has", async () => {
      vi.mocked(getBookSuggestions).mockResolvedValue(books);
      const { unmount } = renderPage();
      await titles();
      expect(screen.queryByRole("group", { name: "Genre" })).toBeNull();
      unmount();

      vi.mocked(getBookSuggestions).mockResolvedValue([
        { ...books[0], genres: ["Fantasy"] },
        ...books.slice(1),
      ]);
      renderPage();
      await titles();
      fireEvent.click(screen.getByRole("button", { name: "Fantasy" }));
      expect(await titles()).toEqual(["Piranesi"]);
    });

    it("offers to clear filters when nothing matches", async () => {
      vi.mocked(getBookSuggestions).mockResolvedValue(books);
      renderPage("/books/suggestions?q=zzz");
      fireEvent.click(await screen.findByRole("button", { name: "Clear filters" }));
      expect(await titles()).toHaveLength(3);
    });
  });

  describe("starting a poll", () => {
    const idOf = (n: number) => `00000000-0000-4000-8000-0000000001${String(n).padStart(2, "0")}`;
    const many = (count: number) =>
      Array.from({ length: count }, (_, i) =>
        book({ id: idOf(i), title: `Book ${i}` }),
      );
    const checkbox = (title: string) =>
      screen.getByRole("checkbox", { name: `Select ${title} for a poll` });
    const createButton = () =>
      screen.getByRole("button", { name: "Create poll" });

    const openPoll = (bookIds: string[]): PollDTO => ({
      id: "00000000-0000-4000-8000-000000000099",
      theme: null,
      opensAt: new Date("2026-10-20T00:00:00Z"),
      closesAt: new Date("2099-11-01T00:00:00Z"),
      votesPerMember: 1,
      createdAt: new Date("2026-10-20T00:00:00Z"),
      isOpen: true,
      books: bookIds.map((id) => ({
        ...book({ id }),
        synopsis: null,
        meetingId: null,
      })),
      myVotes: [],
      voterCount: 0,
      results: null,
    });

    it("gives members no checkboxes", async () => {
      vi.mocked(getBookSuggestions).mockResolvedValue(books);
      renderPage();
      await titles();
      expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
      expect(
        screen.queryByRole("button", { name: "Create poll" }),
      ).toBeNull();
    });

    it("lets admins pick at least two books, then sends them to the new poll page", async () => {
      mockSession(testUser({ isAdmin: true }));
      vi.mocked(getBookSuggestions).mockResolvedValue(books);
      renderPage();
      await titles();
      await screen.findByText("Tick 2 to 6 books to start a poll.");
      // Nothing to create until a book is ticked.
      expect(screen.queryByRole("button", { name: "Create poll" })).toBeNull();

      fireEvent.click(checkbox("Piranesi"));
      expect(screen.getByText("1 of 6")).toBeTruthy();
      expect(screen.getByText(/pick 1 more/)).toBeTruthy();
      expect((createButton() as HTMLButtonElement).disabled).toBe(true);

      fireEvent.click(checkbox("Beloved"));
      expect(screen.getByText("2 of 6")).toBeTruthy();
      fireEvent.click(createButton());
      expect(
        await screen.findByText(
          `new poll ?books=${books[0].id},${books[2].id}`,
        ),
      ).toBeTruthy();
    });

    it("unticking a book removes it from the selection", async () => {
      mockSession(testUser({ isAdmin: true }));
      vi.mocked(getBookSuggestions).mockResolvedValue(books);
      renderPage();
      await titles();
      fireEvent.click(await screen.findByRole("checkbox", { name: "Select Circe for a poll" }));
      expect(screen.getByText("1 of 6")).toBeTruthy();
      fireEvent.click(checkbox("Circe"));
      expect(screen.queryByRole("button", { name: "Create poll" })).toBeNull();
    });

    it("clears the whole selection at once", async () => {
      mockSession(testUser({ isAdmin: true }));
      vi.mocked(getBookSuggestions).mockResolvedValue(books);
      renderPage();
      await titles();
      fireEvent.click(await screen.findByRole("checkbox", { name: "Select Circe for a poll" }));
      fireEvent.click(checkbox("Beloved"));
      fireEvent.click(screen.getByRole("button", { name: "Clear" }));
      expect((checkbox("Circe") as HTMLInputElement).checked).toBe(false);
      expect((checkbox("Beloved") as HTMLInputElement).checked).toBe(false);
      expect(screen.queryByRole("button", { name: "Create poll" })).toBeNull();
    });

    it("stops at six books", async () => {
      mockSession(testUser({ isAdmin: true }));
      vi.mocked(getBookSuggestions).mockResolvedValue(many(7));
      renderPage();
      await titles();
      for (let i = 0; i < 6; i++) {
        fireEvent.click(await screen.findByRole("checkbox", { name: `Select Book ${i} for a poll` }));
      }
      expect(screen.getByText("6 of 6")).toBeTruthy();
      expect((checkbox("Book 6") as HTMLInputElement).disabled).toBe(true);
      // Unticking one frees a spot again.
      fireEvent.click(checkbox("Book 0"));
      expect((checkbox("Book 6") as HTMLInputElement).disabled).toBe(false);
    });

    it("tells admins to wait while a poll is open, and offers no checkboxes", async () => {
      mockSession(testUser({ isAdmin: true }));
      vi.mocked(getBookSuggestions).mockResolvedValue(books);
      vi.mocked(getCurrentPoll).mockResolvedValue(openPoll([books[1].id]));
      renderPage();
      expect(await screen.findByRole("link", { name: "A poll is open" })).toBeTruthy();
      expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    });

    it("marks books on the open poll's ballot for everyone", async () => {
      vi.mocked(getBookSuggestions).mockResolvedValue(books);
      vi.mocked(getCurrentPoll).mockResolvedValue(openPoll([books[1].id]));
      renderPage();
      const list = await screen.findByRole("list", { name: "Suggested books" });
      const circe = within(list)
        .getByRole("heading", { name: "Circe" })
        .closest("li") as HTMLElement;
      expect(await within(circe).findByText("On the ballot")).toBeTruthy();
      expect(screen.getAllByText("On the ballot")).toHaveLength(1);
    });
  });

  describe("edit links", () => {
    it("shows members an edit link only on books they suggested", async () => {
      vi.mocked(getBookSuggestions).mockResolvedValue([
        book({ suggestedBy: [ada, ben], suggestedByMe: true }),
        books[0],
      ]);
      renderPage();
      const link = await screen.findByRole("link", { name: "Edit Circe" });
      expect(link.getAttribute("href")).toBe(`/books/${books[1].id}/edit`);
      expect(screen.queryByRole("link", { name: "Edit Piranesi" })).toBeNull();
    });

    it("shows admins an edit link on every book", async () => {
      mockSession(testUser({ isAdmin: true }));
      vi.mocked(getBookSuggestions).mockResolvedValue(books);
      renderPage();
      expect(await screen.findByRole("link", { name: "Edit Piranesi" })).toBeTruthy();
      expect(screen.getAllByRole("link", { name: /^Edit / })).toHaveLength(3);
    });
  });
});
