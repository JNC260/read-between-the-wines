import { fireEvent, screen } from "@testing-library/react";
import { getInvite, signUpWithInvite } from "../api";
import { renderRoutes, Route } from "../test-utils";
import InvitePage from "./InvitePage";

vi.mock("../api", () => ({ getInvite: vi.fn(), signUpWithInvite: vi.fn() }));

const renderInvite = () =>
  renderRoutes(
    "/invite/the-token",
    <Route path="/invite/:token" element={<InvitePage />} />,
  );

const validInvite = () =>
  vi.mocked(getInvite).mockResolvedValue({
    expiresAt: new Date(Date.now() + 60_000),
  });

const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const fillForm = (confirm = "correct-horse-battery") => {
  fill("Email", "invitee@example.com");
  fill("First name", "Ada");
  fill("Last name", "Lovelace");
  fill("Password", "correct-horse-battery");
  fill("Confirm password", confirm);
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
};

describe("InvitePage", () => {
  it("looks up the invite from the link's token", async () => {
    validInvite();
    renderInvite();
    await screen.findByLabelText("Email");
    expect(vi.mocked(getInvite).mock.calls[0][0]).toBe("the-token");
  });

  it("shows a friendly message for an invalid or expired invite", async () => {
    vi.mocked(getInvite).mockResolvedValue(null);
    renderInvite();
    expect(
      await screen.findByRole("heading", { name: "This invite has expired" }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Create account" })).toBeNull();
  });

  it("checks the passwords match before signing up", async () => {
    validInvite();
    renderInvite();
    await screen.findByLabelText("Email");
    fillForm("something-else");
    expect(screen.getByRole("alert").textContent).toBe(
      "Passwords don't match.",
    );
    expect(signUpWithInvite).not.toHaveBeenCalled();
  });

  it("signs up with the token and asks them to verify their email", async () => {
    validInvite();
    vi.mocked(signUpWithInvite).mockResolvedValue();
    renderInvite();
    await screen.findByLabelText("Email");
    fillForm();
    expect(
      await screen.findByRole("heading", { name: "Check your email" }),
    ).toBeTruthy();
    expect(screen.getByText(/sent a link to invitee@example.com/)).toBeTruthy();
    expect(vi.mocked(signUpWithInvite).mock.calls[0][0]).toEqual({
      token: "the-token",
      email: "invitee@example.com",
      password: "correct-horse-battery",
      firstName: "Ada",
      lastName: "Lovelace",
    });
  });

  it("shows the server's error if sign-up fails", async () => {
    validInvite();
    vi.mocked(signUpWithInvite).mockRejectedValue(
      new Error("This invite link is invalid or has expired"),
    );
    renderInvite();
    await screen.findByLabelText("Email");
    fillForm();
    expect((await screen.findByRole("alert")).textContent).toBe(
      "This invite link is invalid or has expired",
    );
  });
});
