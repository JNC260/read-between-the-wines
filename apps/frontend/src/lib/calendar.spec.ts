import { testMeeting } from "../test/fixtures";
import { icsFile } from "./calendar";

describe("icsFile", () => {
  const meeting = testMeeting({
    title: "November: Circe; snacks, too",
    start: new Date("2099-11-13T19:00:00Z"),
    end: new Date("2099-11-13T21:00:00Z"),
    description: "Bring a snack.\nOr two.",
  });
  const lines = () => icsFile(meeting).split("\r\n");

  it("is one event, in UTC, with the same UID every time", () => {
    const ics = icsFile(meeting);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(lines()).toContain("DTSTART:20991113T190000Z");
    expect(lines()).toContain("DTEND:20991113T210000Z");
    expect(lines()).toContain(`UID:${meeting.id}@readbetweenthewines`);
  });

  it("escapes commas and semicolons in text", () => {
    expect(lines()).toContain(String.raw`SUMMARY:November: Circe\; snacks\, too`);
  });

  it("keeps every line within 75 characters", () => {
    expect(lines().every((line) => line.length <= 75)).toBe(true);
  });
});
