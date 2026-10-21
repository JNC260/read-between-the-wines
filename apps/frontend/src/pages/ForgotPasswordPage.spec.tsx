import { fireEvent, screen } from "@testing-library/react";
import { requestPasswordReset } from "../api";
import { renderRoutes, Route } from "../test-utils";
import ForgotPasswordPage from "./ForgotPasswordPage";

vi.mock("../api", () => ({ requestPasswordReset: vi.fn() }));

describe("ForgotPasswordPage", () => {
  it("requests a reset and shows the same message for any email", async () => {
    vi.mocked(requestPasswordReset).mockResolvedValue();
    renderRoutes(
      "/forgot-password",
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />,
    );
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "reader@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(
      await screen.findByText(/If that email has an account, we've sent a link/),
    ).toBeTruthy();
    expect(vi.mocked(requestPasswordReset).mock.calls[0][0]).toBe(
      "reader@example.com",
    );
  });
});
