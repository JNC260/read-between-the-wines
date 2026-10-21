import * as z from "zod";
import {
  CreatedInviteSchema,
  type CreateMeetingDTO,
  CreateMeetingSchema,
  type CreateVenueDTO,
  CreateVenueSchema,
  InviteLookupSchema,
  type MeetingListQuery,
  MeetingSchema,
  type UpdateMeetingDTO,
  UpdateMeetingSchema,
  type UpdateVenueDTO,
  UpdateVenueSchema,
  UserSchema,
  VenueSchema,
} from "shared";
import { authClient } from "../lib/auth-client";

// Better Auth's client returns { data, error } instead of throwing; React
// Query needs a thrown error to set a mutation's error state.
const unwrap = <T>(
  result: { data: T | null; error: { message?: string } | null },
  fallback: string,
): T => {
  if (result.error) {
    throw new Error(result.error.message ?? fallback);
  }
  return result.data as T;
};

// Our own API's errors look like { error: { code, message } }. The status
// rides along so callers (and React Query's retry rule) can tell a 404 from
// a server error.
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const throwApiError = async (response: Response, fallback: string) => {
  const body = await response.json().catch(() => null);
  throw new ApiError(response.status, body?.error?.message ?? fallback);
};

// Fetches from our API and decodes the response with `schema`, so dates come
// back as Date objects. Pass `send.schema` and `send.body` to encode a
// request body the other way.
const apiFetch = async <T extends z.ZodType>(
  url: string,
  schema: T,
  fallback: string,
  send?: { method: string; schema?: z.ZodType; body?: unknown },
): Promise<z.output<T>> => {
  const response = await fetch(
    url,
    send && {
      method: send.method,
      ...(send.schema && {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(z.encode(send.schema, send.body)),
      }),
    },
  );
  if (!response.ok) {
    await throwApiError(response, fallback);
  }
  return z.decode(schema, await response.json());
};

export const getUsersList = () =>
  apiFetch(`/api/users`, UserSchema.array(), "Failed to fetch user list");

// Returns null for an invalid or expired invite, so the page can show a
// friendly message instead of an error.
export const getInvite = async (token: string) => {
  try {
    return await apiFetch(
      `/api/invites/${encodeURIComponent(token)}`,
      InviteLookupSchema,
      "Failed to check invite",
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return null;
    }
    throw err;
  }
};

export const createInvite = () =>
  apiFetch(`/api/invites`, CreatedInviteSchema, "Failed to create invite", {
    method: "POST",
  });

export const signIn = async (body: { email: string; password: string }) => {
  return unwrap(await authClient.signIn.email(body), "Failed to sign in").user;
};

export const signOut = async () => {
  unwrap(await authClient.signOut(), "Failed to sign out");
};

// Doesn't sign them in: they have to verify their email first. The link in
// that email signs them in and lands them on "/".
export const signUpWithInvite = async (input: {
  token: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}) => {
  // Built separately because Better Auth's types don't know about
  // inviteToken, though the server accepts it. TypeScript only rejects
  // unknown keys in inline objects.
  const body = {
    email: input.email,
    password: input.password,
    name: `${input.firstName} ${input.lastName}`,
    firstName: input.firstName,
    lastName: input.lastName,
    inviteToken: input.token,
    callbackURL: "/",
  };
  unwrap(await authClient.signUp.email(body), "Failed to create account");
};

export const requestPasswordReset = async (email: string) => {
  unwrap(
    await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    }),
    "Failed to request a password reset",
  );
};

export const resetPassword = async (body: {
  token: string;
  newPassword: string;
}) => {
  unwrap(await authClient.resetPassword(body), "Failed to reset password");
};

export const reactivateAccount = async () => {
  await apiFetch(
    `/api/users/me/reactivate`,
    UserSchema,
    "Failed to reactivate account",
    { method: "POST" },
  );
};

export const getMeetings = (when?: MeetingListQuery["when"]) => {
  const query = when ? `?when=${when}` : "";
  return apiFetch(
    `/api/meetings${query}`,
    MeetingSchema.array(),
    "Failed to fetch meetings",
  );
};

export const getMeeting = (id: string) =>
  apiFetch(
    `/api/meetings/${encodeURIComponent(id)}`,
    MeetingSchema,
    "Failed to fetch meeting",
  );

export const createMeeting = (body: CreateMeetingDTO) =>
  apiFetch(`/api/meetings`, MeetingSchema, "Failed to create meeting", {
    method: "POST",
    schema: CreateMeetingSchema,
    body,
  });

export const updateMeeting = ({
  id,
  ...body
}: UpdateMeetingDTO & { id: string }) =>
  apiFetch(
    `/api/meetings/${encodeURIComponent(id)}`,
    MeetingSchema,
    "Failed to update meeting",
    { method: "PATCH", schema: UpdateMeetingSchema, body },
  );

export const getVenues = () =>
  apiFetch(`/api/venues`, VenueSchema.array(), "Failed to fetch venues");

export const getVenue = (id: string) =>
  apiFetch(
    `/api/venues/${encodeURIComponent(id)}`,
    VenueSchema,
    "Failed to fetch venue",
  );

export const createVenue = (body: CreateVenueDTO) =>
  apiFetch(`/api/venues`, VenueSchema, "Failed to create venue", {
    method: "POST",
    schema: CreateVenueSchema,
    body,
  });

export const updateVenue = ({ id, ...body }: UpdateVenueDTO & { id: string }) =>
  apiFetch(
    `/api/venues/${encodeURIComponent(id)}`,
    VenueSchema,
    "Failed to update venue",
    { method: "PATCH", schema: UpdateVenueSchema, body },
  );
