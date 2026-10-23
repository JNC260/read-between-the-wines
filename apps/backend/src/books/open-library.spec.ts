import {
  bareSearch,
  circeTitleSearch,
  noResults,
  workWithObjectDescription,
  workWithoutDescription,
  workWithStringDescription,
} from "./open-library.fixtures";
import { SearchResponseSchema, WorkSchema } from "./open-library";

describe("SearchResponseSchema", () => {
  it("parses full docs and drops fields we don't use", () => {
    const parsed = SearchResponseSchema.parse(circeTitleSearch);
    expect(parsed).toEqual({ docs: circeTitleSearch.docs });
  });

  it("parses docs missing every optional field", () => {
    expect(SearchResponseSchema.parse(bareSearch).docs).toEqual([
      { key: "/works/OL1W", title: "Untitled Manuscript" },
    ]);
  });

  it("parses an empty result", () => {
    expect(SearchResponseSchema.parse(noResults).docs).toEqual([]);
  });

  it("rejects a response without docs", () => {
    expect(SearchResponseSchema.safeParse({ error: "oops" }).success).toBe(false);
  });
});

describe("WorkSchema", () => {
  it("parses a description that is a string", () => {
    expect(WorkSchema.parse(workWithStringDescription)).toEqual({
      description: workWithStringDescription.description,
    });
  });

  it("parses a description that is an object, keeping only value", () => {
    expect(WorkSchema.parse(workWithObjectDescription)).toEqual({
      description: { value: workWithObjectDescription.description.value },
    });
  });

  it("parses a work without a description", () => {
    expect(WorkSchema.parse(workWithoutDescription)).toEqual({});
  });
});
