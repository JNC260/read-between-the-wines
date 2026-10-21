import {
  ApiError,
  createMeeting,
  getInvite,
  getMeetings,
  updateVenue,
} from ".";

vi.mock("../lib/auth-client", () => ({ authClient: {} }));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const respond = (status: number, body: unknown) =>
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify(body), { status }),
  );

const meeting = {
  id: "00000000-0000-4000-8000-000000000002",
  title: "October",
  start: "2030-10-01T23:00:00.000Z",
  end: "2030-10-02T01:00:00.000Z",
  description: null,
  venueId: null,
  bookId: null,
  venue: null,
};

describe("meetings API", () => {
  beforeEach(() => fetchMock.mockReset());

  it("filters the list with ?when= and decodes dates", async () => {
    respond(200, [meeting]);
    const [result] = await getMeetings("upcoming");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/meetings?when=upcoming");
    expect(result.start).toEqual(new Date(meeting.start));
  });

  it("asks for every meeting when no filter is given", async () => {
    respond(200, []);
    await getMeetings();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/meetings");
  });

  it("sends dates as ISO strings when creating", async () => {
    respond(201, meeting);
    await createMeeting({
      title: "October",
      start: new Date(meeting.start),
      end: new Date(meeting.end),
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/meetings");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      title: "October",
      start: meeting.start,
      end: meeting.end,
    });
  });

  it("sends only the changed fields, not the id, when updating", async () => {
    respond(200, {
      id: "00000000-0000-4000-8000-000000000003",
      name: "Library",
      streetAddress: "1 Main St",
      city: "Town",
      state: "NY",
      zip: "12345",
    });
    await updateVenue({
      id: "00000000-0000-4000-8000-000000000003",
      city: "Town",
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/venues/00000000-0000-4000-8000-000000000003");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ city: "Town" });
  });

  it("throws the server's error message", async () => {
    respond(404, {
      error: { code: "NOT_FOUND", message: "Meeting not found" },
    });
    await expect(getMeetings()).rejects.toThrow("Meeting not found");
  });

  it("keeps the status on the error so 4xx can skip retries", async () => {
    respond(403, { error: { code: "FORBIDDEN", message: "Admins only" } });
    const error = await getMeetings().catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(403);
  });
});

describe("getInvite", () => {
  beforeEach(() => fetchMock.mockReset());

  it("returns null for a missing or expired invite", async () => {
    respond(404, { error: { code: "NOT_FOUND", message: "Expired" } });
    expect(await getInvite("old-token")).toBeNull();
  });

  it("still throws other errors", async () => {
    respond(500, { error: { code: "INTERNAL", message: "Boom" } });
    await expect(getInvite("token")).rejects.toThrow("Boom");
  });
});
