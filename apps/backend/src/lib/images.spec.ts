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
