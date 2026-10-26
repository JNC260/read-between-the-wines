import { type BookDTO, type PollDTO, type SuggestedBookDTO } from "shared";

// Shared by the poll specs. Override whatever a test cares about.

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
  books: [circe, piranesi, beloved],
  myVotes: [],
  voterCount: 0,
  results: null,
  ...overrides,
});
