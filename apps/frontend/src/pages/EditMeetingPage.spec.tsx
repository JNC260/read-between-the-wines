import { fireEvent, screen } from "@testing-library/react";
import { type MeetingDTO } from "shared";
import {
  ApiError,
  getBookSuggestions,
  getMeeting,
  getVenues,
  updateMeeting,
} from "../api";
import { renderRoutes, Route } from "../test-utils";
import EditMeetingPage from "./EditMeetingPage";

vi.mock("../api", async (importOriginal) => ({
  // The real ApiError, so the not-found test can throw one.
  ApiError: (await importOriginal<typeof import("../api")>()).ApiError,
  getBookSuggestions: vi.fn(),
  getMeeting: vi.fn(),
  getVenues: vi.fn(),
  updateMeeting: vi.fn(),
}));

const ID = "00000000-0000-4000-8000-000000000002";
const VENUE_ID = "00000000-0000-4000-8000-000000000003";

const venue = {
  id: VENUE_ID,
  name: "Ada's house",
  streetAddress: "1 Main St",
  city: "Springfield",
  state: "IL",
  zip: "62701",
};

const slewfoot = {
  id: "00000000-0000-4000-8000-000000000010",
  title: "Slewfoot",
  author: "Brom",
  yearPublished: 2021,
  genres: [],
  coverUrl: null,
  synopsis: null,
  pageCount: 336,
  openLibraryWorkId: null,
  goodreadsUrl: null,
  createdAt: new Date("2026-10-01T00:00:00Z"),
};

// As the suggestions list returns it: no synopsis, plus who suggested it.
const { synopsis: _, ...slewfootRow } = slewfoot;
const suggestedSlewfoot = {
  ...slewfootRow,
  suggestedBy: [],
  suggestedByMe: false,
  suggestedAt: slewfoot.createdAt,
};

const meeting: MeetingDTO = {
  id: ID,
  title: "November: Piranesi",
  // Local times, like the admin typed them in.
  start: new Date("2030-11-04T19:00"),
  end: new Date("2030-11-04T21:00"),
  description: "Bring a snack",
  craft: "Bookmarks",
  venueId: VENUE_ID,
  bookId: null,
  venue,
  book: null,
};

const renderPage = () =>
  renderRoutes(
    `/meetings/${ID}/edit`,
    <>
      <Route path="/meetings/:id/edit" element={<EditMeetingPage />} />
      <Route path="/meetings" element="meetings page" />
    </>,
  );

const valueOf = (label: string) =>
  (screen.getByLabelText(label) as HTMLInputElement).value;

const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const loaded = async () => {
  renderPage();
  await screen.findByRole("heading", { name: "Edit meeting" });
  await screen.findByRole("option", { name: "Ada's house" });
};

describe("EditMeetingPage", () => {
  beforeEach(() => {
    vi.mocked(getMeeting).mockResolvedValue(meeting);
    vi.mocked(getVenues).mockResolvedValue([venue]);
    vi.mocked(getBookSuggestions).mockResolvedValue([suggestedSlewfoot]);
  });

  it("loads the meeting from the URL and fills in the form", async () => {
    await loaded();
    expect(vi.mocked(getMeeting).mock.calls[0][0]).toBe(ID);
    expect(valueOf("Title")).toBe("November: Piranesi");
    expect(valueOf("Starts")).toBe("2030-11-04T19:00");
    expect(valueOf("Ends")).toBe("2030-11-04T21:00");
    expect(valueOf("Venue")).toBe(VENUE_ID);
    expect(valueOf("Description")).toBe("Bring a snack");
  });

  it("saves every field and goes back to the meetings list", async () => {
    vi.mocked(updateMeeting).mockResolvedValue(meeting);
    await loaded();
    fill("Title", "November: Piranesi (moved)");
    fill("Starts", "2030-11-05T19:00");
    fill("Ends", "2030-11-05T21:00");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("meetings page")).toBeTruthy();
    expect(vi.mocked(updateMeeting).mock.calls[0][0]).toEqual({
      id: ID,
      title: "November: Piranesi (moved)",
      start: new Date("2030-11-05T19:00"),
      end: new Date("2030-11-05T21:00"),
      venueId: VENUE_ID,
      bookId: null,
      description: "Bring a snack",
      craft: "Bookmarks",
    });
  });

  it("assigns a suggested book", async () => {
    vi.mocked(updateMeeting).mockResolvedValue(meeting);
    await loaded();
    await screen.findByRole("option", { name: "Slewfoot by Brom" });
    fill("Book", slewfoot.id);
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByText("meetings page");
    expect(vi.mocked(updateMeeting).mock.calls[0][0]).toMatchObject({
      bookId: slewfoot.id,
    });
  });

  // Suggestions leave out assigned books, so the form adds this one back.
  it("keeps the current book selected and can clear it", async () => {
    vi.mocked(getMeeting).mockResolvedValue({
      ...meeting,
      bookId: slewfoot.id,
      book: slewfoot,
    });
    vi.mocked(getBookSuggestions).mockResolvedValue([]);
    vi.mocked(updateMeeting).mockResolvedValue(meeting);
    await loaded();
    expect(valueOf("Book")).toBe(slewfoot.id);
    fill("Book", "");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByText("meetings page");
    expect(vi.mocked(updateMeeting).mock.calls[0][0]).toMatchObject({
      bookId: null,
    });
  });

  it("clears the venue, description and craft when they're emptied", async () => {
    vi.mocked(updateMeeting).mockResolvedValue(meeting);
    await loaded();
    fill("Venue", "");
    fill("Description", "");
    fill("Craft", "");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByText("meetings page");
    expect(vi.mocked(updateMeeting).mock.calls[0][0]).toMatchObject({
      venueId: null,
      description: null,
      craft: null,
    });
  });

  it("shows the server's error if saving fails", async () => {
    vi.mocked(updateMeeting).mockRejectedValue(new Error("Venue not found"));
    await loaded();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Venue not found",
    );
  });

  it("says so when the meeting doesn't exist", async () => {
    vi.mocked(getMeeting).mockRejectedValue(
      new ApiError(404, "Meeting not found"),
    );
    renderPage();
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Meeting not found",
    );
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
  });
});
