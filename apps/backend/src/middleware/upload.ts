import { type RequestHandler } from "express";

// Reads a multipart/form-data body with one image in the "image" field.
// express.json() only reads JSON, so uploads need their own parser. Runs
// before the controller, like validate(), and rejects with a BadRequestError
// when:
//   - there's no file in "image"
//   - its type isn't one of PROFILE_IMAGE_TYPES (from shared)
//   - it's bigger than MAX_PROFILE_IMAGE_BYTES (from shared)
// On success the controller finds the file on the request (with multer,
// req.file: { buffer, mimetype, size, ... }).
export const uploadImage: RequestHandler = (_req, _res, _next) => {
  // TODO: parse the upload (probably multer with memoryStorage, so the
  // service gets a Buffer and storage.ts decides where it goes).
  // Don't trust the browser's Content-Type alone: check the file's first
  // bytes too, or let an image library fail to read it.
  throw new Error("TODO: uploadImage");
};
