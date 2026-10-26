import { type AddressInfo } from "node:net";
import { app } from "../app";
import { TEST_USER_HEADER } from "./mock-auth";

// body is parsed JSON. any, so specs can reach into it without a cast for
// every field; the assertions are what check its shape.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ApiResponse = { status: number; body: any };

// Serves the real app on a free port and sends requests to /api with the
// built-in fetch. Pass `as` to sign in as that user (needs mock-auth).
export const startApi = async () => {
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;

  const request = async (
    method: string,
    path: string,
    options: { as?: { id: string }; body?: unknown } = {},
  ): Promise<ApiResponse> => {
    const headers: Record<string, string> = {};
    if (options.as) {
      headers[TEST_USER_HEADER] = options.as.id;
    }
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    const response = await fetch(`http://127.0.0.1:${port}/api${path}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : undefined };
  };

  const close = () =>
    new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );

  return { request, close };
};
