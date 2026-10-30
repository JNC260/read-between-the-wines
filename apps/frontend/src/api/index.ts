import * as z from "zod";
import {
  BookCandidateSchema,
  BookDetailSchema,
  BookSchema,
  type CastVotesDTO,
  CastVotesSchema,
  type CreateBookSuggestionDTO,
  CreateBookSuggestionSchema,
  CreatedInviteSchema,
  type CreateMeetingDTO,
  CreateMeetingSchema,
  type CreatePollDTO,
  CreatePollSchema,
  type UpdatePollDTO,
  UpdatePollSchema,
  type CreateVenueDTO,
  CreateVenueSchema,
  CurrentPollSchema,
  InviteLookupSchema,
  type ManualBookSuggestionDTO,
  ManualBookSuggestionSchema,
  type MeetingListQuery,
  MeetingRsvpsSchema,
  type MergePlaceholderDTO,
  MergePlaceholderSchema,
  MergeResultSchema,
  PlaceholderSchema,
  MeetingSchema,
  PollSchema,
  type RateBookDTO,
  type SetRsvpDTO,
  SetRsvpSchema,
  RateBookSchema,
  RatingSchema,
  ReadBookSchema,
  SuggestedBookSchema,
  type UpdateBookDTO,
  UpdateBookSchema,
  type UpdateMeetingDTO,
  UpdateMeetingSchema,
  type UpdateProfileDTO,
  UpdateProfileSchema,
  type UpdateVenueDTO,
  UpdateVenueSchema,
  type UserDTO,
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
// request body the other way, or `send.form` to upload files.
const apiFetch = async <T extends z.ZodType>(
  url: string,
  schema: T,
  fallback: string,
  send?: { method: string; schema?: z.ZodType; body?: unknown; form?: FormData },
): Promise<z.output<T>> => {
  const response = await fetch(
    url,
    send && {
      method: send.method,
      ...(send.schema && {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(z.encode(send.schema, send.body)),
      }),
      // No Content-Type: the browser sets multipart/form-data itself, with
      // the boundary that separates the parts.
      ...(send.form && { body: send.form }),
    },
  );
  if (!response.ok) {
    await throwApiError(response, fallback);
  }
  // 204 No Content has no body to parse; pass z.undefined() for those.
  return z.decode(
    schema,
    response.status === 204 ? undefined : await response.json(),
  );
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

// Returns the member as everyone else will now see them.
export const updateProfile = (body: UpdateProfileDTO) =>
  apiFetch(`/api/users/me`, UserSchema, "Failed to save your profile", {
    method: "PATCH",
    schema: UpdateProfileSchema,
    body,
  });

// Sent as multipart/form-data with the file in "image", not JSON. Returns
// the member with the new photo's URL.
export const uploadProfileImage = (file: File): Promise<UserDTO> => {
  const form = new FormData();
  form.append("image", file);
  return apiFetch(`/api/users/me/image`, UserSchema, "Failed to upload your photo", {
    method: "PUT",
    form,
  });
};

export const removeProfileImage = (): Promise<UserDTO> =>
  apiFetch(`/api/users/me/image`, UserSchema, "Failed to remove your photo", {
    method: "DELETE",
  });
// Admin-only: legacy members who haven't joined, and handing one's history
// to the member who turned out to be them.
export const getPlaceholders = () =>
  apiFetch(
    `/api/users/placeholders`,
    PlaceholderSchema.array(),
    "Failed to fetch legacy members",
  );

export const mergePlaceholder = ({
  placeholderId,
  ...body
}: MergePlaceholderDTO & { placeholderId: string }) =>
  apiFetch(
    `/api/users/placeholders/${encodeURIComponent(placeholderId)}/merge`,
    MergeResultSchema,
    "Failed to merge",
    { method: "POST", schema: MergePlaceholderSchema, body },
  );

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

export const getMeetingRsvps = (meetingId: string) =>
  apiFetch(
    `/api/meetings/${encodeURIComponent(meetingId)}/rsvps`,
    MeetingRsvpsSchema,
    "Failed to fetch RSVPs",
  );

export const setRsvp = ({
  meetingId,
  ...body
}: SetRsvpDTO & { meetingId: string }) =>
  apiFetch(
    `/api/meetings/${encodeURIComponent(meetingId)}/rsvp`,
    MeetingRsvpsSchema,
    "Failed to save your RSVP",
    { method: "PUT", schema: SetRsvpSchema, body },
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

// q is a Goodreads link or a title; the server works out which.
export const searchBooks = (q: string) =>
  apiFetch(
    `/api/books/search?q=${encodeURIComponent(q)}`,
    BookCandidateSchema.array(),
    "Failed to search for books",
  );

export const createBookSuggestion = (body: CreateBookSuggestionDTO) =>
  apiFetch(`/api/books/suggestions`, BookSchema, "Failed to suggest book", {
    method: "POST",
    schema: CreateBookSuggestionSchema,
    body,
  });

export const createManualBookSuggestion = (body: ManualBookSuggestionDTO) =>
  apiFetch(
    `/api/books/suggestions/manual`,
    BookSchema,
    "Failed to suggest book",
    { method: "POST", schema: ManualBookSuggestionSchema, body },
  );

// Only allowed while this member is the book's one suggester.
export const withdrawSuggestion = (bookId: string) =>
  apiFetch(
    `/api/books/${encodeURIComponent(bookId)}/suggestion`,
    z.undefined(),
    "Failed to withdraw your suggestion",
    { method: "DELETE" },
  );

export const getBookSuggestions = () =>
  apiFetch(
    `/api/books/suggestions`,
    SuggestedBookSchema.array(),
    "Failed to fetch suggestions",
  );

export const getReadBooks = () =>
  apiFetch(`/api/books/read`, ReadBookSchema.array(), "Failed to fetch books");

// With canEdit, for the edit page.
export const getBook = (id: string) =>
  apiFetch(
    `/api/books/${encodeURIComponent(id)}`,
    BookDetailSchema,
    "Failed to fetch book",
  );

export const updateBook = ({ id, ...body }: UpdateBookDTO & { id: string }) =>
  apiFetch(
    `/api/books/${encodeURIComponent(id)}`,
    BookSchema,
    "Failed to save book",
    { method: "PATCH", schema: UpdateBookSchema, body },
  );

export const rateBook = ({
  bookId,
  ...body
}: RateBookDTO & { bookId: string }) =>
  apiFetch(
    `/api/books/${encodeURIComponent(bookId)}/rating`,
    RatingSchema,
    "Failed to save rating",
    { method: "PUT", schema: RateBookSchema, body },
  );

export const getCurrentPoll = () =>
  apiFetch(`/api/polls/current`, CurrentPollSchema, "Failed to fetch the poll");

export const getPoll = (id: string) =>
  apiFetch(
    `/api/polls/${encodeURIComponent(id)}`,
    PollSchema,
    "Failed to fetch the poll",
  );

export const createPoll = (body: CreatePollDTO) =>
  apiFetch(`/api/polls`, PollSchema, "Failed to create the poll", {
    method: "POST",
    schema: CreatePollSchema,
    body,
  });

// The newest poll, open or closed, or null before the first one.
export const getLatestPoll = () =>
  apiFetch(`/api/polls/latest`, CurrentPollSchema, "Failed to fetch the poll");

export const updatePoll = ({ id, ...body }: UpdatePollDTO & { id: string }) =>
  apiFetch(
    `/api/polls/${encodeURIComponent(id)}`,
    PollSchema,
    "Failed to save the poll",
    { method: "PATCH", schema: UpdatePollSchema, body },
  );

export const closePoll = (id: string) =>
  apiFetch(
    `/api/polls/${encodeURIComponent(id)}/close`,
    PollSchema,
    "Failed to close the poll",
    { method: "POST" },
  );

export const castVotes = ({
  pollId,
  ...body
}: CastVotesDTO & { pollId: string }) =>
  apiFetch(
    `/api/polls/${encodeURIComponent(pollId)}/votes`,
    PollSchema,
    "Failed to save your votes",
    { method: "PUT", schema: CastVotesSchema, body },
  );
