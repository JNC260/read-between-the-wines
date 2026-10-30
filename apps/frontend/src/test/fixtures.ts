import {
  type BookDTO,
  type MeetingDTO,
  type MeetingRsvpsDTO,
  type PollDTO,
  type ReadBookDTO,
  type RsvpDTO,
  type SuggestedBookDTO,
} from "shared";

// Shared by the specs. Override whatever a test cares about.

export const testBook = (overrides: Partial<BookDTO> = {}): BookDTO => ({
  id: "00000000-0000-4000-8000-000000000010",
  title: "Circe",
  author: "Madeline Miller",
  yearPublished: 2018,
  genres: [],
  coverUrl: null,
  synopsis: "A witch on an island.",
  pageCount: 404,
  openLibraryWorkId: "OL18012166W",
  goodreadsUrl: null,
  createdAt: new Date("2026-10-01T00:00:00Z"),
  ...overrides,
});

export const testSuggestedBook = (
  overrides: Partial<SuggestedBookDTO> = {},
): SuggestedBookDTO => {
  const { synopsis: _, ...book } = testBook();
  return {
    ...book,
    suggestedBy: [],
    suggestedByMe: false,
    suggestedAt: new Date("2026-10-01T00:00:00Z"),
    ...overrides,
  };
};

export const circe = testBook();
export const piranesi = testBook({
  id: "00000000-0000-4000-8000-000000000011",
  title: "Piranesi",
  author: "Susanna Clarke",
  synopsis: "A house of endless halls.\n\nAnd a tide.",
  goodreadsUrl: "https://www.goodreads.com/book/show/50202953-piranesi",
});
export const beloved = testBook({
  id: "00000000-0000-4000-8000-000000000012",
  title: "Beloved",
  author: "Toni Morrison",
  synopsis: "A house haunted by its past.",
});

// Open, on circe/piranesi/beloved, two votes each, nobody has voted.
export const testPoll = (overrides: Partial<PollDTO> = {}): PollDTO => ({
  id: "00000000-0000-4000-8000-000000000050",
  theme: null,
  opensAt: new Date("2026-10-20T19:00:00Z"),
  closesAt: new Date("2099-11-01T19:00:00Z"),
  votesPerMember: 2,
  createdAt: new Date("2026-10-20T19:00:00Z"),
  isOpen: true,
  books: [circe, piranesi, beloved].map((b) => ({ ...b, meetingId: null })),
  myVotes: [],
  voterCount: 0,
  results: null,
  ...overrides,
});

export const testReadBook = (
  overrides: Partial<ReadBookDTO> = {},
): ReadBookDTO => {
  const { synopsis: _, ...book } = testBook();
  return {
    ...book,
    suggestedByMe: false,
    meetingId: "00000000-0000-4000-8000-000000000020",
    meetingStart: new Date("2026-09-10T19:00:00Z"),
    averageRating: null,
    ratingCount: 0,
    myRating: null,
    ...overrides,
  };
};

// Far in the future, at a venue, reading circe.
export const testMeeting = (
  overrides: Partial<MeetingDTO> = {},
): MeetingDTO => ({
  id: "00000000-0000-4000-8000-000000000030",
  title: "November meeting",
  start: new Date("2099-11-13T19:00:00"),
  end: new Date("2099-11-13T21:00:00"),
  description: null,
  craft: null,
  venueId: "00000000-0000-4000-8000-000000000040",
  bookId: circe.id,
  cancelledAt: null,
  venue: {
    id: "00000000-0000-4000-8000-000000000040",
    name: "Priya's place",
    streetAddress: "14 Elm St",
    city: "Springfield",
    state: "IL",
    zip: "62701",
  },
  book: circe,
  ...overrides,
});

// Pass details for what they're bringing and how many guests.
export const testRsvp = (
  firstName: string,
  status: RsvpDTO["status"],
  n: number,
  details: Partial<Pick<RsvpDTO, "dish" | "guestCount">> = {},
): RsvpDTO => ({
  member: {
    id: `00000000-0000-4000-8000-0000000001${String(n).padStart(2, "0")}`,
    firstName,
    lastName: "Reader",
    image: null,
  },
  status,
  dish: null,
  guestCount: 0,
  ...details,
});

export const testRsvps = (
  overrides: Partial<MeetingRsvpsDTO> = {},
): MeetingRsvpsDTO => ({ myStatus: null, rsvps: [], ...overrides });
