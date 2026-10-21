import { fireEvent, screen } from "@testing-library/react";
import { createInvite } from "../api";
import { renderRoutes, Route } from "../test-utils";
import InviteMemberPage from "./InviteMemberPage";

vi.mock("../api", () => ({ createInvite: vi.fn() }));

const INVITE_URL = "https://example.com/invite/the-token";

const renderPage = () =>
  renderRoutes(
    "/invite-member",
    <Route path="/invite-member" element={<InviteMemberPage />} />,
  );

const createLink = async () => {
  vi.mocked(createInvite).mockResolvedValue({
    id: "00000000-0000-4000-8000-000000000002",
    expiresAt: new Date(),
    usedAt: null,
    createdAt: new Date(),
    url: INVITE_URL,
  });
  renderPage();
  fireEvent.click(screen.getByRole("button", { name: "Create invite link" }));
  await screen.findByRole("heading", { name: "Your invite link" });
};

// jsdom has neither navigator.share nor navigator.clipboard, so each test
// defines the ones it needs.
const stubNavigator = (props: Partial<Navigator>) => {
  for (const [key, value] of Object.entries(props)) {
    Object.defineProperty(navigator, key, { value, configurable: true });
  }
};

describe("InviteMemberPage", () => {
  afterEach(() => {
    stubNavigator({ share: undefined, clipboard: undefined } as never);
  });

  it("creates an invite and shows the link", async () => {
    await createLink();
    expect(createInvite).toHaveBeenCalledOnce();
    expect(
      (screen.getByLabelText("Invite link") as HTMLInputElement).value,
    ).toBe(INVITE_URL);
  });

  it("shows the server's error if it fails", async () => {
    vi.mocked(createInvite).mockRejectedValue(
      new Error("Failed to create invite"),
    );
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Create invite link" }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Failed to create invite",
    );
  });

  it("uses the native share sheet when there is one", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn();
    stubNavigator({ share, clipboard: { writeText } as never });
    await createLink();
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await vi.waitFor(() => expect(share).toHaveBeenCalled());
    expect(share.mock.calls[0][0].url).toBe(INVITE_URL);
    expect(writeText).not.toHaveBeenCalled();
  });

  it("does nothing if the share sheet is closed", async () => {
    const share = vi
      .fn()
      .mockRejectedValue(new DOMException("Cancelled", "AbortError"));
    const writeText = vi.fn();
    stubNavigator({ share, clipboard: { writeText } as never });
    await createLink();
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await vi.waitFor(() => expect(share).toHaveBeenCalled());
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("copies the link when sharing isn't available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubNavigator({ clipboard: { writeText } as never });
    await createLink();
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    expect(
      await screen.findByRole("button", { name: "Copied!" }),
    ).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith(INVITE_URL);
  });

  it("goes back to make another link", async () => {
    await createLink();
    fireEvent.click(
      screen.getByRole("button", { name: "Invite someone else" }),
    );
    expect(
      await screen.findByRole("button", { name: "Create invite link" }),
    ).toBeTruthy();
  });
});
