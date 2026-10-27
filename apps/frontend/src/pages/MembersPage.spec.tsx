import { screen, within } from "@testing-library/react";
import { type UserDTO } from "shared";
import { getUsersList } from "../api";
import { mockSession, renderRoutes, Route, testUser } from "../test-utils";
import MembersPage from "./MembersPage";

vi.mock("../lib/auth-client", () => ({ authClient: { useSession: vi.fn() } }));
vi.mock("../api", () => ({ getUsersList: vi.fn() }));

const me = testUser();

const member = (overrides: Partial<UserDTO>): UserDTO => ({
  id: "00000000-0000-4000-8000-000000000010",
  email: "member@example.com",
  name: "",
  firstName: "Member",
  lastName: "Reader",
  image: null,
  phone: null,
  facebookUrl: null,
  goodreadsUrl: null,
  instagram: null,
  tiktok: null,
  x: null,
  venmo: null,
  status: "ACTIVE",
  createdAt: new Date("2026-10-01T00:00:00Z"),
  updatedAt: new Date("2026-10-01T00:00:00Z"),
  ...overrides,
});

const ada = member({
  id: me.id,
  email: me.email,
  firstName: "Ada",
  lastName: "Lovelace",
});

const grace = member({
  id: "00000000-0000-4000-8000-000000000011",
  email: "grace@example.com",
  firstName: "Grace",
  lastName: "Hopper",
  phone: "+15551234567",
  facebookUrl: "https://www.facebook.com/grace",
  goodreadsUrl: "https://www.goodreads.com/user/show/1-grace",
  instagram: "grace",
  tiktok: "gracet",
  x: "gracex",
  venmo: "grace-h",
});

const renderPage = () =>
  renderRoutes("/members", <Route path="/members" element={<MembersPage />} />);

const card = (name: RegExp) =>
  screen.getByRole("article", { name });

const headings = () =>
  screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);

describe("MembersPage", () => {
  beforeEach(() => mockSession(me));

  // The API filters and sorts; the page keeps its order.
  it("lists members in the order the API sends them", async () => {
    vi.mocked(getUsersList).mockResolvedValue([ada, grace]);
    renderPage();
    await screen.findByRole("heading", { name: "Members" });
    expect(headings()).toEqual(["Ada Lovelace (you)", "Grace Hopper"]);
  });

  it("links each contact detail a member added", async () => {
    vi.mocked(getUsersList).mockResolvedValue([ada, grace]);
    renderPage();
    await screen.findByRole("heading", { name: "Members" });
    const links = within(card(/Grace/)).getAllByRole("link");
    expect(
      links.map((a) => [a.textContent, a.getAttribute("href")]),
    ).toEqual([
      ["grace@example.com", "mailto:grace@example.com"],
      ["(555) 123-4567", "tel:+15551234567"],
      ["@grace", "https://www.instagram.com/grace"],
      ["@gracet", "https://www.tiktok.com/@gracet"],
      ["@gracex", "https://x.com/gracex"],
      ["@grace-h", "https://venmo.com/u/grace-h"],
      ["Facebook", "https://www.facebook.com/grace"],
      ["Goodreads", "https://www.goodreads.com/user/show/1-grace"],
    ]);
  });

  it("leaves out fields a member hasn't added", async () => {
    vi.mocked(getUsersList).mockResolvedValue([ada, grace]);
    renderPage();
    await screen.findByRole("heading", { name: "Members" });
    const list = within(card(/Ada/)).getByRole("list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(within(list).queryByText(/Phone/)).toBeNull();
  });

  it("links only the signed-in member to the profile page", async () => {
    vi.mocked(getUsersList).mockResolvedValue([ada, grace]);
    renderPage();
    await screen.findByRole("heading", { name: "Members" });
    expect(
      within(card(/Ada/)).getByRole("link", { name: "Edit your profile" }),
    ).toBeTruthy();
    expect(
      within(card(/Grace/)).queryByRole("link", { name: "Edit your profile" }),
    ).toBeNull();
  });

  it("shows a photo when there is one, and initials when there isn't", async () => {
    vi.mocked(getUsersList).mockResolvedValue([
      ada,
      { ...grace, image: "https://example.com/grace.jpg" },
    ]);
    const { container } = renderPage();
    await screen.findByRole("heading", { name: "Members" });
    expect(within(card(/Ada/)).getByText("AL")).toBeTruthy();
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "https://example.com/grace.jpg",
    );
  });

  it("shows the error if the list fails to load", async () => {
    vi.mocked(getUsersList).mockRejectedValue(new Error("Failed to fetch user list"));
    renderPage();
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Failed to fetch user list",
    );
  });
});
