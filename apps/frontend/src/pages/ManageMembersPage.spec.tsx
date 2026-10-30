import { fireEvent, screen, within } from "@testing-library/react";
import { type UserDTO } from "shared";
import {
  banUser,
  getAccounts,
  getOpenInvites,
  makeAdmin,
  removeAdmin,
  revokeInvite,
  unbanUser,
} from "../api";
import { mockSession, renderRoutes, Route, testUser } from "../test-utils";
import ManageMembersPage from "./ManageMembersPage";

vi.mock("../lib/auth-client", () => ({ authClient: { useSession: vi.fn() } }));
vi.mock("../api", () => ({
  banUser: vi.fn(),
  getAccounts: vi.fn(),
  getOpenInvites: vi.fn(),
  makeAdmin: vi.fn(),
  removeAdmin: vi.fn(),
  revokeInvite: vi.fn(),
  unbanUser: vi.fn(),
}));

const me = testUser({ isAdmin: true, firstName: "Jen" });

const account = (overrides: Partial<UserDTO>): UserDTO => ({
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

const ada = account({ id: "00000000-0000-4000-8000-000000000011", firstName: "Ada", lastName: "Lovelace" });
const grace = account({
  id: "00000000-0000-4000-8000-000000000012",
  firstName: "Grace",
  lastName: "Hopper",
  status: "BANNED",
});
const other = account({
  id: "00000000-0000-4000-8000-000000000013",
  firstName: "Otto",
  lastName: "Admin",
  isAdmin: true,
});
const self = account({ id: me.id, firstName: me.firstName, lastName: "Reader", isAdmin: true });

const invite = {
  id: "00000000-0000-4000-8000-000000000020",
  createdAt: new Date("2099-10-28T12:00:00"),
  expiresAt: new Date("2099-11-04T12:00:00"),
  usedAt: null,
  invitedBy: { firstName: "Ada", lastName: "Lovelace" },
};

const renderPage = () =>
  renderRoutes("/members/manage", <Route path="/members/manage" element={<ManageMembersPage />} />);

const section = async (name: string) =>
  screen.findByRole("region", { name }).catch(() =>
    (screen.getByRole("heading", { name }).closest("section") as HTMLElement),
  );

beforeEach(() => {
  mockSession(me);
  vi.mocked(getAccounts).mockResolvedValue([ada, grace, other, self]);
  vi.mocked(getOpenInvites).mockResolvedValue([invite]);
});

describe("ManageMembersPage", () => {
  it("offers to ban members, but not admins or yourself", async () => {
    renderPage();
    const members = await section("Members");
    await within(members).findByText("Ada Lovelace");
    expect(within(members).getByRole("button", { name: "Ban Ada Lovelace" })).toBeTruthy();
    expect(within(members).queryByRole("button", { name: /Ban Otto/ })).toBeNull();
    expect(within(members).queryByRole("button", { name: new RegExp(`Ban ${me.firstName}`) })).toBeNull();
    expect(within(members).getByText(/\(you\)/)).toBeTruthy();
  });

  it("asks before banning, and can back out", async () => {
    vi.mocked(banUser).mockResolvedValue({ ...ada, status: "BANNED" });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Ban Ada Lovelace" }));
    const confirm = screen.getByRole("group", { name: "Ban Ada Lovelace" });
    expect(within(confirm).getByText(/signed out right away/)).toBeTruthy();
    fireEvent.click(within(confirm).getByRole("button", { name: "Keep them" }));
    expect(banUser).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Ban Ada Lovelace" }));
    fireEvent.click(
      within(screen.getByRole("group", { name: "Ban Ada Lovelace" })).getByRole("button", {
        name: "Ban",
      }),
    );
    await vi.waitFor(() => expect(vi.mocked(banUser).mock.calls[0][0]).toBe(ada.id));
  });

  it("lists banned members separately, with a way to lift the ban", async () => {
    vi.mocked(unbanUser).mockResolvedValue({ ...grace, status: "ACTIVE" });
    renderPage();
    const banned = await section("Banned");
    await within(banned).findByText("Grace Hopper");
    fireEvent.click(within(banned).getByRole("button", { name: "Lift the ban on Grace Hopper" }));
    await vi.waitFor(() => expect(vi.mocked(unbanUser).mock.calls[0][0]).toBe(grace.id));
  });

  it("lists unused invite links, with who made them, and revokes one", async () => {
    vi.mocked(revokeInvite).mockResolvedValue(undefined);
    renderPage();
    expect(await screen.findByText("From Ada Lovelace")).toBeTruthy();
    expect(screen.getByText(/Made Oct 28 · expires Nov 4/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Revoke the invite made Oct 28" }));
    await vi.waitFor(() => expect(vi.mocked(revokeInvite).mock.calls[0][0]).toBe(invite.id));
  });

  it("says when there are no unused links", async () => {
    vi.mocked(getOpenInvites).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText("No unused links.")).toBeTruthy();
  });

  it("makes a member an admin, after asking", async () => {
    vi.mocked(makeAdmin).mockResolvedValue({ ...ada, isAdmin: true });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Make admin: Ada Lovelace" }));
    const confirm = screen.getByRole("group", { name: "Make admin: Ada Lovelace" });
    expect(within(confirm).getByText(/ban members and make other admins/)).toBeTruthy();
    fireEvent.click(within(confirm).getByRole("button", { name: "Make admin" }));
    await vi.waitFor(() => expect(vi.mocked(makeAdmin).mock.calls[0][0]).toBe(ada.id));
  });

  it("removes another admin, but never offers it for yourself", async () => {
    vi.mocked(removeAdmin).mockResolvedValue({ ...other, isAdmin: false });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Remove admin: Otto Admin" }));
    fireEvent.click(
      within(screen.getByRole("group", { name: "Remove admin: Otto Admin" })).getByRole("button", {
        name: "Remove admin",
      }),
    );
    await vi.waitFor(() => expect(vi.mocked(removeAdmin).mock.calls[0][0]).toBe(other.id));
    expect(screen.queryByRole("button", { name: /Remove admin: Jen/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Make admin: Jen/ })).toBeNull();
  });

  it("only offers admin to active members", async () => {
    vi.mocked(getAccounts).mockResolvedValue([
      { ...ada, status: "INACTIVE" },
      self,
    ]);
    renderPage();
    await screen.findByText("Ada Lovelace");
    expect(screen.queryByRole("button", { name: /Make admin: Ada/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Ban Ada Lovelace" })).toBeTruthy();
  });
});
