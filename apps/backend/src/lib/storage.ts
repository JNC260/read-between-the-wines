// Where uploaded files live. Services call these and store the returned URL
// (User.image), so nothing else needs to know whether files are on local
// disk or in a bucket.
//
// They're on disk, in config.UPLOAD_DIR: locally a gitignored uploads/
// folder, on Railway a volume, since the container's own disk is wiped on
// every deploy. app.ts serves the folder at UPLOADS_URL_PATH.
import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { type ProfileImageType } from "shared";
import { config } from "./config";

export type UploadedImage = {
  buffer: Buffer;
  contentType: ProfileImageType;
};

// Under /api so Vite's dev proxy forwards it like every other request.
export const UPLOADS_URL_PATH = "/api/uploads";

const EXTENSIONS: Record<ProfileImageType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Exactly what saveImage names files: a UUID and one of our extensions.
// Anything else, like "../../.env", isn't ours to delete.
const OUR_FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

// Saves the image under a new random name and returns the URL the browser
// loads it from. A new name for every upload means the URL can be cached
// forever: a changed photo is a different URL.
export const saveImage = async (image: UploadedImage): Promise<string> => {
  const name = `${randomUUID()}.${EXTENSIONS[image.contentType]}`;
  await mkdir(config.UPLOAD_DIR, { recursive: true });
  // "wx" fails rather than overwrite, in the near-impossible case of a
  // repeated UUID.
  await writeFile(path.join(config.UPLOAD_DIR, name), image.buffer, { flag: "wx" });
  return `${UPLOADS_URL_PATH}/${name}`;
};

// Removes a file saveImage returned. Ignores URLs it didn't create, so
// clearing an old image never fails the request.
export const deleteImage = async (url: string): Promise<void> => {
  const prefix = `${UPLOADS_URL_PATH}/`;
  const name = url.startsWith(prefix) ? url.slice(prefix.length) : "";
  if (!OUR_FILE.test(name)) {
    return;
  }
  try {
    // force: an already-missing file is fine.
    await rm(path.join(config.UPLOAD_DIR, name), { force: true });
  } catch (err) {
    // The new photo is already saved; an orphaned old file is only clutter.
    console.error(`Couldn't delete ${name} from ${config.UPLOAD_DIR}`, err);
  }
};
