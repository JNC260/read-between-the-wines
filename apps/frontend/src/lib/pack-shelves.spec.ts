import { packShelves } from "./pack-shelves";

const width = (n: number) => n;

describe("packShelves", () => {
  it("keeps everything on one shelf when it fits", () => {
    expect(packShelves([40, 40, 40], width, 126, 3)).toEqual([[40, 40, 40]]);
  });

  it("starts a new shelf for a spine that won't fit, in order", () => {
    expect(packShelves([40, 40, 40, 30], width, 100, 3)).toEqual([[40, 40], [40, 30]]);
  });

  it("gives a spine wider than the shelf a shelf of its own", () => {
    expect(packShelves([40, 200, 40], width, 100, 3)).toEqual([[40], [200], [40]]);
  });

  it("uses one shelf until the room is known", () => {
    expect(packShelves([40, 40, 40], width, 0, 3)).toEqual([[40, 40, 40]]);
  });
});
