import { fireEvent, screen } from "@testing-library/react";
import { createMeeting, getVenues } from "../api";
import { renderRoutes, Route } from "../test-utils";
import NewEventPage from "./NewEventPage";

vi.mock("../api", () => ({ createMeeting: vi.fn(), getVenues: vi.fn() }));

const VENUE_ID = "00000000-0000-4000-8000-000000000003";

const renderPage = () =>
  renderRoutes(
    "/events/new",
    <>
      <Route path="/events/new" element={<NewEventPage />} />
      <Route path="/events" element="events page" />
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
  fireEvent.click(screen.getByRole("button", { name: "Create event" }));

describe("NewEventPage", () => {
  beforeEach(() => {
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

  it("creates the event in local time and goes to the events list", async () => {
    vi.mocked(createMeeting).mockResolvedValue({} as never);
    renderPage();
    fillForm();
    await screen.findByRole("option", { name: "Ada's house" });
    fill("Venue", VENUE_ID);
    fill("Description", "Bring a snack");
    submit();
    expect(await screen.findByText("events page")).toBeTruthy();
    expect(vi.mocked(createMeeting).mock.calls[0][0]).toEqual({
      title: "November: Piranesi",
      start: new Date("2030-11-04T19:00"),
      end: new Date("2030-11-04T21:00"),
      venueId: VENUE_ID,
      description: "Bring a snack",
    });
  });

  it("sends no venue or description when they're left blank", async () => {
    vi.mocked(createMeeting).mockResolvedValue({} as never);
    renderPage();
    fillForm();
    submit();
    await screen.findByText("events page");
    expect(vi.mocked(createMeeting).mock.calls[0][0]).toMatchObject({
      venueId: null,
      description: null,
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
});
