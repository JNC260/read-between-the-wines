import { fireEvent, screen } from "@testing-library/react";
import { type BookDetailDTO } from "shared";
import { ApiError, getBook, updateBook } from "../api";
import { renderRoutes, Route } from "../test-utils";
import EditBookPage from "./EditBookPage";

vi.mock("../api", async (importOriginal) => ({
  // The real ApiError, so the error tests can throw one.
  ApiError: (await importOriginal<typeof import("../api")>()).ApiError,
  getBook: vi.fn(),
  updateBook: vi.fn(),
}));

const ID = "00000000-0000-4000-8000-000000000010";

const circe = (overrides: Partial<BookDetailDTO> = {}): BookDetailDTO => ({
  id: ID,
  title: "Circe",
  author: "Madeline Miller",
  yearPublished: 2018,
  // Mythology is from before the club's genre list.
  genres: ["Fantasy", "Mythology"],
  coverUrl: "https://covers.openlibrary.org/b/id/1-L.jpg",
  synopsis: "A witch on an island.",
  pageCount: 404,
  openLibraryWorkId: "OL18012166W",
  goodreadsUrl: "https://www.goodreads.com/book/show/35959740",
  createdAt: new Date("2026-10-01T00:00:00Z"),
  canEdit: true,
  ...overrides,
});

const renderPage = () =>
  renderRoutes(
    `/books/${ID}/edit`,
    <>
      <Route path="/books/:id/edit" element={<EditBookPage />} />
      <Route path="/books/suggestions" element="suggestions page" />
    </>,
  );

const valueOf = (label: string) =>
  (screen.getByLabelText(label) as HTMLInputElement).value;

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const genre = (name: string) => screen.getByRole("button", { name });
const pressedGenres = () =>
  screen
    .getAllByRole("button", { pressed: true })
    .map((b) => b.textContent);

describe("EditBookPage", () => {
  it("fills the form from the book", async () => {
    vi.mocked(getBook).mockResolvedValue(circe());
    renderPage();
    expect(await screen.findByRole("heading", { name: "Edit Circe" })).toBeTruthy();
    expect(valueOf("Title")).toBe("Circe");
    expect(valueOf("Author")).toBe("Madeline Miller");
    expect(valueOf("Year published")).toBe("2018");
    expect(valueOf("Pages")).toBe("404");
    expect(pressedGenres()).toEqual(["Fantasy"]);
    expect(valueOf("Synopsis")).toBe("A witch on an island.");
    // The work id stops duplicate books, so it isn't offered.
    expect(screen.queryByLabelText(/Open Library/)).toBeNull();
  });

  it("saves every field, clearing emptied ones, then goes back", async () => {
    vi.mocked(getBook).mockResolvedValue(circe());
    vi.mocked(updateBook).mockResolvedValue(circe());
    renderPage();
    await screen.findByLabelText("Title");

    type("Title", "  Circe: A Novel ");
    type("Year published", "");
    fireEvent.click(genre("Fantasy"));
    fireEvent.click(genre("Historical fiction"));
    type("Synopsis", "");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("suggestions page")).toBeTruthy();
    expect(vi.mocked(updateBook).mock.calls[0][0]).toEqual({
      id: ID,
      title: "Circe: A Novel",
      author: "Madeline Miller",
      yearPublished: null,
      pageCount: 404,
      genres: ["Historical fiction"],
      synopsis: null,
      coverUrl: "https://covers.openlibrary.org/b/id/1-L.jpg",
      goodreadsUrl: "https://www.goodreads.com/book/show/35959740",
    });
  });

  it("points out invalid fields without saving", async () => {
    vi.mocked(getBook).mockResolvedValue(circe());
    renderPage();
    await screen.findByLabelText("Title");

    type("Title", " ");
    type("Pages", "four hundred");
    type("Goodreads link", "https://example.com/circe");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(screen.getByLabelText("Title").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByLabelText("Pages").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("Not a Goodreads book link")).toBeTruthy();
    expect(vi.mocked(updateBook)).not.toHaveBeenCalled();
  });

  it("shows the server's reason when a save fails", async () => {
    vi.mocked(getBook).mockResolvedValue(circe());
    vi.mocked(updateBook).mockRejectedValue(
      new ApiError(403, "Only members who suggested this book, or an admin, can edit it"),
    );
    renderPage();
    await screen.findByLabelText("Title");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Only members who suggested this book, or an admin, can edit it",
    );
    expect(screen.queryByText("suggestions page")).toBeNull();
  });

  it("tells members who can't edit the book, with no form", async () => {
    vi.mocked(getBook).mockResolvedValue(circe({ canEdit: false }));
    renderPage();
    expect(
      await screen.findByText(/Only members who suggested/),
    ).toBeTruthy();
    expect(screen.queryByLabelText("Title")).toBeNull();
  });

  it("shows an error for a book that doesn't exist", async () => {
    vi.mocked(getBook).mockRejectedValue(
      new ApiError(404, "Book not found"),
    );
    renderPage();
    expect((await screen.findByRole("alert")).textContent).toBe("Book not found");
  });

  it("offers the club's genres as chips, up to three", async () => {
    vi.mocked(getBook).mockResolvedValue(circe({ genres: [] }));
    renderPage();
    await screen.findByLabelText("Title");

    fireEvent.click(genre("Fantasy"));
    fireEvent.click(genre("Romance"));
    fireEvent.click(genre("Horror"));
    // In the list's order, not the order they were picked.
    expect(pressedGenres()).toEqual(["Romance", "Fantasy", "Horror"]);
    expect((genre("Humor") as HTMLButtonElement).disabled).toBe(true);
    // Turning one off frees a spot.
    fireEvent.click(genre("Romance"));
    expect((genre("Humor") as HTMLButtonElement).disabled).toBe(false);
  });
});
