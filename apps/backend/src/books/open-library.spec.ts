import {
  bareSearch,
  circeTitleSearch,
  noResults,
  workWithObjectDescription,
  workWithoutDescription,
  workWithStringDescription,
} from "./open-library.fixtures";
import { SearchResponseSchema, WorkDescriptionSchema } from "./open-library";

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

describe("WorkDescriptionSchema", () => {
  it("parses a description that is a string", () => {
    expect(WorkDescriptionSchema.parse(workWithStringDescription)).toEqual({
      description: workWithStringDescription.description,
      subjects: [],
    });
  });

  it("parses a description that is an object, keeping only value", () => {
    expect(WorkDescriptionSchema.parse(workWithObjectDescription)).toEqual({
      description: { value: workWithObjectDescription.description.value },
      subjects: [],
    });
  });

  it("parses a work without a description", () => {
    expect(WorkDescriptionSchema.parse(workWithoutDescription)).toEqual({
      subjects: [],
    });
  });

  it("keeps the subjects, which help pick genres", () => {
    expect(
      WorkDescriptionSchema.parse({ subjects: ["Fantasy", "Greek Mythology"] }).subjects,
    ).toEqual(["Fantasy", "Greek Mythology"]);
  });
});
