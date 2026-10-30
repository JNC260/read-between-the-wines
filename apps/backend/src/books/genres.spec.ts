import { pickGenres } from "./genres";

// A stand-in client: each test says what Claude "answers".
const parse = vi.fn();
const ai = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("../lib/ai", () => ({
  AI_MODEL: "claude-opus-5-5",
  get anthropic() {
    return ai.client;
  },
}));

const circe = {
  title: "Circe",
  author: "Madeline Miller",
  synopsis: "A witch on an island.",
  subjects: ["Fantasy", "Greek Mythology", "nyt:combined-print-and-e-book-fiction=2018-04-29"],
};

const answer = (genres: string[], stop_reason = "end_turn") =>
  parse.mockResolvedValueOnce({ stop_reason, parsed_output: { genres } });

beforeEach(() => {
  parse.mockReset();
  ai.client = { beta: { messages: { parse } } };
});

describe("pickGenres", () => {
  it("sends the book and asks Opus 5.5, at low effort, for genres from the list", async () => {
    answer(["Fantasy", "Historical fiction"]);
    expect(await pickGenres(circe)).toEqual(["Fantasy", "Historical fiction"]);

    const [request] = parse.mock.calls[0];
    expect(request.model).toBe("claude-opus-5-5");
    expect(request.output_config.effort).toBe("low");
    expect(request.fallbacks).toBe("default");
    expect(request.system).toContain("- Thriller & suspense");
    const prompt = request.messages[0].content;
    expect(prompt).toContain("Title: Circe");
    expect(prompt).toContain("Author: Madeline Miller");
    expect(prompt).toContain("Synopsis: A witch on an island.");
    expect(prompt).toContain("Subjects: Fantasy; Greek Mythology;");
  });

  it("leaves out a synopsis and subjects the book doesn't have", async () => {
    answer(["Fantasy"]);
    await pickGenres({ ...circe, synopsis: null, subjects: [] });
    const prompt = parse.mock.calls[0][0].messages[0].content;
    expect(prompt).not.toContain("Synopsis");
    expect(prompt).not.toContain("Subjects");
  });

  it("keeps at most three genres, each once", async () => {
    answer(["Fantasy", "Fantasy", "Romance", "Horror", "Humor"]);
    expect(await pickGenres(circe)).toEqual(["Fantasy", "Romance", "Horror"]);
  });

  it("gives no genres when the request is refused", async () => {
    answer([], "refusal");
    expect(await pickGenres(circe)).toEqual([]);
  });

  it("returns null without calling anything when there's no API key", async () => {
    ai.client = null;
    expect(await pickGenres(circe)).toBeNull();
    expect(parse).not.toHaveBeenCalled();
  });

  it("lets API errors through for the caller to log", async () => {
    parse.mockRejectedValueOnce(new Error("overloaded"));
    await expect(pickGenres(circe)).rejects.toThrow("overloaded");
  });
});
