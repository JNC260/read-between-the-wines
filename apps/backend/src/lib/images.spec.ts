import sharp from "sharp";
import { BadRequestError } from "./errors";
import { PROFILE_IMAGE_SIZE, toProfileImage } from "./images";

// Builds a solid-color test image in any format, so no fixture files.
const makeImage = (
  width: number,
  height: number,
  format: "png" | "jpeg" | "webp",
) =>
  sharp({
    create: { width, height, channels: 3, background: "#c81d6b" },
  })
    .toFormat(format)
    .toBuffer();

// An image split into equal bands of color, top to bottom ("rows") or
// left to right ("columns"), to see which part a crop kept.
const makeBands = async (
  width: number,
  height: number,
  direction: "rows" | "columns",
  colors: [number, number, number][],
) => {
  const pixels = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const along = direction === "rows" ? y / height : x / width;
      pixels.set(colors[Math.floor(along * colors.length)], (y * width + x) * 3);
    }
  }
  return sharp(pixels, { raw: { width, height, channels: 3 } }).png().toBuffer();
};

// The average color of each half of the result, along the given direction.
const halves = async (image: Buffer, direction: "rows" | "columns") => {
  const half = PROFILE_IMAGE_SIZE / 2;
  const region = (n: number) =>
    direction === "rows"
      ? { left: 0, top: n * half, width: PROFILE_IMAGE_SIZE, height: half }
      : { left: n * half, top: 0, width: half, height: PROFILE_IMAGE_SIZE };
  const mean = async (n: number) => {
    // stats() reads the input, not the pipeline, so the cut comes first.
    const cut = await sharp(image).extract(region(n)).toBuffer();
    const { channels } = await sharp(cut).stats();
    return channels.slice(0, 3).map((c) => Math.round(c.mean / 32));
  };
  return [await mean(0), await mean(1)];
};

const RED: [number, number, number] = [255, 0, 0];
const GREEN: [number, number, number] = [0, 255, 0];
const BLUE: [number, number, number] = [0, 0, 255];
// Rounded the way halves() rounds, so WebP's small color shifts don't matter.
const near = ([r, g, b]: [number, number, number]) =>
  [r, g, b].map((c) => Math.round(c / 32));

describe("toProfileImage", () => {
  it.each(["png", "jpeg", "webp"] as const)(
    "turns a %s into a square WebP",
    async (format) => {
      const out = await toProfileImage(await makeImage(1200, 800, format));
      expect(out.contentType).toBe("image/webp");
      const meta = await sharp(out.buffer).metadata();
      expect(meta).toMatchObject({
        format: "webp",
        width: PROFILE_IMAGE_SIZE,
        height: PROFILE_IMAGE_SIZE,
      });
    },
  );

  it("enlarges a small image to the full size", async () => {
    const out = await toProfileImage(await makeImage(64, 64, "png"));
    const meta = await sharp(out.buffer).metadata();
    expect(meta.width).toBe(PROFILE_IMAGE_SIZE);
  });

  // A portrait 1:2 in quarters, red, green, then blue for the bottom half:
  // the square is the top half, so red above green, with no blue at all.
  it("keeps the top of a tall photo, where the head usually is", async () => {
    const tall = await makeBands(300, 600, "rows", [RED, GREEN, BLUE, BLUE]);
    const out = await toProfileImage(tall);
    expect(await halves(out.buffer, "rows")).toEqual([near(RED), near(GREEN)]);
  });

  // A landscape 3:1, split left, middle, right: the square is the middle.
  it("keeps the middle of a wide photo", async () => {
    const wide = await makeBands(900, 300, "columns", [RED, GREEN, BLUE]);
    const out = await toProfileImage(wide);
    expect(await halves(out.buffer, "columns")).toEqual([near(GREEN), near(GREEN)]);
  });

  it("drops metadata like the camera's location", async () => {
    const withExif = await sharp(await makeImage(800, 600, "jpeg"))
      .withExif({
        IFD0: { Make: "Phone", Software: "Camera" },
        IFD3: { GPSLatitudeRef: "N", GPSLatitude: "37/1 5/1 0/1" },
      })
      .jpeg()
      .toBuffer();
    expect((await sharp(withExif).metadata()).exif).toBeDefined();

    const out = await toProfileImage(withExif);
    expect((await sharp(out.buffer).metadata()).exif).toBeUndefined();
  });

  it("applies the photo's orientation before dropping it", async () => {
    // Saved landscape, flagged "rotate 90° to display": really portrait.
    const sideways = await sharp(await makeImage(800, 400, "jpeg"))
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();
    expect((await sharp(sideways).metadata()).orientation).toBe(6);

    const out = await toProfileImage(sideways);
    expect((await sharp(out.buffer).metadata()).orientation).toBeUndefined();
  });

  it("rejects bytes that aren't an image", async () => {
    const pdf = Buffer.from("%PDF-1.7\nnot a photo");
    await expect(toProfileImage(pdf)).rejects.toThrow(BadRequestError);
  });

  it("rejects a truncated image", async () => {
    const png = await makeImage(400, 400, "png");
    await expect(toProfileImage(png.subarray(0, 50))).rejects.toThrow(
      "That file isn't an image we can read",
    );
  });
});
