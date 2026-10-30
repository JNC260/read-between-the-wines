import { AVATAR_COLORS, avatarColor } from "./avatar-color";

describe("avatarColor", () => {
  it("gives the same member the same color every time", () => {
    const id = "441562e1-8d6a-4243-9920-816e8068ab66";
    expect(avatarColor(id)).toBe(avatarColor(id));
  });

  it("spreads members across all the colors", () => {
    const ids = Array.from({ length: 200 }, () => crypto.randomUUID());
    const used = new Set(ids.map(avatarColor));
    expect(used.size).toBe(AVATAR_COLORS);
    for (const color of used) {
      expect(color).toBeGreaterThanOrEqual(0);
      expect(color).toBeLessThan(AVATAR_COLORS);
    }
  });
});
