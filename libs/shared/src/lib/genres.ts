// The club's genres. Every book's genres come from this list, whether the AI
// picked them or a member did, so the filter chips stay tidy. Renaming one
// means re-tagging the books that have it.
export const GENRES = [
  "Literary fiction",
  "Contemporary fiction",
  "Historical fiction",
  "Psychological fiction",
  "Thriller & suspense",
  "Mystery & crime",
  "Romance",
  "Fantasy",
  "Magical realism",
  "Science fiction",
  "Dystopian",
  "Horror",
  "Adventure",
  "Humor",
  "Young adult",
  "LGBTQ+",
  "Classics",
  "Graphic novels & comics",
  "Poetry",
  "Short stories",
  "Memoir & biography",
  "Narrative nonfiction",
] as const;

export type Genre = (typeof GENRES)[number];

// The most any one book is tagged with, by the AI or a member.
export const MAX_GENRES = 3;

export const isGenre = (value: string): value is Genre =>
  (GENRES as readonly string[]).includes(value);
