// Trimmed from real Open Library responses (October 2026), for tests.

// GET /search.json?q=id_goodreads:35959740
export const circeSearch = {
  numFound: 1,
  docs: [
    {
      key: "/works/OL18012166W",
      title: "Circe",
      author_name: ["Madeline Miller"],
      first_publish_year: 2018,
      cover_i: 8739376,
      number_of_pages_median: 404,
    },
  ],
};

// GET /search.json?q=circe: same title, different books
export const circeTitleSearch = {
  numFound: 616,
  docs: [
    ...circeSearch.docs,
    {
      key: "/works/OL21869269W",
      title: "Circe",
      author_name: ["Miguel Ramos Carrión"],
      first_publish_year: 1902,
      cover_i: 10412640,
      number_of_pages_median: 32,
    },
  ],
};

// A doc with every optional field missing
export const bareSearch = {
  numFound: 1,
  docs: [{ key: "/works/OL1W", title: "Untitled Manuscript" }],
};

export const noResults = { numFound: 0, docs: [] };

// GET /works/<id>.json, in the two shapes description comes in
export const workWithStringDescription = {
  key: "/works/OL18012166W",
  title: "Circe",
  description: "In the house of Helios, god of the sun...",
};

export const workWithObjectDescription = {
  key: "/works/OL27482W",
  title: "The Hobbit",
  description: {
    type: "/type/text",
    value: "The Hobbit is a tale of high adventure...",
  },
};

export const workWithoutDescription = { key: "/works/OL1W", title: "Untitled Manuscript" };
