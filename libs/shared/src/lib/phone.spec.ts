import { formatPhone, normalizePhone } from "./phone";

describe("normalizePhone", () => {
  it.each([
    "5551234567",
    "(555) 123-4567",
    "555.123.4567",
    "555-123-4567",
    "+1 555 123 4567",
    "1-555-123-4567",
    " (555) 123-4567 ",
  ])("normalizes %s", (input) => {
    expect(normalizePhone(input)).toBe("+15551234567");
  });

  it.each(["", "555", "555123456", "25551234567", "555123456789", "call me"])(
    "rejects %s",
    (input) => {
      expect(normalizePhone(input)).toBeNull();
    },
  );

  it("leaves a stored number as it is", () => {
    expect(normalizePhone("+15551234567")).toBe("+15551234567");
  });
});

describe("formatPhone", () => {
  it.each([
    ["", ""],
    ["5", "5"],
    ["555", "555"],
    ["5551", "(555) 1"],
    ["555123", "(555) 123"],
    ["5551234", "(555) 123-4"],
    ["5551234567", "(555) 123-4567"],
    ["(555) 123-4567", "(555) 123-4567"],
    ["555123456789", "(555) 123-4567"],
    ["+15551234567", "(555) 123-4567"],
    ["15551234567", "(555) 123-4567"],
  ])("formats %s as %s", (input, expected) => {
    expect(formatPhone(input)).toBe(expected);
  });
});
