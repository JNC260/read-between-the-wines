import { sendEmail } from "./email";

// Production settings, so sendEmail is the Resend sender.
vi.mock("./config", () => ({
  isProduction: true,
  config: {
    RESEND_API_KEY: "re_test",
    EMAIL_FROM: "Read Between the Wines <hello@example.org>",
  },
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const email = {
  to: "ada@example.org",
  subject: "Verify your email",
  html: "<p>Hi</p>",
};

beforeEach(() => {
  fetchMock.mockReset();
});

describe("sendEmail in production", () => {
  it("posts the email to Resend with the API key", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: "abc" }), { status: 200 }));
    await sendEmail(email);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer re_test",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(init.body)).toEqual({
      from: "Read Between the Wines <hello@example.org>",
      to: ["ada@example.org"],
      subject: "Verify your email",
      html: "<p>Hi</p>",
    });
  });

  it("throws with Resend's reason when it refuses", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ name: "validation_error", message: "The example.org domain is not verified" }),
        { status: 403 },
      ),
    );
    await expect(sendEmail(email)).rejects.toThrow(
      /Resend refused the email \(403\).*domain is not verified/,
    );
  });

  it("throws when Resend can't be reached", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    await expect(sendEmail(email)).rejects.toThrow("fetch failed");
  });
});
