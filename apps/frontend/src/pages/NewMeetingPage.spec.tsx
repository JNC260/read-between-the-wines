import { fireEvent, screen, within } from "@testing-library/react";
import { createMeeting, createVenue, getBookSuggestions, getVenues } from "../api";
import { renderRoutes, Route } from "../test-utils";
import NewMeetingPage from "./NewMeetingPage";

vi.mock("../api", () => ({
  createMeeting: vi.fn(),
  createVenue: vi.fn(),
  getBookSuggestions: vi.fn(),
  getVenues: vi.fn(),
}));

const VENUE_ID = "00000000-0000-4000-8000-000000000003";

const renderPage = () =>
  renderRoutes(
    "/meetings/new",
    <>
      <Route path="/meetings/new" element={<NewMeetingPage />} />
      <Route path="/meetings" element="meetings page" />
    </>,
  );

const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const fillForm = (end = "2030-11-04T21:00") => {
  fill("Title", "November: Piranesi");
  fill("Starts", "2030-11-04T19:00");
  fill("Ends", end);
};

const submit = () =>
  fireEvent.click(screen.getByRole("button", { name: "Create meeting" }));

describe("NewMeetingPage", () => {
  beforeEach(() => {
    vi.mocked(getBookSuggestions).mockResolvedValue([]);
    vi.mocked(getVenues).mockResolvedValue([
      {
        id: VENUE_ID,
        name: "Ada's house",
        streetAddress: "1 Main St",
        city: "Springfield",
        state: "IL",
        zip: "62701",
      },
    ]);
  });

  it("creates the meeting in local time and goes to the meetings list", async () => {
    vi.mocked(createMeeting).mockResolvedValue({} as never);
    renderPage();
    fillForm();
    await screen.findByRole("option", { name: "Ada's house" });
    fill("Venue", VENUE_ID);
    fill("Description", "Bring a snack");
    fill("Craft", "Bookmarks: bring old magazines");
    submit();
    expect(await screen.findByText("meetings page")).toBeTruthy();
    expect(vi.mocked(createMeeting).mock.calls[0][0]).toEqual({
      title: "November: Piranesi",
      start: new Date("2030-11-04T19:00"),
      end: new Date("2030-11-04T21:00"),
      venueId: VENUE_ID,
      bookId: null,
      description: "Bring a snack",
      craft: "Bookmarks: bring old magazines",
    });
  });

  it("sends no venue, description or craft when they're left blank", async () => {
    vi.mocked(createMeeting).mockResolvedValue({} as never);
    renderPage();
    fillForm();
    submit();
    await screen.findByText("meetings page");
    expect(vi.mocked(createMeeting).mock.calls[0][0]).toMatchObject({
      venueId: null,
      description: null,
      craft: null,
    });
  });

  // An earlier end is blocked by the browser (min={start}); the same time
  // gets past that, so the schema has to catch it.
  it("explains an end that isn't after the start without calling the API", () => {
    renderPage();
    fillForm("2030-11-04T19:00");
    submit();
    expect(screen.getByRole("alert").textContent).toBe(
      "End must be after start",
    );
    expect(createMeeting).not.toHaveBeenCalled();
  });

  it("shows the server's error if creating fails", async () => {
    vi.mocked(createMeeting).mockRejectedValue(new Error("Admins only"));
    renderPage();
    fillForm();
    submit();
    expect((await screen.findByRole("alert")).textContent).toBe("Admins only");
  });

  describe("adding a new venue", () => {
    const NEW_ID = "00000000-0000-4000-8000-000000000004";

    const openNewVenue = async () => {
      renderPage();
      await screen.findByRole("option", { name: "Ada's house" });
      fill("Venue", "new");
    };

    const fillVenue = (zip = "62702") => {
      fill("Venue name", "The Library");
      fill("Street address", "2 Oak Ave");
      fill("City", "Springfield");
      fill("State", "IL");
      fill("ZIP code", zip);
    };

    const saveVenue = () =>
      fireEvent.click(screen.getByRole("button", { name: "Save venue" }));

    it("is the last option in the dropdown", async () => {
      renderPage();
      await screen.findByRole("option", { name: "Ada's house" });
      const options = within(screen.getByLabelText("Venue")).getAllByRole(
        "option",
      );
      expect(options[options.length - 1].textContent).toBe("Add a new venue…");
    });

    it("saves the venue, selects it, and hides the fields", async () => {
      // Like the real API, the refetch after saving includes the new venue.
      vi.mocked(createVenue).mockImplementation(async (body) => {
        const venue = { id: NEW_ID, ...body };
        const existing = await getVenues();
        vi.mocked(getVenues).mockResolvedValue([...existing, venue]);
        return venue;
      });
      await openNewVenue();
      fillVenue();
      saveVenue();
      await vi.waitFor(() =>
        expect(
          (screen.getByLabelText("Venue") as HTMLSelectElement).value,
        ).toBe(NEW_ID),
      );
      expect(
        screen.getByRole("option", { name: "The Library" }),
      ).toBeTruthy();
      expect(screen.queryByLabelText("Venue name")).toBeNull();
      expect(vi.mocked(createVenue).mock.calls[0][0]).toEqual({
        name: "The Library",
        streetAddress: "2 Oak Ave",
        city: "Springfield",
        state: "IL",
        zip: "62702",
      });
    });

    it("shows what's wrong next to each field without calling the API", async () => {
      await openNewVenue();
      fillVenue("nope");
      fill("City", "");
      saveVenue();
      expect(screen.getByText("Invalid ZIP code")).toBeTruthy();
      expect(screen.getByText("Required")).toBeTruthy();
      expect(createVenue).not.toHaveBeenCalled();
    });

    it("goes back to no venue on cancel", async () => {
      await openNewVenue();
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(screen.queryByLabelText("Venue name")).toBeNull();
      expect((screen.getByLabelText("Venue") as HTMLSelectElement).value).toBe(
        "",
      );
    });

    it("won't create the meeting until the venue is saved or cancelled", async () => {
      await openNewVenue();
      fillForm();
      submit();
      expect(screen.getByRole("alert").textContent).toBe(
        "Save or cancel the new venue first.",
      );
      expect(createMeeting).not.toHaveBeenCalled();
    });
  });
});
