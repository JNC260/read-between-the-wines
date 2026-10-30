import { fireEvent, screen, within } from "@testing-library/react";
import {
  ApiError,
  castVotes,
  closePoll,
  getMeetings,
  getPoll,
  updateMeeting,
} from "../api";
import { beloved, circe, piranesi, testMeeting, testPoll } from "../test/fixtures";
import { mockSession, renderRoutes, Route, testUser } from "../test-utils";
import PollPage, { goodreadsLink } from "./PollPage";

vi.mock("../api", async (importOriginal) => ({
  ApiError: (await importOriginal<typeof import("../api")>()).ApiError,
  castVotes: vi.fn(),
  closePoll: vi.fn(),
  getMeetings: vi.fn(),
  getPoll: vi.fn(),
  updateMeeting: vi.fn(),
}));
vi.mock("../lib/auth-client", () => ({ authClient: { useSession: vi.fn() } }));

beforeEach(() => {
  mockSession(testUser());
  vi.mocked(getMeetings).mockResolvedValue([]);
});

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
    expect(screen.getByRole("heading", { level: 1, name: "Witchy reads" })).toBeTruthy();
    expect(screen.getByText("A witch on an island.")).toBeTruthy();
    // Blank lines split the synopsis into paragraphs.
    expect(screen.getByText("A house of endless halls.")).toBeTruthy();
    expect(screen.getByText("And a tide.")).toBeTruthy();
    const link = screen.getByRole("link", { name: "Piranesi on Goodreads" });
    expect(link.getAttribute("href")).toBe(piranesi.goodreadsUrl);
  });

  it("shortens long synopses until the member asks for more", async () => {
    vi.mocked(getPoll).mockResolvedValue(testPoll());
    renderPage();
    await loaded();
    // Piranesi's synopsis has two paragraphs, so it starts collapsed.
    const more = screen.getByRole("button", { name: "Read more" });
    const synopsis = document.getElementById(more.getAttribute("aria-controls") ?? "");
    expect(synopsis?.className).toContain("is-clamped");
    expect(more.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(more);
    expect(synopsis?.className).not.toContain("is-clamped");
    expect(screen.getByRole("button", { name: "Show less" }).getAttribute("aria-expanded")).toBe("true");
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
    expect(screen.getByText("2 of 2").parentElement?.textContent).toBe("2 of 2 picked");
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
    const rows = within(results).getAllByRole("listitem");
    expect(
      rows.map((li) => within(li).getByRole("heading").textContent),
    ).toEqual(["Piranesi", "Circe", "Beloved"]);
    expect(rows.map((li) => li.querySelector(".poll-result-count")?.textContent)).toEqual([
      "3 votes",
      "1 voteYour vote",
      "0 votes",
    ]);
    expect(within(rows[0]).getByText("Most votes")).toBeTruthy();
    expect(within(rows[1]).queryByText("Most votes")).toBeNull();
    expect(screen.getByText("3 members voted.")).toBeTruthy();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("says so when the poll doesn't exist", async () => {
    vi.mocked(getPoll).mockRejectedValue(new ApiError(404, "Poll not found"));
    renderPage();
    expect((await screen.findByRole("alert")).textContent).toBe("Poll not found");
  });

  describe("for admins", () => {
    beforeEach(() => mockSession(testUser({ isAdmin: true })));

    it("doesn't offer members the admin tools", async () => {
      mockSession(testUser());
      vi.mocked(getPoll).mockResolvedValue(testPoll());
      renderPage();
      await loaded();
      expect(screen.queryByRole("link", { name: "Edit poll" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Close voting now" })).toBeNull();
    });

    it("links an open poll to its edit page", async () => {
      vi.mocked(getPoll).mockResolvedValue(testPoll());
      renderPage();
      await loaded();
      expect(screen.getByRole("link", { name: "Edit poll" }).getAttribute("href")).toBe(
        `/polls/${ID}/edit`,
      );
    });

    it("offers a WhatsApp reminder with the link to vote", async () => {
      vi.mocked(getPoll).mockResolvedValue(testPoll({ theme: "Witchy reads" }));
      renderPage();
      await loaded();
      const href = screen.getByRole("link", { name: "Remind on WhatsApp" }).getAttribute("href") ?? "";
      expect(href.startsWith("https://wa.me/?text=")).toBe(true);
      const text = decodeURIComponent(href.slice("https://wa.me/?text=".length));
      const lines = text.split("\n");
      expect(lines[0]).toBe("*📚 Vote for what we read next!*");
      expect(lines[1]).toMatch(/^Voting closes /);
      expect(lines.at(-1)).toBe(`👉 ${window.location.origin}/polls/${ID}`);
    });

    it("asks before closing voting early, and can back out", async () => {
      vi.mocked(getPoll).mockResolvedValue(testPoll());
      vi.mocked(closePoll).mockResolvedValue(testPoll({ isOpen: false, results: [] }));
      renderPage();
      await loaded();

      fireEvent.click(screen.getByRole("button", { name: "Close voting now" }));
      fireEvent.click(screen.getByRole("button", { name: "Keep it open" }));
      expect(closePoll).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: "Close voting now" }));
      fireEvent.click(screen.getByRole("button", { name: "Close voting" }));
      await vi.waitFor(() => expect(vi.mocked(closePoll).mock.calls[0][0]).toBe(ID));
      expect(await screen.findByRole("list", { name: "Results" })).toBeTruthy();
    });

    describe("assigning books after the poll closes", () => {
      const closed = testPoll({
        isOpen: false,
        results: [
          { bookId: piranesi.id, votes: 2 },
          { bookId: circe.id, votes: 1 },
          { bookId: beloved.id, votes: 0 },
        ],
      });
      const decMeeting = testMeeting({
        id: "00000000-0000-4000-8000-000000000031",
        title: "December meeting",
        start: new Date("2099-12-11T19:00:00"),
        bookId: null,
      });
      const row = (title: string) =>
        screen.getByRole("heading", { name: title }).closest("li") as HTMLElement;

      it("offers the upcoming meetings that still need a book", async () => {
        vi.mocked(getPoll).mockResolvedValue(closed);
        vi.mocked(getMeetings).mockResolvedValue([testMeeting(), decMeeting]);
        vi.mocked(updateMeeting).mockResolvedValue({ ...decMeeting, bookId: piranesi.id });
        renderPage();
        await screen.findByRole("list", { name: "Results" });

        const select = await within(row("Piranesi")).findByLabelText("Meeting for Piranesi");
        // November already has a book, so only December is offered.
        expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual([
          "Fri, Dec 11 · December meeting",
        ]);
        fireEvent.click(within(row("Piranesi")).getByRole("button", { name: "Assign Piranesi" }));
        await vi.waitFor(() =>
          expect(vi.mocked(updateMeeting).mock.calls[0][0]).toEqual({
            id: decMeeting.id,
            bookId: piranesi.id,
          }),
        );
      });

      it("shows which meeting an assigned book is on, to everyone", async () => {
        mockSession(testUser());
        vi.mocked(getPoll).mockResolvedValue({
          ...closed,
          books: closed.books.map((b) =>
            b.id === piranesi.id ? { ...b, meetingId: decMeeting.id } : b,
          ),
        });
        vi.mocked(getMeetings).mockResolvedValue([{ ...decMeeting, bookId: piranesi.id }]);
        renderPage();
        await screen.findByRole("list", { name: "Results" });
        expect(
          await within(row("Piranesi")).findByText(/Chosen for Fri, Dec 11 · December meeting/),
        ).toBeTruthy();
        // Members get no assign controls.
        expect(screen.queryByRole("button", { name: /^Assign/ })).toBeNull();
      });

      it("points admins to a new meeting when none needs a book", async () => {
        vi.mocked(getPoll).mockResolvedValue(closed);
        vi.mocked(getMeetings).mockResolvedValue([testMeeting()]);
        renderPage();
        expect((await screen.findAllByText(/No upcoming meeting needs a book/)).length).toBe(3);
        expect(
          within(row("Piranesi"))
            .getByRole("link", { name: "New meeting for this book" })
            .getAttribute("href"),
        ).toBe(`/meetings/new?poll=${ID}&book=${piranesi.id}`);
      });

      it("offers to reopen voting", async () => {
        vi.mocked(getPoll).mockResolvedValue(closed);
        renderPage();
        expect(
          (await screen.findByRole("link", { name: "Reopen voting" })).getAttribute("href"),
        ).toBe(`/polls/${ID}/edit`);
      });
    });
  });
});
