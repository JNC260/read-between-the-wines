import { fireEvent, screen } from "@testing-library/react";
import { getBookSuggestions, getPoll, updatePoll } from "../api";
import { testPoll, testSuggestedBook } from "../test/fixtures";
import { renderRoutes, Route } from "../test-utils";
import EditPollPage from "./EditPollPage";

vi.mock("../api", async (importOriginal) => ({
  ApiError: (await importOriginal<typeof import("../api")>()).ApiError,
  getBookSuggestions: vi.fn(),
  getPoll: vi.fn(),
  updatePoll: vi.fn(),
}));

const ID = testPoll().id;

// Suggestions that aren't on the ballot yet.
const rebecca = testSuggestedBook({ id: "00000000-0000-4000-8000-000000000301", title: "Rebecca" });
const dune = testSuggestedBook({ id: "00000000-0000-4000-8000-000000000302", title: "Dune" });
const emma = testSuggestedBook({ id: "00000000-0000-4000-8000-000000000303", title: "Emma" });
const sula = testSuggestedBook({ id: "00000000-0000-4000-8000-000000000304", title: "Sula" });

const renderPage = () =>
  renderRoutes(
    `/polls/${ID}/edit`,
    <>
      <Route path="/polls/:id/edit" element={<EditPollPage />} />
      <Route path="/polls/:id" element="poll page" />
    </>,
  );

const searchFor = (text: string) =>
  fireEvent.change(screen.getByLabelText("Search suggestions"), { target: { value: text } });

const addBox = (title: string) =>
  screen.getByRole("checkbox", { name: new RegExp(`^${title} by`) }) as HTMLInputElement;

beforeEach(() => {
  vi.mocked(getBookSuggestions).mockResolvedValue([rebecca, dune, emma, sula]);
});

describe("EditPollPage", () => {
  it("starts from the poll and saves the changes, then goes back to it", async () => {
    vi.mocked(getPoll).mockResolvedValue(testPoll({ theme: "Witchy reads" }));
    vi.mocked(updatePoll).mockResolvedValue(testPoll());
    renderPage();

    expect(await screen.findByRole("heading", { name: "Edit poll" })).toBeTruthy();
    expect((screen.getByLabelText("Theme (optional)") as HTMLInputElement).value).toBe(
      "Witchy reads",
    );
    fireEvent.change(screen.getByLabelText("Theme (optional)"), { target: { value: " " } });
    fireEvent.change(screen.getByLabelText("Votes per member"), { target: { value: "3" } });
    await screen.findByLabelText("Search suggestions");
    searchFor("rebec");
    fireEvent.click(addBox("Rebecca"));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("poll page")).toBeTruthy();
    const sent = vi.mocked(updatePoll).mock.calls[0][0];
    expect(sent).toMatchObject({
      id: ID,
      theme: null,
      votesPerMember: 3,
      addBookIds: [rebecca.id],
    });
    expect(sent.closesAt).toEqual(new Date(testPoll().closesAt.setSeconds(0, 0)));
  });

  it("finds suggestions by search, leaving out books already on the ballot", async () => {
    vi.mocked(getPoll).mockResolvedValue(testPoll());
    renderPage();
    await screen.findByLabelText("Search suggestions");
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    searchFor("e");
    expect(screen.getAllByRole("checkbox").map((b) => b.closest("label")?.textContent)).toEqual(
      expect.arrayContaining([expect.stringMatching(/^Rebecca/), expect.stringMatching(/^Dune/)]),
    );
    searchFor("circe");
    expect(screen.getByText("No suggestions match that.")).toBeTruthy();
  });

  it("only offers suggestions that aren't on the ballot, up to six books", async () => {
    vi.mocked(getPoll).mockResolvedValue(testPoll());
    renderPage();
    await screen.findByLabelText("Search suggestions");
    // Three on the ballot, so three more fit.
    for (const title of ["Rebecca", "Dune", "Emma"]) {
      searchFor(title);
      fireEvent.click(addBox(title));
    }
    searchFor("Sula");
    expect(addBox("Sula").disabled).toBe(true);
    // Ticked books stay in view while searching for others.
    expect(addBox("Rebecca").checked).toBe(true);
    expect(screen.getByText(/The ballot is full/)).toBeTruthy();
  });

  it("reopens a closed poll", async () => {
    vi.mocked(getPoll).mockResolvedValue(testPoll({ isOpen: false, results: [] }));
    renderPage();
    expect(await screen.findByRole("heading", { name: "Reopen voting" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reopen voting" })).toBeTruthy();
  });

  it("shows the server's error and stays on the page", async () => {
    vi.mocked(getPoll).mockResolvedValue(testPoll());
    vi.mocked(updatePoll).mockRejectedValue(
      new Error("A member has already used 2 votes, so each member needs at least 2."),
    );
    renderPage();
    fireEvent.change(await screen.findByLabelText("Votes per member"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/already used 2 votes/);
  });
});
