import { screen } from "@testing-library/react";
import { type ReadBookDTO } from "shared";
import { getReadBooks } from "../api";
import { renderRoutes, Route } from "../test-utils";
import ReadBooksPage from "./ReadBooksPage";

vi.mock("../api", () => ({ getReadBooks: vi.fn() }));

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
  meetingId: "00000000-0000-4000-8000-000000000020",
  meetingStart: new Date("2020-09-10T19:00:00Z"),
  ...overrides,
});

const renderPage = () =>
  renderRoutes("/books/read", <Route path="/books/read" element={<ReadBooksPage />} />);

describe("ReadBooksPage", () => {
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
});
