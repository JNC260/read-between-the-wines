import { fireEvent, screen, within } from "@testing-library/react";
import { type UserDTO } from "shared";
import {
  getEmailSettings,
  getUsersList,
  updateEmailSettings,
  updateProfile,
} from "../api";
import { mockSession, renderRoutes, Route, testUser } from "../test-utils";
import ProfilePage from "./ProfilePage";

vi.mock("../lib/auth-client", () => ({ authClient: { useSession: vi.fn() } }));
vi.mock("../api", () => ({
  getEmailSettings: vi.fn(),
  updateEmailSettings: vi.fn(),
  getUsersList: vi.fn(),
  updateProfile: vi.fn(),
  uploadProfileImage: vi.fn(),
  removeProfileImage: vi.fn(),
}));

const me = testUser();

const ada: UserDTO = {
  id: me.id,
  email: me.email,
  name: "Ada Reader",
  firstName: "Ada",
  lastName: "Reader",
  image: null,
  phone: "+15551234567",
  facebookUrl: null,
  goodreadsUrl: null,
  instagram: "ada",
  tiktok: null,
  x: null,
  venmo: null,
  memberSince: null,
  status: "ACTIVE",
  isAdmin: false,
  createdAt: new Date("2026-10-01T00:00:00Z"),
  updatedAt: new Date("2026-10-01T00:00:00Z"),
};

const grace: UserDTO = {
  ...ada,
  id: "00000000-0000-4000-8000-000000000009",
  email: "grace@example.com",
  firstName: "Grace",
};

const renderPage = () =>
  renderRoutes("/profile", <Route path="/profile" element={<ProfilePage />} />);

const valueOf = (label: string) =>
  (screen.getByLabelText(label) as HTMLInputElement).value;

const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const save = () =>
  fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

const loaded = async () => {
  renderPage();
  await screen.findByRole("heading", { name: "My profile" });
};

beforeEach(() => {
  vi.mocked(getEmailSettings).mockResolvedValue({ emailOptOuts: ["NEW_POLL"] });
  vi.mocked(updateEmailSettings).mockImplementation(async (body) => body);
  vi.mocked(getUsersList).mockResolvedValue([grace, ada]);
  vi.mocked(updateProfile).mockImplementation(async (body) => ({
    ...ada,
    ...body,
  }) as UserDTO);
});

describe("ProfilePage", () => {
  it("fills the form from the signed-in member's profile", async () => {
    mockSession(me);
    await loaded();
    expect(valueOf("First name")).toBe("Ada");
    expect(valueOf("Last name")).toBe("Reader");
    expect(valueOf("Phone")).toBe("(555) 123-4567");
    expect(valueOf("Instagram")).toBe("ada");
    expect(valueOf("Venmo")).toBe("");
  });

  it("shows the email but won't let them change it", async () => {
    mockSession(me);
    await loaded();
    const email = screen.getByLabelText("Email") as HTMLInputElement;
    expect(email.value).toBe("reader@example.com");
    expect(email.disabled).toBe(true);
    expect(screen.getByText(/can't be changed here yet/)).toBeTruthy();
  });

  it("formats the phone number as it's typed", async () => {
    mockSession(me);
    await loaded();
    fill("Phone", "555123");
    expect(valueOf("Phone")).toBe("(555) 123");
    fill("Phone", "5551239876");
    expect(valueOf("Phone")).toBe("(555) 123-9876");
  });

  it("saves every field, clearing emptied ones, and refreshes the session", async () => {
    const refetch = mockSession(me);
    await loaded();
    fill("First name", "Augusta");
    fill("Instagram", "");
    fill("Venmo", "https://venmo.com/u/augusta");
    fill("Goodreads", "goodreads.com/user/show/1-augusta");
    save();

    expect(await screen.findByRole("status")).toBeTruthy();
    expect(vi.mocked(updateProfile).mock.calls[0][0]).toEqual({
      firstName: "Augusta",
      lastName: "Reader",
      phone: "+15551234567",
      facebookUrl: null,
      goodreadsUrl: "https://goodreads.com/user/show/1-augusta",
      instagram: null,
      tiktok: null,
      x: null,
      venmo: "augusta",
      memberSince: null,
    });
    expect(refetch).toHaveBeenCalled();
  });

  it("saves the year they joined as a number", async () => {
    mockSession(me);
    await loaded();
    fill("Member since", "2019");
    save();
    await screen.findByRole("status");
    expect(vi.mocked(updateProfile).mock.calls[0][0].memberSince).toBe(2019);
  });

  it.each([
    ["a typo", "20l9", "Enter a year, like 2019"],
    ["a future year", String(new Date().getFullYear() + 1), "That year hasn't happened yet"],
  ])("rejects %s in member since", async (_, value, message) => {
    mockSession(me);
    await loaded();
    fill("Member since", value);
    save();
    expect(screen.getByText(message)).toBeTruthy();
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it("shows a message next to each bad field and doesn't save", async () => {
    mockSession(me);
    await loaded();
    fill("Last name", " ");
    fill("Phone", "555");
    fill("Facebook", "https://instagram.com/ada");
    save();

    expect(screen.getByLabelText("Last name").getAttribute("aria-invalid")).toBe(
      "true",
    );
    expect(screen.getByText("Enter a 10-digit US phone number")).toBeTruthy();
    expect(screen.getByText("Enter a link to your Facebook profile")).toBeTruthy();
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it("shows the error if saving fails", async () => {
    mockSession(me);
    vi.mocked(updateProfile).mockRejectedValue(
      new Error("Failed to save your profile"),
    );
    await loaded();
    save();
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Failed to save your profile",
    );
  });

  describe("email settings", () => {
    const settings = async () =>
      within(await screen.findByRole("region", { name: "Email me when" }));
    const box = (scope: ReturnType<typeof within>, name: RegExp) =>
      scope.getByRole("checkbox", { name }) as HTMLInputElement;

    it("shows which emails are on", async () => {
      mockSession(testUser({ id: ada.id }));
      renderPage();
      const scope = await settings();
      await scope.findByRole("checkbox", { name: /new book poll/ });
      expect(box(scope, /new book poll/).checked).toBe(false);
      expect(box(scope, /poll closes/).checked).toBe(true);
    });

    it("saves each change straight away, as the whole list", async () => {
      mockSession(testUser({ id: ada.id }));
      renderPage();
      const scope = await settings();
      fireEvent.click(await scope.findByRole("checkbox", { name: /poll closes/ }));
      await vi.waitFor(() =>
        expect(vi.mocked(updateEmailSettings).mock.calls[0][0]).toEqual({
          emailOptOuts: ["NEW_POLL", "VOTE_REMINDER"],
        }),
      );
      expect(await scope.findByText("Saved.")).toBeTruthy();
      fireEvent.click(box(scope, /new book poll/));
      await vi.waitFor(() =>
        expect(vi.mocked(updateEmailSettings).mock.calls[1][0]).toEqual({
          emailOptOuts: ["VOTE_REMINDER"],
        }),
      );
    });
  });
});
