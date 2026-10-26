import { fireEvent, screen, within } from "@testing-library/react";
import { useParams } from "react-router-dom";
import { createPoll, getBookSuggestions } from "../api";
import { toLocalInput } from "../lib/datetime-local";
import { beloved, circe, piranesi, testPoll, testSuggestedBook } from "../test/fixtures";
import { renderRoutes, Route } from "../test-utils";
import NewPollPage from "./NewPollPage";

vi.mock("../api", () => ({ createPoll: vi.fn(), getBookSuggestions: vi.fn() }));

const suggestions = [circe, piranesi, beloved].map(({ id, title, author }) =>
  testSuggestedBook({ id, title, author }),
);

const PollStub = () => <p>poll {useParams().id}</p>;

const renderPage = (ids: string[]) =>
  renderRoutes(
    `/polls/new?books=${ids.join(",")}`,
    <>
      <Route path="/polls/new" element={<NewPollPage />} />
      <Route path="/polls/:id" element={<PollStub />} />
    </>,
  );

const valueOf = (label: string) =>
  (screen.getByLabelText(label) as HTMLInputElement).value;

const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const ballotTitles = async () => {
  const list = await screen.findByRole("list", { name: "Books on the ballot" });
  return within(list)
    .getAllByRole("listitem")
    .map((li) => li.querySelector("strong")?.textContent);
};

const submit = () =>
  fireEvent.click(screen.getByRole("button", { name: "Create poll" }));

describe("NewPollPage", () => {
  beforeEach(() => {
    vi.mocked(getBookSuggestions).mockResolvedValue(suggestions);
  });

  it("lists the selected books in the order they were picked", async () => {
    renderPage([beloved.id, circe.id]);
    expect(await ballotTitles()).toEqual(["Beloved", "Circe"]);
  });

  it("drops ids that aren't suggestions any more", async () => {
    renderPage([circe.id, "00000000-0000-4000-8000-000000000999", piranesi.id]);
    expect(await ballotTitles()).toEqual(["Circe", "Piranesi"]);
  });

  it("asks for more books when fewer than two are left", async () => {
    renderPage([circe.id]);
    expect(await screen.findByText(/Pick at least 2 books/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Create poll" })).toBeNull();
  });

  it("defaults to closing in a week with two votes each", async () => {
    renderPage([circe.id, piranesi.id, beloved.id]);
    await ballotTitles();
    const inAWeek = toLocalInput(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    // Same day; the minutes can tick over between render and here.
    expect(valueOf("Voting closes").slice(0, 10)).toBe(inAWeek.slice(0, 10));
    expect(valueOf("Votes per member")).toBe("2");
  });

  it("defaults to one vote for a two-book poll", async () => {
    renderPage([circe.id, piranesi.id]);
    await ballotTitles();
    expect(valueOf("Votes per member")).toBe("1");
  });

  it("creates the poll and opens it", async () => {
    vi.mocked(createPoll).mockResolvedValue(testPoll({ id: "00000000-0000-4000-8000-000000000077" }));
    renderPage([circe.id, piranesi.id, beloved.id]);
    await ballotTitles();
    fill("Voting closes", "2099-11-08T19:00");
    fill("Votes per member", "1");
    fill("Theme (optional)", "  Witchy reads ");
    submit();
    expect(await screen.findByText("poll 00000000-0000-4000-8000-000000000077")).toBeTruthy();
    expect(vi.mocked(createPoll).mock.calls[0][0]).toEqual({
      bookIds: [circe.id, piranesi.id, beloved.id],
      closesAt: new Date("2099-11-08T19:00"),
      votesPerMember: 1,
      theme: "Witchy reads",
    });
  });

  it("sends no theme when it's left blank", async () => {
    vi.mocked(createPoll).mockResolvedValue(testPoll());
    renderPage([circe.id, piranesi.id]);
    await ballotTitles();
    submit();
    await screen.findByText(/^poll /);
    expect(vi.mocked(createPoll).mock.calls[0][0].theme).toBeNull();
  });

  // The browser enforces min/max itself, before the schema check runs.
  it("allows one fewer vote than there are books", async () => {
    renderPage([circe.id, piranesi.id, beloved.id]);
    await ballotTitles();
    const input = screen.getByLabelText("Votes per member") as HTMLInputElement;
    expect(input.min).toBe("1");
    expect(input.max).toBe("2");
    fill("Votes per member", "3");
    submit();
    expect(createPoll).not.toHaveBeenCalled();
  });

  it("shows the server's error, like another poll being open", async () => {
    vi.mocked(createPoll).mockRejectedValue(new Error("A poll is already open"));
    renderPage([circe.id, piranesi.id]);
    await ballotTitles();
    submit();
    expect((await screen.findByRole("alert")).textContent).toBe(
      "A poll is already open",
    );
  });
});
