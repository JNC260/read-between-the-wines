import { createHmac, timingSafeEqual } from "node:crypto";
import { type NotificationKind } from "shared";
import { config } from "../lib/config";

type UnsubscribeKind = NotificationKind | "ALL";

// Unsubscribe links work without signing in, so each is signed for one
// member and one kind: changing either in the URL breaks the signature.
const sign = (userId: string, kind: UnsubscribeKind) =>
  createHmac("sha256", config.BETTER_AUTH_SECRET)
    .update(`unsubscribe:${userId}:${kind}`)
    .digest("base64url");

export const isValidUnsubscribe = (userId: string, kind: UnsubscribeKind, token: string) => {
  const expected = Buffer.from(sign(userId, kind));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
};

const query = (userId: string, kind: UnsubscribeKind) =>
  new URLSearchParams({ u: userId, k: kind, t: sign(userId, kind) }).toString();

// The page the email's footer links to, which says what was turned off.
export const unsubscribePageUrl = (userId: string, kind: UnsubscribeKind) =>
  `${config.BETTER_AUTH_URL}/unsubscribe?${query(userId, kind)}`;

// For the List-Unsubscribe header: mail apps that offer their own
// "Unsubscribe" button POST here directly (RFC 8058 one-click).
export const unsubscribeApiUrl = (userId: string, kind: UnsubscribeKind) =>
  `${config.BETTER_AUTH_URL}/api/notifications/unsubscribe?${query(userId, kind)}`;

export const siteUrl = (path: string) => `${config.BETTER_AUTH_URL}${path}`;
