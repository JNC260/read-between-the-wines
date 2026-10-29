import { type AddressInfo } from "node:net";
import { app } from "../app";
import { TEST_USER_HEADER } from "./mock-auth";

// body is parsed JSON. any, so specs can reach into it without a cast for
// every field; the assertions are what check its shape.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ApiResponse = { status: number; body: any };

// Taken when this module loads, before a spec stubs the global fetch to fake
// Open Library, so requests to the app still go through.
const send = globalThis.fetch;

// Serves the real app on a free port and sends requests to /api with the
// built-in fetch. Pass `as` to sign in as that user (needs mock-auth), and
// `body` for JSON or `form` for a multipart upload.
export const startApi = async () => {
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;

  const request = async (
    method: string,
    path: string,
    options: { as?: { id: string }; body?: unknown; form?: FormData } = {},
  ): Promise<ApiResponse> => {
    const headers: Record<string, string> = {};
    if (options.as) {
      headers[TEST_USER_HEADER] = options.as.id;
    }
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    // No Content-Type for a form: fetch sets it, with the boundary.
    const response = await send(`http://127.0.0.1:${port}/api${path}`, {
      method,
      headers,
      body:
        options.form ??
        (options.body === undefined ? undefined : JSON.stringify(options.body)),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : undefined };
  };

  // For responses that aren't JSON, like an uploaded image. path is from
  // the site root, so include /api.
  const fetchRaw = (path: string, init?: RequestInit) =>
    send(`http://127.0.0.1:${port}${path}`, init);

  const close = () =>
    new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );

  return { request, fetchRaw, close };
};
