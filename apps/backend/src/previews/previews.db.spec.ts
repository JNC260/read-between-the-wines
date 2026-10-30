// What meeting and poll links' preview cards say. Run with
//   npx nx test-db backend
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import { createBook, createClosedPollRow, createMeeting, createPollRow, createVenue, resetDb } from "../test/db";
import { previewFor } from "./previews.service";

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDb();
});

const HOUR = 60 * 60 * 1000;

describe("previewFor", () => {
  it("shows a meeting's book, date and a nudge to RSVP, never the address", async () => {
    const book = await createBook({ title: "Circe" });
    await prisma.book.update({ where: { id: book.id }, data: { coverUrl: "https://covers.example/c.jpg" } });
    const venue = await createVenue("Priya's place");
    const meeting = await createMeeting({ bookId: book.id, venueId: venue.id, start: new Date(Date.now() + 48 * HOUR) });

    const preview = await previewFor(`/meetings/${meeting.id}`);
    expect(preview?.title).toMatch(/^Circe · \w{3}, \w{3} \d+$/);
    expect(preview?.description).toMatch(/^RSVP to the next meeting!/);
    expect(preview?.image).toBe("https://covers.example/c.jpg");
    expect(preview?.url).toMatch(new RegExp(`/meetings/${meeting.id}$`));
    expect(JSON.stringify(preview)).not.toContain("Priya");
  });

  it("says when a meeting was cancelled", async () => {
    const meeting = await createMeeting({ start: new Date(Date.now() + 48 * HOUR) });
    await prisma.meeting.update({ where: { id: meeting.id }, data: { cancelledAt: new Date() } });
    expect((await previewFor(`/meetings/${meeting.id}`))?.description).toBe("This meeting was cancelled.");
  });

  it("asks people to vote on an open poll, and says when it closes", async () => {
    const a = await createBook();
    const b = await createBook();
    const poll = await createPollRow({ bookIds: [a.id, b.id], votesPerMember: 1 });
    const preview = await previewFor(`/polls/${poll.id}`);
    expect(preview?.title).toBe("Vote for what we read next!");
    expect(preview?.description).toMatch(/^Voting closes /);
  });

  it("points to the results once a poll has closed", async () => {
    const a = await createBook();
    const b = await createBook();
    const poll = await createClosedPollRow({ bookIds: [a.id, b.id], votesPerMember: 1 });
    expect((await previewFor(`/polls/${poll.id}`))?.title).toBe("The votes are in");
  });

  it("keeps the site's card for other pages and unknown ids", async () => {
    expect(await previewFor("/books/suggestions")).toBeNull();
    expect(await previewFor(`/meetings/${randomUUID()}`)).toBeNull();
    expect(await previewFor(`/meetings/${randomUUID()}/edit`)).toBeNull();
    expect(await previewFor("/meetings/not-an-id")).toBeNull();
  });
});
