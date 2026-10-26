import { fireEvent, screen, within } from "@testing-library/react";
import { ApiError, castVotes, getPoll } from "../api";
import { beloved, circe, piranesi, testPoll } from "../test/fixtures";
import { renderRoutes, Route } from "../test-utils";
import PollPage, { goodreadsLink } from "./PollPage";

vi.mock("../api", async (importOriginal) => ({
  ApiError: (await importOriginal<typeof import("../api")>()).ApiError,
  castVotes: vi.fn(),
  getPoll: vi.fn(),
}));

const ID = testPoll().id;

const renderPage = () =>
  renderRoutes(`/polls/${ID}`, <Route path="/polls/:id" element={<PollPage />} />);

const box = (title: string) =>
  screen.getByRole("checkbox", { name: `Vote for ${title}` }) as HTMLInputElement;

const loaded = () => screen.findByRole("list", { name: "Ballot" });

describe("goodreadsLink", () => {
  it("uses the saved Goodreads link", () => {
    expect(goodreadsLink(piranesi)).toBe(piranesi.goodreadsUrl);
  });

  it("falls back to a Goodreads search for the title and author", () => {
    expect(goodreadsLink(circe)).toBe(
      "https://www.goodreads.com/search?q=Circe%20Madeline%20Miller",
    );
  });
});

describe("PollPage", () => {
  it("loads the poll from the URL and shows each book's synopsis and link", async () => {
    vi.mocked(getPoll).mockResolvedValue(testPoll({ theme: "Witchy reads" }));
    renderPage();
    await loaded();
    expect(vi.mocked(getPoll).mock.calls[0][0]).toBe(ID);
    expect(screen.getByRole("heading", { name: "Book poll: Witchy reads" })).toBeTruthy();
    expect(screen.getByText("A witch on an island.")).toBeTruthy();
    // Blank lines split the synopsis into paragraphs.
    expect(screen.getByText("A house of endless halls.")).toBeTruthy();
    expect(screen.getByText("And a tide.")).toBeTruthy();
    const link = screen.getByRole("link", { name: "Piranesi on Goodreads" });
    expect(link.getAttribute("href")).toBe(piranesi.goodreadsUrl);
  });

  it("says how many votes each member gets and how many have voted", async () => {
    vi.mocked(getPoll).mockResolvedValue(testPoll({ voterCount: 3 }));
    renderPage();
    await loaded();
    expect(screen.getByText(/Pick up to 2 books/)).toBeTruthy();
    expect(screen.getByText("3 members voted so far.")).toBeTruthy();
  });

  it("starts from the member's saved votes and offers to update them", async () => {
    vi.mocked(getPoll).mockResolvedValue(testPoll({ myVotes: [piranesi.id] }));
    renderPage();
    await loaded();
    expect(box("Piranesi").checked).toBe(true);
    expect(box("Circe").checked).toBe(false);
    expect(screen.getByRole("button", { name: "Update votes" })).toBeTruthy();
  });

  it("stops at the poll's vote limit", async () => {
    vi.mocked(getPoll).mockResolvedValue(testPoll());
    renderPage();
    await loaded();
    fireEvent.click(box("Circe"));
    fireEvent.click(box("Beloved"));
    expect(box("Piranesi").disabled).toBe(true);
    expect(screen.getByText("2 of 2 picked")).toBeTruthy();
    fireEvent.click(box("Circe"));
    expect(box("Piranesi").disabled).toBe(false);
  });

  it("can't submit without picking a book", async () => {
    vi.mocked(getPoll).mockResolvedValue(testPoll());
    renderPage();
    await loaded();
    const submit = screen.getByRole("button", { name: "Submit votes" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });

  it("submits the picked books and confirms", async () => {
    vi.mocked(getPoll).mockResolvedValue(testPoll());
    vi.mocked(castVotes).mockResolvedValue(
      testPoll({ myVotes: [beloved.id, circe.id], voterCount: 1 }),
    );
    renderPage();
    await loaded();
    fireEvent.click(box("Beloved"));
    fireEvent.click(box("Circe"));
    fireEvent.click(screen.getByRole("button", { name: "Submit votes" }));
    expect((await screen.findByRole("status")).textContent).toBe(
      "Your votes are saved.",
    );
    expect(vi.mocked(castVotes).mock.calls[0][0]).toEqual({
      pollId: ID,
      bookIds: [beloved.id, circe.id],
    });
    // The saved poll replaces the cached one.
    expect(screen.getByText("1 member voted so far.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Update votes" })).toBeTruthy();
  });

  it("shows the server's error if the votes don't save", async () => {
    vi.mocked(getPoll).mockResolvedValue(testPoll());
    vi.mocked(castVotes).mockRejectedValue(new Error("This poll has closed"));
    renderPage();
    await loaded();
    fireEvent.click(box("Circe"));
    fireEvent.click(screen.getByRole("button", { name: "Submit votes" }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "This poll has closed",
    );
  });

  it("shows the results, most votes first, once the poll has closed", async () => {
    vi.mocked(getPoll).mockResolvedValue(
      testPoll({
        isOpen: false,
        closesAt: new Date("2026-10-25T19:00:00Z"),
        myVotes: [circe.id],
        voterCount: 3,
        results: [
          { bookId: piranesi.id, votes: 3 },
          { bookId: circe.id, votes: 1 },
          { bookId: beloved.id, votes: 0 },
        ],
      }),
    );
    renderPage();
    const results = await screen.findByRole("list", { name: "Results" });
    expect(
      within(results)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual([
      "Piranesi by Susanna Clarke: 3 votes",
      "Circe by Madeline Miller: 1 vote (you voted for this)",
      "Beloved by Toni Morrison: 0 votes",
    ]);
    expect(screen.getByText("3 members voted.")).toBeTruthy();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("says so when the poll doesn't exist", async () => {
    vi.mocked(getPoll).mockRejectedValue(new ApiError(404, "Poll not found"));
    renderPage();
    expect((await screen.findByRole("alert")).textContent).toBe("Poll not found");
  });
});
