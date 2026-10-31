import { fireEvent, screen, within } from "@testing-library/react";
import {
  cancelMeeting,
  getMeeting,
  getMeetingRsvps,
  restoreMeeting,
  setRsvp,
} from "../api";
import { testMeeting, testRsvp, testRsvps } from "../test/fixtures";
import { mockSession, renderRoutes, Route, testUser } from "../test-utils";
import MeetingPage from "./MeetingPage";

vi.mock("../lib/auth-client", () => ({ authClient: { useSession: vi.fn() } }));
vi.mock("../api", () => ({
  cancelMeeting: vi.fn(),
  getMeeting: vi.fn(),
  getMeetingRsvps: vi.fn(),
  restoreMeeting: vi.fn(),
  setRsvp: vi.fn(),
}));

const meeting = testMeeting();

const renderPage = () =>
  renderRoutes(
    `/meetings/${meeting.id}`,
    <Route path="/meetings/:id" element={<MeetingPage />} />,
  );

describe("MeetingPage", () => {
  beforeEach(() => {
    mockSession(testUser());
    vi.mocked(getMeeting).mockResolvedValue(meeting);
    vi.mocked(getMeetingRsvps).mockResolvedValue(testRsvps());
  });

  it("shows the book, time, place and synopsis", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Circe" })).toBeTruthy();
    expect(screen.getByText("Madeline Miller")).toBeTruthy();
    expect(screen.getByText(/14 Elm St, Springfield, IL 62701/)).toBeTruthy();
    expect(screen.getByText("A witch on an island.")).toBeTruthy();
    expect(vi.mocked(getMeeting).mock.calls[0][0]).toBe(meeting.id);
  });

  it("falls back to the meeting title before a book is picked", async () => {
    vi.mocked(getMeeting).mockResolvedValue(
      testMeeting({ book: null, bookId: null }),
    );
    renderPage();
    expect(
      await screen.findByRole("heading", { level: 1, name: "November meeting" }),
    ).toBeTruthy();
    expect(screen.getByText("Book to be announced")).toBeTruthy();
  });

  it("groups who's coming by answer", async () => {
    vi.mocked(getMeetingRsvps).mockResolvedValue(
      testRsvps({
        rsvps: [
          testRsvp("Priya", "YES", 1),
          testRsvp("Dani", "MAYBE", 2),
          testRsvp("Jen", "YES", 3),
        ],
      }),
    );
    renderPage();
    const going = (await screen.findByRole("heading", { name: /Going/ }))
      .parentElement as HTMLElement;
    expect(within(going).getAllByRole("listitem").map((li) => li.lastElementChild?.textContent))
      .toEqual(["Priya Reader", "Jen Reader"]);
    expect(screen.getByRole("heading", { name: /Maybe/ })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: /Can't make it/ })).toBeNull();
  });

  it("saves an RSVP and marks it as picked", async () => {
    vi.mocked(setRsvp).mockResolvedValue(testRsvps({ myStatus: "MAYBE" }));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Maybe" }));
    await vi.waitFor(() =>
      expect(vi.mocked(setRsvp).mock.calls[0][0]).toEqual({
        meetingId: meeting.id,
        status: "MAYBE",
      }),
    );
    await vi.waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Maybe" }).getAttribute("aria-pressed"),
      ).toBe("true"),
    );
  });

  it("shows why an RSVP didn't save", async () => {
    vi.mocked(setRsvp).mockRejectedValue(new Error("This meeting is over"));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "I'm in" }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "This meeting is over",
    );
  });

  it("hides the RSVP buttons once the meeting is over", async () => {
    vi.mocked(getMeeting).mockResolvedValue(
      testMeeting({
        start: new Date("2020-01-01T19:00:00"),
        end: new Date("2020-01-01T21:00:00"),
      }),
    );
    renderPage();
    expect(await screen.findByText("This meeting is over.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "I'm in" })).toBeNull();
  });

  it("counts guests in the head count", async () => {
    vi.mocked(getMeetingRsvps).mockResolvedValue(
      testRsvps({
        rsvps: [
          testRsvp("Priya", "YES", 1, { guestCount: 2 }),
          testRsvp("Jen", "YES", 2),
        ],
      }),
    );
    renderPage();
    const heading = await screen.findByRole("heading", { name: /Going/ });
    expect(heading.textContent).toBe("Going 4");
    const going = heading.parentElement as HTMLElement;
    expect(within(going).getAllByRole("listitem").map((li) => li.lastElementChild?.textContent))
      .toEqual(["Priya Reader +2 guests", "Jen Reader"]);
  });

  it("lists what people are bringing, leaving out anyone who can't come", async () => {
    vi.mocked(getMeetingRsvps).mockResolvedValue(
      testRsvps({
        rsvps: [
          testRsvp("Priya", "YES", 1, { dish: "Lemon bars" }),
          testRsvp("Dani", "MAYBE", 2, { dish: "Cheese plate" }),
          testRsvp("Jen", "NO", 3, { dish: "Old dish" }),
          testRsvp("Sam", "YES", 4),
        ],
      }),
    );
    renderPage();
    const menu = await screen.findByRole("region", { name: "On the menu" });
    expect(within(menu).getAllByRole("listitem").map((li) => li.textContent))
      .toEqual(["Lemon barsPriya Reader", "Cheese plateDani Reader (maybe)"]);
  });

  it("leaves out the menu when no one is bringing anything", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Circe" });
    expect(screen.queryByRole("region", { name: "On the menu" })).toBeNull();
  });

  it("asks a member who's coming what they're bringing, filled in from before", async () => {
    vi.mocked(getMeetingRsvps).mockResolvedValue(
      testRsvps({
        myStatus: "YES",
        rsvps: [
          {
            ...testRsvp("Ada", "YES", 1, { dish: "Lemon bars", guestCount: 1 }),
            member: { id: testUser().id, firstName: "Ada", lastName: "Reader", image: null },
          },
        ],
      }),
    );
    vi.mocked(setRsvp).mockResolvedValue(testRsvps({ myStatus: "YES" }));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Change" }));
    const dish = screen.getByLabelText(/Bringing food/) as HTMLInputElement;
    expect(dish.value).toBe("Lemon bars");
    expect((screen.getByLabelText("Guests") as HTMLInputElement).value).toBe("1");

    fireEvent.change(dish, { target: { value: "Brownies" } });
    fireEvent.change(screen.getByLabelText("Guests"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() =>
      expect(vi.mocked(setRsvp).mock.calls[0][0]).toEqual({
        meetingId: meeting.id,
        status: "YES",
        dish: "Brownies",
        guestCount: 2,
      }),
    );
    expect((await screen.findByRole("status")).textContent).toBe("Saved");
  });

  it("shows an earlier answer as one line until they change it", async () => {
    vi.mocked(getMeetingRsvps).mockResolvedValue(
      testRsvps({
        myStatus: "YES",
        rsvps: [
          {
            ...testRsvp("Ada", "YES", 1, { dish: "Lemon bars", guestCount: 1 }),
            member: { id: testUser().id, firstName: "Ada", lastName: "Reader", image: null },
          },
        ],
      }),
    );
    renderPage();
    const summary = await screen.findByText("You're going");
    expect(summary.parentElement?.textContent).toBe(
      "You're going · bringing Lemon bars · +1 guest",
    );
    expect(screen.queryByRole("button", { name: "I'm in" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    expect(screen.getByRole("button", { name: /I'm in/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.getByText("You're going")).toBeTruthy();
  });

  it("stays open after a first answer, so they can add food", async () => {
    vi.mocked(setRsvp).mockResolvedValue(testRsvps({ myStatus: "YES" }));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "I'm in" }));
    expect(await screen.findByLabelText(/Bringing food/)).toBeTruthy();
    expect(screen.queryByText("You're going")).toBeNull();
  });

  it("doesn't ask about food before they've said they're coming", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Circe" });
    expect(screen.queryByLabelText(/Bringing food/)).toBeNull();
  });

  it("shows the craft when there is one", async () => {
    vi.mocked(getMeeting).mockResolvedValue(
      testMeeting({ craft: "Pressed-flower bookmarks.\n\nBring a few flowers." }),
    );
    renderPage();
    const craft = await screen.findByRole("region", { name: "Craft" });
    expect(within(craft).getAllByRole("paragraph").map((p) => p.textContent))
      .toEqual(["Pressed-flower bookmarks.", "Bring a few flowers."]);
  });

  it("maps the venue and links to directions", async () => {
    renderPage();
    const section = await screen.findByRole("region", { name: "Getting there" });
    const map = within(section).getByTitle("Map of Priya's place");
    const query = encodeURIComponent("Priya's place, 14 Elm St, Springfield, IL 62701");
    expect(map.getAttribute("src")).toBe(
      `https://maps.google.com/maps?q=${query}&output=embed`,
    );
    expect(
      within(section).getByRole("link", { name: "Get directions" }).getAttribute("href"),
    ).toBe(`https://www.google.com/maps/dir/?api=1&destination=${query}`);
  });

  it("leaves out the map until there's a venue", async () => {
    vi.mocked(getMeeting).mockResolvedValue(
      testMeeting({ venue: null, venueId: null }),
    );
    renderPage();
    await screen.findByRole("heading", { name: "Circe" });
    expect(screen.queryByRole("region", { name: "Getting there" })).toBeNull();
  });

  it("links admins to the edit page", async () => {
    mockSession(testUser({ isAdmin: true }));
    renderPage();
    expect(
      (await screen.findByRole("link", { name: "Edit meeting" })).getAttribute(
        "href",
      ),
    ).toBe(`/meetings/${meeting.id}/edit`);
  });

  it("doesn't show members the edit link", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Circe" });
    expect(screen.queryByRole("link", { name: "Edit meeting" })).toBeNull();
  });

  describe("cancelling", () => {
    const cancelled = { ...meeting, cancelledAt: new Date("2099-11-01T12:00:00"), book: null, bookId: null };

    it("asks admins before cancelling, and can back out", async () => {
      mockSession(testUser({ isAdmin: true }));
      vi.mocked(cancelMeeting).mockResolvedValue(cancelled);
      renderPage();
      fireEvent.click(await screen.findByRole("button", { name: "Cancel meeting" }));
      expect(screen.getByText(/Circe goes back to the suggestions/)).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Keep it" }));
      expect(cancelMeeting).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: "Cancel meeting" }));
      fireEvent.click(
        within(screen.getByRole("group", { name: "Cancel meeting" })).getByRole("button", {
          name: "Cancel meeting",
        }),
      );
      await vi.waitFor(() => expect(vi.mocked(cancelMeeting).mock.calls[0][0]).toBe(meeting.id));
    });

    it("tells everyone it's cancelled and hides RSVPs, the calendar and directions", async () => {
      vi.mocked(getMeeting).mockResolvedValue(cancelled);
      renderPage();
      expect((await screen.findByRole("status")).textContent).toMatch(/This meeting was cancelled on/);
      expect(screen.getByRole("heading", { name: "Who had answered" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Going" })).toBeNull();
      expect(screen.queryByRole("group", { name: "Add to your calendar" })).toBeNull();
      expect(screen.queryByRole("heading", { name: "Getting there" })).toBeNull();
    });

    it("lets admins restore it", async () => {
      mockSession(testUser({ isAdmin: true }));
      vi.mocked(getMeeting).mockResolvedValue(cancelled);
      vi.mocked(restoreMeeting).mockResolvedValue(meeting);
      renderPage();
      fireEvent.click(await screen.findByRole("button", { name: "Restore meeting" }));
      await vi.waitFor(() => expect(vi.mocked(restoreMeeting).mock.calls[0][0]).toBe(meeting.id));
      // A cancelled meeting can't be edited until it's restored.
      expect(screen.queryByRole("link", { name: "Edit meeting" })).toBeNull();
    });
  });

  it("offers admins a WhatsApp RSVP reminder", async () => {
    mockSession(testUser({ isAdmin: true }));
    renderPage();
    const href =
      (await screen.findByRole("link", { name: "Remind on WhatsApp" })).getAttribute("href") ?? "";
    const text = decodeURIComponent(href.slice("https://wa.me/?text=".length));
    expect(text.split("\n")).toEqual([
      "*📅 RSVP to the next meeting!*",
      "*Circe* by _Madeline Miller_",
      expect.stringMatching(/^\w+day, Nov 13 · 7:00\sPM$/),
      "Priya's place",
      "",
      `👉 ${window.location.origin}/meetings/${meeting.id}`,
    ]);
  });

  it("copies the reminder for pasting, since WhatsApp Desktop can drop the text", async () => {
    mockSession(testUser({ isAdmin: true }));
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Copy message" }));
    await vi.waitFor(() => expect(writeText.mock.calls[0][0]).toMatch(/^\*📅 RSVP to the next meeting!\*/));
    expect(await screen.findByRole("button", { name: "Copied!" })).toBeTruthy();
  });

  describe("adding to a calendar", () => {
    it("links to Google Calendar with the meeting's details", async () => {
      renderPage();
      const google = await screen.findByRole("link", { name: "Google" });
      const url = new URL(google.getAttribute("href") ?? "");
      expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render");
      expect(url.searchParams.get("text")).toBe(meeting.title);
      expect(url.searchParams.get("dates")).toBe(
        `${meeting.start.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}/${meeting.end
          .toISOString()
          .replace(/[-:]/g, "")
          .replace(/\.\d{3}/, "")}`,
      );
      expect(url.searchParams.get("location")).toContain("14 Elm St");
      expect(url.searchParams.get("details")).toContain("Circe by Madeline Miller");
    });

    it("offers a calendar file for Apple and Outlook", async () => {
      renderPage();
      expect(await screen.findByRole("button", { name: "Apple or Outlook" })).toBeTruthy();
    });
  });
});
