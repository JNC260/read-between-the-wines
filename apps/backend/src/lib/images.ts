import sharp from "sharp";
import { BadRequestError } from "./errors";

// Square, and twice the largest size the site shows (the 7.5rem avatar), so
// it stays sharp on high-density phone screens.
export const PROFILE_IMAGE_SIZE = 512;

// Far more than any phone camera (a 48 MP photo is 48 million), far less
// than sharp's default of 268 million. A small file can declare enormous
// dimensions and take gigabytes to decode; this refuses those up front.
const MAX_INPUT_PIXELS = 100_000_000;

export type ProcessedImage = {
  buffer: Buffer;
  contentType: "image/webp";
};

// Turns whatever was uploaded into the one format we store: a 512px WebP
// square. Decoding and re-encoding also proves the bytes really are an
// image, whatever the browser said they were, and drops all metadata,
// including the GPS location phones write into photos. sharp only keeps
// metadata when asked (keepMetadata()), so leaving that out is the strip.
export const toProfileImage = async (input: Buffer): Promise<ProcessedImage> => {
  try {
    const buffer = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
      // Phones save photos sideways and record which way is up in the
      // metadata. rotate() with no angle applies that before it's dropped.
      .rotate()
      // Crops to a square from the top of a tall photo and the middle of a
      // wide one, since that's where the head usually is in a portrait.
      // (sharp's "attention" crop looked for the busiest part instead, and
      // often picked a patterned shirt or the background over a face.)
      .resize(PROFILE_IMAGE_SIZE, PROFILE_IMAGE_SIZE, {
        fit: "cover",
        position: "top",
      })
      .webp({ quality: 82 })
      .toBuffer();
    return { buffer, contentType: "image/webp" };
  } catch {
    // Anything sharp can't read, from a renamed PDF to a truncated photo.
    throw new BadRequestError("That file isn't an image we can read");
  }
};
