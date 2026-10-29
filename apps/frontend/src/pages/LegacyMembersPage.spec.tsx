import { fireEvent, screen, within } from "@testing-library/react";
import { type PlaceholderDTO, type UserDTO } from "shared";
import { getPlaceholders, getUsersList, mergePlaceholder } from "../api";
import { renderRoutes, Route } from "../test-utils";
import LegacyMembersPage from "./LegacyMembersPage";

vi.mock("../api", () => ({
  getPlaceholders: vi.fn(),
  getUsersList: vi.fn(),
  mergePlaceholder: vi.fn(),
}));

const member = (id: string, firstName: string, lastName: string): UserDTO => ({
  id,
  email: `${firstName.toLowerCase()}@example.com`,
  name: `${firstName} ${lastName}`,
  firstName,
  lastName,
  image: null,
  phone: null,
  facebookUrl: null,
  goodreadsUrl: null,
  instagram: null,
  tiktok: null,
  x: null,
  venmo: null,
  memberSince: null,
  status: "ACTIVE",
  createdAt: new Date("2026-10-01T00:00:00Z"),
  updatedAt: new Date("2026-10-01T00:00:00Z"),
});

const haylie = member("00000000-0000-4000-8000-000000000011", "Haylie", "Reader");
const beth = member("00000000-0000-4000-8000-000000000012", "Beth", "Jones");

const legacyHaylie: PlaceholderDTO = {
  id: "00000000-0000-4000-8000-000000000021",
  firstName: "Haylie",
  lastName: "Reader",
  suggestionCount: 5,
};
const legacyBetty: PlaceholderDTO = {
  id: "00000000-0000-4000-8000-000000000022",
  firstName: "Betty",
  lastName: "Smith",
  suggestionCount: 1,
};

const renderPage = async (placeholders = [legacyHaylie, legacyBetty]) => {
  vi.mocked(getPlaceholders).mockResolvedValue(placeholders);
  vi.mocked(getUsersList).mockResolvedValue([beth, haylie]);
  renderRoutes(
    "/members/legacy",
    <Route path="/members/legacy" element={<LegacyMembersPage />} />,
  );
  await screen.findByRole("heading", { name: "Legacy members" });
};

const row = (name: string) =>
  screen.getByRole("heading", { name }).closest("li") as HTMLElement;

describe("LegacyMembersPage", () => {
  it("lists placeholders with their suggestion counts", async () => {
    await renderPage();
    expect(within(row("Haylie Reader")).getByText("5 legacy suggestions")).toBeTruthy();
    expect(within(row("Betty Smith")).getByText("1 legacy suggestion")).toBeTruthy();
  });

  it("picks the member with the same name, and nobody otherwise", async () => {
    await renderPage();
    const pick = (name: string) =>
      (within(row(name)).getByLabelText("This is") as HTMLSelectElement).value;
    expect(pick("Haylie Reader")).toBe(haylie.id);
    expect(pick("Betty Smith")).toBe("");
    expect(
      (within(row("Betty Smith")).getByRole("button", { name: "Merge…" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("asks before merging, then reports what moved", async () => {
    vi.mocked(mergePlaceholder).mockResolvedValue({
      suggestions: 5,
      ratings: 0,
      rsvps: 0,
      votes: 0,
    });
    await renderPage();
    const haylieRow = within(row("Haylie Reader"));
    fireEvent.click(haylieRow.getByRole("button", { name: "Merge…" }));
    expect(mergePlaceholder).not.toHaveBeenCalled();
    expect(haylieRow.getByText(/can't be undone/)).toBeTruthy();

    fireEvent.click(haylieRow.getByRole("button", { name: "Merge into Haylie Reader" }));
    expect((await screen.findByRole("status")).textContent).toBe(
      "Gave Haylie Reader's 5 suggestions to Haylie Reader.",
    );
    expect(vi.mocked(mergePlaceholder).mock.calls[0][0]).toEqual({
      placeholderId: legacyHaylie.id,
      memberId: haylie.id,
    });
  });

  it("merges into whoever the admin picks", async () => {
    vi.mocked(mergePlaceholder).mockResolvedValue({
      suggestions: 1,
      ratings: 0,
      rsvps: 0,
      votes: 0,
    });
    await renderPage();
    const bettyRow = within(row("Betty Smith"));
    fireEvent.change(bettyRow.getByLabelText("This is"), {
      target: { value: beth.id },
    });
    fireEvent.click(bettyRow.getByRole("button", { name: "Merge…" }));
    fireEvent.click(bettyRow.getByRole("button", { name: "Merge into Beth Jones" }));
    expect((await screen.findByRole("status")).textContent).toBe(
      "Gave Betty Smith's 1 suggestion to Beth Jones.",
    );
  });

  it("can back out of a merge", async () => {
    await renderPage();
    const haylieRow = within(row("Haylie Reader"));
    fireEvent.click(haylieRow.getByRole("button", { name: "Merge…" }));
    fireEvent.click(haylieRow.getByRole("button", { name: "Cancel" }));
    expect(haylieRow.queryByText(/can't be undone/)).toBeNull();
    expect(mergePlaceholder).not.toHaveBeenCalled();
  });

  it("shows the server's error", async () => {
    vi.mocked(mergePlaceholder).mockRejectedValue(new Error("Member not found"));
    await renderPage();
    const haylieRow = within(row("Haylie Reader"));
    fireEvent.click(haylieRow.getByRole("button", { name: "Merge…" }));
    fireEvent.click(haylieRow.getByRole("button", { name: "Merge into Haylie Reader" }));
    expect((await haylieRow.findByRole("alert")).textContent).toBe("Member not found");
  });

  it("says when everyone has been matched", async () => {
    await renderPage([]);
    expect(screen.getByText("Everyone has been matched.")).toBeTruthy();
  });
});
