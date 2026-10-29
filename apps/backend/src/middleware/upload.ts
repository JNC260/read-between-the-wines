import { type RequestHandler } from "express";
import multer from "multer";
import {
  isProfileImageType,
  MAX_PROFILE_IMAGE_BYTES,
  type ProfileImageType,
} from "shared";
import { BadRequestError } from "../lib/errors";

// Memory, not disk: the file is resized before it's stored, so the original
// never needs a home, and storage.ts stays the one place that writes files.
// The limits make multer stop reading as soon as a request goes over, so a
// huge upload costs at most MAX_PROFILE_IMAGE_BYTES of memory.
const parseImage = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_PROFILE_IMAGE_BYTES,
    files: 1,
    // No other form fields are expected; a few are allowed so a browser
    // adding one doesn't break the upload.
    fields: 5,
  },
}).single("image");

const MAX_MB = MAX_PROFILE_IMAGE_BYTES / 1024 / 1024;
// A Record over ProfileImageType, so adding a type in shared without a name
// here won't compile.
const TYPE_NAMES: Record<ProfileImageType, string> = {
  "image/jpeg": "JPEG",
  "image/png": "PNG",
  "image/webp": "WebP",
};
const typeList = Object.values(TYPE_NAMES)
  .join(", ")
  .replace(/, ([^,]+)$/, " or $1");

// multer's own errors, in words for the profile page. Anything else it
// rejects (too many fields, a mangled body) gets the general message.
const MULTER_MESSAGES: Partial<Record<multer.ErrorCode, string>> = {
  LIMIT_FILE_SIZE: `Photos can be up to ${MAX_MB} MB`,
  LIMIT_UNEXPECTED_FILE: 'Send one photo, in the "image" field',
  LIMIT_FILE_COUNT: "Send one photo at a time",
};

// Reads a multipart/form-data body with one image in the "image" field.
// express.json() only reads JSON, so uploads need their own parser. Runs
// before the controller, like validate(), and rejects with a BadRequestError
// when:
//   - there's no file in "image"
//   - its type isn't one of PROFILE_IMAGE_TYPES (from shared)
//   - it's bigger than MAX_PROFILE_IMAGE_BYTES (from shared)
// On success the controller finds the file on the request as req.file:
// { buffer, mimetype, size, ... }.
//
// The type checked here is what the browser claims. The real check is in
// lib/images.ts: sharp has to decode the bytes, so a renamed PDF fails there.
export const uploadImage: RequestHandler = (req, res, next) => {
  parseImage(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      next(new BadRequestError(MULTER_MESSAGES[err.code] ?? "Couldn't read that upload"));
      return;
    }
    if (err) {
      // A body that ends early or isn't valid multipart: still the
      // client's mistake, not ours.
      next(new BadRequestError("Couldn't read that upload"));
      return;
    }
    if (!req.file) {
      next(new BadRequestError("Choose a photo to upload"));
      return;
    }
    if (!isProfileImageType(req.file.mimetype)) {
      next(new BadRequestError(`Photos have to be ${typeList}`));
      return;
    }
    next();
  });
};
