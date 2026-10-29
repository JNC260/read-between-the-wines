import { type AddressInfo } from "node:net";
import express from "express";
import { MAX_PROFILE_IMAGE_BYTES } from "shared";
import { type ApiResponse } from "../test/http";
import { errorHandler } from "./error-handler";
import { uploadImage } from "./upload";

// Just the middleware, on a tiny app: a route that reports what it got,
// and the real error handler, so failures come back as our usual JSON.
let base: string;
let close: () => void;

beforeAll(async () => {
  const app = express();
  app.put("/upload", uploadImage, (req, res) => {
    res.json({
      size: req.file?.size,
      type: req.file?.mimetype,
      isBuffer: Buffer.isBuffer(req.file?.buffer),
    });
  });
  app.use(errorHandler);
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => server.close();
});

afterAll(() => close());

const file = (bytes: number | string, type = "image/png", name = "me.png") =>
  new File([typeof bytes === "number" ? new Uint8Array(bytes) : bytes], name, {
    type,
  });

const upload = async (
  body: RequestInit["body"],
  headers?: RequestInit["headers"],
): Promise<ApiResponse> => {
  const res = await fetch(`${base}/upload`, { method: "PUT", body, headers });
  return { status: res.status, body: await res.json() };
};

const form = (fields: Record<string, File | string>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    data.append(name, value);
  }
  return data;
};

describe("uploadImage", () => {
  it("hands the controller the file as a Buffer", async () => {
    const res = await upload(form({ image: file(1234) }));
    expect(res).toEqual({
      status: 200,
      body: { size: 1234, type: "image/png", isBuffer: true },
    });
  });

  it.each(["image/jpeg", "image/png", "image/webp"])("accepts %s", async (type) => {
    const res = await upload(form({ image: file(10, type) }));
    expect(res.status).toBe(200);
  });

  it("accepts a file right at the limit", async () => {
    const res = await upload(form({ image: file(MAX_PROFILE_IMAGE_BYTES) }));
    expect(res.status).toBe(200);
  });

  it("rejects a file over the limit", async () => {
    const res = await upload(form({ image: file(MAX_PROFILE_IMAGE_BYTES + 1) }));
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: "BAD_REQUEST",
      message: "Photos can be up to 10 MB",
    });
  });

  it.each([
    ["a GIF", "image/gif"],
    ["a PDF", "application/pdf"],
    ["HEIC", "image/heic"],
  ])("rejects %s", async (_label, type) => {
    const res = await upload(form({ image: file(10, type) }));
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe("Photos have to be JPEG, PNG or WebP");
  });

  it("rejects a form without a file", async () => {
    const res = await upload(form({ note: "hi" }));
    expect(res.body.error.message).toBe("Choose a photo to upload");
  });

  it("rejects a JSON body, which multer leaves alone", async () => {
    const res = await upload(JSON.stringify({ image: "x" }), {
      "Content-Type": "application/json",
    });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe("Choose a photo to upload");
  });

  it("rejects a file in the wrong field", async () => {
    const res = await upload(form({ photo: file(10) }));
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Send one photo, in the "image" field');
  });

  it("rejects two files", async () => {
    const data = form({ image: file(10) });
    data.append("image", file(10));
    const res = await upload(data);
    expect(res.status).toBe(400);
  });

  it("rejects a body that isn't valid multipart with a 400, not a 500", async () => {
    const res = await upload("--x\r\nContent-Disposition: form-data; name=", {
      "Content-Type": "multipart/form-data; boundary=x",
    });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe("Couldn't read that upload");
  });
});
