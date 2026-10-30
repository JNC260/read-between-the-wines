import { fireEvent, screen, within } from "@testing-library/react";
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
  memberSince: null,
  status: "ACTIVE",
  isAdmin: false,
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

const card = (name: RegExp) => screen.getByRole("article", { name });

const loaded = async (members: UserDTO[] = [ada, grace]) => {
  vi.mocked(getUsersList).mockResolvedValue(members);
  const result = renderPage();
  await screen.findByRole("heading", { name: "Members" });
  return result;
};

const openDetails = (name: string) => {
  fireEvent.click(screen.getByRole("button", { name }));
  return screen.getByRole("dialog");
};

const hrefs = (links: HTMLElement[]) =>
  links.map((a) => [a.getAttribute("aria-label") ?? a.textContent, a.getAttribute("href")]);

describe("MembersPage", () => {
  beforeEach(() => mockSession(me));

  // The API filters and sorts; the page keeps its order.
  it("lists members in the order the API sends them, marking the signed-in one", async () => {
    await loaded();
    const names = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent);
    expect(names).toEqual(["Ada LovelaceYou", "Grace Hopper"]);
  });

  it("puts an icon link on the card for each social a member added, except Venmo", async () => {
    await loaded();
    expect(hrefs(within(card(/Grace/)).getAllByRole("link"))).toEqual([
      ["Grace on Instagram", "https://www.instagram.com/grace"],
      ["Grace on TikTok", "https://www.tiktok.com/@gracet"],
      ["Grace on X", "https://x.com/gracex"],
      ["Grace on Facebook", "https://www.facebook.com/grace"],
      ["Grace on Goodreads", "https://www.goodreads.com/user/show/1-grace"],
    ]);
  });

  it("leaves Venmo off the card, since it has a Pay button in the details", async () => {
    await loaded([ada, { ...grace, instagram: null, tiktok: null, x: null, facebookUrl: null, goodreadsUrl: null }]);
    expect(within(card(/Grace/)).queryByRole("list")).toBeNull();
  });

  it("shows nothing in place of socials for a member with none", async () => {
    await loaded();
    expect(within(card(/Ada/)).queryByRole("list")).toBeNull();
  });

  it("shows member since only once it's set", async () => {
    await loaded([ada, { ...grace, memberSince: 2019 }]);
    expect(within(card(/Grace/)).getByText("Member since 2019")).toBeTruthy();
    expect(within(card(/Ada/)).queryByText(/Member since/)).toBeNull();
  });

  it("opens a member's contact details, with quick actions and Venmo", async () => {
    await loaded();
    const details = openDetails("Grace Hopper");
    expect(within(details).getByRole("heading", { name: "Grace Hopper" })).toBeTruthy();
    expect(within(details).getByText("(555) 123-4567")).toBeTruthy();
    expect(within(details).getByText("grace@example.com")).toBeTruthy();
    const link = (name: string | RegExp) =>
      within(details).getByRole("link", { name }).getAttribute("href");
    expect(link("Text")).toBe("sms:+15551234567");
    expect(link("Call")).toBe("tel:+15551234567");
    expect(link("Email")).toBe("mailto:grace@example.com");
    expect(link("Pay Grace on Venmo")).toBe("https://venmo.com/u/grace-h");
    expect(link(/Instagram/)).toBe("https://www.instagram.com/grace");
    expect(within(details).queryByRole("link", { name: "Edit your profile" })).toBeNull();
  });

  it("leaves out text, call and Venmo when a member hasn't added them", async () => {
    await loaded();
    const details = openDetails("Ada Lovelace");
    expect(within(details).queryByRole("link", { name: "Text" })).toBeNull();
    expect(within(details).queryByRole("link", { name: /Venmo/ })).toBeNull();
    expect(within(details).queryByText("Phone")).toBeNull();
    expect(within(details).getByRole("link", { name: "Email" })).toBeTruthy();
  });

  it("links the signed-in member's own details to the profile page", async () => {
    await loaded();
    const details = openDetails("Ada Lovelace");
    expect(
      within(details).getByRole("link", { name: "Edit your profile" }).getAttribute("href"),
    ).toBe("/profile");
  });

  it("closes the details with the close button or Escape", async () => {
    await loaded();
    openDetails("Grace Hopper");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    openDetails("Grace Hopper");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows a photo when there is one, and initials when there isn't", async () => {
    const { container } = await loaded([
      ada,
      { ...grace, image: "https://example.com/grace.jpg" },
    ]);
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
