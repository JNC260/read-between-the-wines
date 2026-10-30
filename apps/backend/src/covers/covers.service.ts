import { access, mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "../lib/config";
import { BadGatewayError, NotFoundError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { USER_AGENT } from "../books/open-library";

// Open Library sends every cover through two redirects to archive.org, which
// takes up to a few seconds each, and a phone loading a page of them gives
// up on many. So the first time a cover is asked for, it's fetched once and
// kept next to members' photos; after that it's a fast local file.

const OPEN_LIBRARY_COVERS = "https://covers.openlibrary.org/b/id/";
// What coverUrlFor() builds: an Open Library cover id and a size.
const COVER_FILE = /^\d{1,12}-[SML]\.jpg$/;

const coversDir = () => path.join(config.UPLOAD_DIR, "covers");

const exists = (file: string) =>
  access(file).then(
    () => true,
    () => false,
  );

// Only covers our books use, so this can't be used to fill the disk with
// any image Open Library has.
const isOurCover = async (file: string) =>
  !!(await prisma.book.findFirst({
    where: { coverUrl: `${OPEN_LIBRARY_COVERS}${file}` },
    select: { id: true },
  }));

const download = async (file: string): Promise<string> => {
  let response: Response;
  try {
    // default=false: a 404 for a cover Open Library doesn't have, instead
    // of a 1x1 blank image.
    response = await fetch(`${OPEN_LIBRARY_COVERS}${file}?default=false`, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new BadGatewayError();
  }
  if (response.status === 404) {
    throw new NotFoundError("No such cover");
  }
  if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) {
    throw new BadGatewayError();
  }
  const image = Buffer.from(await response.arrayBuffer());
  const full = path.join(coversDir(), file);
  await mkdir(coversDir(), { recursive: true });
  // Written under a temporary name and renamed, so a half-written file is
  // never served.
  const temp = `${full}.${randomUUID()}.tmp`;
  await writeFile(temp, image);
  await rename(temp, full);
  return full;
};

// Several people opening the same page at once share one download.
const downloading = new Map<string, Promise<string>>();

// The path of the cover on disk, fetching it first if this is its first
// request.
export const coverFile = async (file: string): Promise<string> => {
  if (!COVER_FILE.test(file)) {
    throw new NotFoundError("No such cover");
  }
  const full = path.join(coversDir(), file);
  if (await exists(full)) {
    return full;
  }
  if (!(await isOurCover(file))) {
    throw new NotFoundError("No such cover");
  }
  let pending = downloading.get(file);
  if (!pending) {
    // Another request may have finished downloading it while this one was
    // checking the database.
    if (await exists(full)) {
      return full;
    }
    pending = downloading.get(file) ?? download(file).finally(() => downloading.delete(file));
    downloading.set(file, pending);
  }
  return pending;
};

// For links in emails and preview cards: our copy, by absolute URL, when
// the cover is an Open Library one.
export const cachedCoverUrl = (coverUrl: string) =>
  coverUrl.startsWith(OPEN_LIBRARY_COVERS)
    ? `${config.BETTER_AUTH_URL}/api/covers/${coverUrl.slice(OPEN_LIBRARY_COVERS.length)}`
    : coverUrl;
