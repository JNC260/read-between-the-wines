// Notification emails, against a real test database:
//   npx nx test-db backend
// Email itself is faked; who gets what, and only once, is real.
import { prisma } from "../lib/prisma";
import { type Email } from "../lib/email";
import {
  createBook,
  createMeeting,
  createPollRow,
  createUser,
  createVotes,
  resetDb,
} from "../test/db";
import { startApi } from "../test/http";
import { unsubscribeApiUrl } from "./notifications.links";
import { notifyNewPoll, sendDueReminders } from "./notifications.service";

vi.mock("../middleware/auth", () => import("../test/mock-auth"));
const sent: Email[] = [];
const sendEmail = vi.fn(async (email: Email) => {
  sent.push(email);
});
vi.mock("../lib/email", () => ({ sendEmail: (email: Email) => sendEmail(email) }));

let api: Awaited<ReturnType<typeof startApi>>;

beforeAll(async () => {
  api = await startApi();
});

afterAll(async () => {
  await api.close();
  await prisma.$disconnect();
});

type User = Awaited<ReturnType<typeof createUser>>;

let ada: User;
let ben: User;

beforeEach(async () => {
  await resetDb();
  sent.length = 0;
  sendEmail.mockClear();
  ada = await createUser({ firstName: "Ada" });
  ben = await createUser({ firstName: "Ben" });
});

const HOUR = 60 * 60 * 1000;
const hoursFromNow = (h: number) => new Date(Date.now() + h * HOUR);
const to = () => sent.map((e) => e.to).sort();
const emailOf = (u: User) => u.email;

const twoBooks = async () => [
  await createBook({ title: "Circe", suggestedBy: ada.id }),
  await createBook({ title: "Piranesi", suggestedBy: ben.id }),
];

describe("new poll emails", () => {
  it("go to every active member, once", async () => {
    const books = await twoBooks();
    const poll = await createPollRow({ bookIds: books.map((b) => b.id), votesPerMember: 1 });
    await notifyNewPoll(poll.id);
    await notifyNewPoll(poll.id);

    expect(to()).toEqual([emailOf(ada), emailOf(ben)].sort());
    expect(sent[0].subject).toBe("A new book poll is open");
    expect(sent[0].html).toContain("Voting closes");
    expect(sent[0].html).toContain(`/polls/${poll.id}`);
    // The greeting uses their name.
    expect(sent.find((e) => e.to === emailOf(ada))?.html).toContain("Hi Ada!");
  });

  it("skip members who opted out, and inactive or banned accounts", async () => {
    await prisma.user.update({ where: { id: ada.id }, data: { emailOptOuts: ["NEW_POLL"] } });
    const gone = await createUser({ firstName: "Gone" });
    await prisma.user.update({ where: { id: gone.id }, data: { status: "INACTIVE" } });
    const banned = await createUser({ firstName: "Banned" });
    await prisma.user.update({ where: { id: banned.id }, data: { status: "BANNED" } });

    const books = await twoBooks();
    const poll = await createPollRow({ bookIds: books.map((b) => b.id), votesPerMember: 1 });
    await notifyNewPoll(poll.id);
    expect(to()).toEqual([emailOf(ben)]);
  });

  it("never break out of a style attribute", async () => {
    const books = await twoBooks();
    const poll = await createPollRow({ bookIds: books.map((b) => b.id), votesPerMember: 1 });
    await notifyNewPoll(poll.id);
    for (const style of sent[0].html.match(/style="[^"]*"/g) ?? []) {
      expect(style.endsWith(';"') || /[a-z0-9)%]"$/.test(style)).toBe(true);
    }
    // A double quote inside a font name would end the attribute early.
    expect(sent[0].html).not.toMatch(/style="[^"]*"[A-Za-z ]+",/);
  });

  it("escape what members typed", async () => {
    await prisma.user.update({ where: { id: ada.id }, data: { firstName: "<b>Ada</b>" } });
    const books = await twoBooks();
    const poll = await createPollRow({ bookIds: books.map((b) => b.id), votesPerMember: 1 });
    await notifyNewPoll(poll.id);
    const html = sent.find((e) => e.to === emailOf(ada))?.html ?? "";
    expect(html).toContain("&lt;b&gt;Ada&lt;/b&gt;");
    expect(html).not.toContain("<b>Ada</b>");
  });

  it("are retried later if a send fails", async () => {
    const books = await twoBooks();
    const poll = await createPollRow({ bookIds: books.map((b) => b.id), votesPerMember: 1 });
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    sendEmail.mockRejectedValueOnce(new Error("Resend is down"));
    await notifyNewPoll(poll.id);
    expect(sent).toHaveLength(1);
    await notifyNewPoll(poll.id);
    expect(sent).toHaveLength(2);
    expect(to()).toEqual([emailOf(ada), emailOf(ben)].sort());
    logged.mockRestore();
  });
});

describe("vote reminders", () => {
  it("go a day before closing, only to members who haven't voted, once", async () => {
    const books = await twoBooks();
    const poll = await createPollRow({
      bookIds: books.map((b) => b.id),
      votesPerMember: 1,
      opensAt: hoursFromNow(-72),
      closesAt: hoursFromNow(20),
    });
    await createVotes(poll.id, ada.id, [books[0].id]);

    await sendDueReminders();
    await sendDueReminders();
    expect(to()).toEqual([emailOf(ben)]);
    expect(sent[0].subject).toBe("Don't forget to vote");
    expect(sent[0].html).toContain("Don't forget to vote!");
  });

  it("wait until the last day, and skip polls only open a day", async () => {
    const books = await twoBooks();
    await createPollRow({ bookIds: books.map((b) => b.id), votesPerMember: 1, closesAt: hoursFromNow(30) });
    await sendDueReminders();
    expect(sent).toHaveLength(0);

    await resetDb();
    ada = await createUser({ firstName: "Ada" });
    const more = [
      await createBook({ title: "A", suggestedBy: ada.id }),
      await createBook({ title: "B", suggestedBy: ada.id }),
    ];
    await createPollRow({
      bookIds: more.map((b) => b.id),
      votesPerMember: 1,
      opensAt: hoursFromNow(-2),
      closesAt: hoursFromNow(12),
    });
    await sendDueReminders();
    expect(sent).toHaveLength(0);
  });
});

describe("meeting reminders", () => {
  it("ask members who haven't answered to RSVP, a day ahead", async () => {
    const meeting = await createMeeting({ title: "November", start: hoursFromNow(20) });
    await prisma.rsvp.create({ data: { userId: ada.id, meetingId: meeting.id, status: "NO" } });

    await sendDueReminders();
    expect(to()).toEqual([emailOf(ben)]);
    expect(sent[0].subject).toBe("Are you coming tomorrow? November");
    expect(sent[0].html).toContain("Please let us know if you're coming.");
  });

  it("remind members going or maybe, nudging those who haven't said what food", async () => {
    const meeting = await createMeeting({ title: "November", start: hoursFromNow(20) });
    await prisma.rsvp.create({ data: { userId: ada.id, meetingId: meeting.id, status: "YES", dish: "Salad" } });
    await prisma.rsvp.create({ data: { userId: ben.id, meetingId: meeting.id, status: "MAYBE" } });

    await sendDueReminders();
    const byTo = Object.fromEntries(sent.map((e) => [e.to, e]));
    expect(byTo[emailOf(ada)].subject).toBe("See you tomorrow: November");
    expect(byTo[emailOf(ada)].html).not.toContain("Add what you're bringing");
    expect(byTo[emailOf(ben)].html).toContain("Add what you're bringing");
  });

  it("skip cancelled meetings and ones more than a day away", async () => {
    const cancelled = await createMeeting({ start: hoursFromNow(20) });
    await prisma.meeting.update({ where: { id: cancelled.id }, data: { cancelledAt: new Date() } });
    await createMeeting({ start: hoursFromNow(30) });
    await sendDueReminders();
    expect(sent).toHaveLength(0);
  });
});

describe("POST /notifications/unsubscribe", () => {
  const unsubscribe = (url: string) => api.request("POST", url.replace(/^.*\/api/, ""), {});

  it("turns off one kind from the signed link, without signing in", async () => {
    const res = await unsubscribe(unsubscribeApiUrl(ada.id, "VOTE_REMINDER"));
    expect(res.status).toBe(204);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: ada.id } });
    expect(user.emailOptOuts).toEqual(["VOTE_REMINDER"]);
  });

  it("turns off everything with ALL", async () => {
    await unsubscribe(unsubscribeApiUrl(ada.id, "ALL"));
    const user = await prisma.user.findUniqueOrThrow({ where: { id: ada.id } });
    expect([...user.emailOptOuts].sort()).toEqual(
      ["MEETING_REMINDER", "NEW_POLL", "RSVP_REMINDER", "VOTE_REMINDER"],
    );
  });

  it("rejects a link changed to someone else or another kind", async () => {
    const forAda = unsubscribeApiUrl(ada.id, "VOTE_REMINDER");
    expect((await unsubscribe(forAda.replace(ada.id, ben.id))).status).toBe(404);
    expect((await unsubscribe(forAda.replace("VOTE_REMINDER", "ALL"))).status).toBe(404);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: ben.id } });
    expect(user.emailOptOuts).toEqual([]);
  });

  it("puts a one-click unsubscribe header on every email", async () => {
    const books = await twoBooks();
    const poll = await createPollRow({ bookIds: books.map((b) => b.id), votesPerMember: 1 });
    await notifyNewPoll(poll.id);
    expect(sent[0].headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(sent[0].headers?.["List-Unsubscribe"]).toMatch(/\/api\/notifications\/unsubscribe\?u=/);
  });
});

describe("GET and PUT /users/me/notifications", () => {
  it("starts with every email on, and saves the whole list each time", async () => {
    expect((await api.request("GET", "/users/me/notifications", { as: ada })).body).toEqual({
      emailOptOuts: [],
    });
    const off = await api.request("PUT", "/users/me/notifications", {
      as: ada,
      body: { emailOptOuts: ["NEW_POLL", "VOTE_REMINDER"] },
    });
    expect(off.body.emailOptOuts).toEqual(["NEW_POLL", "VOTE_REMINDER"]);
    const back = await api.request("PUT", "/users/me/notifications", {
      as: ada,
      body: { emailOptOuts: ["NEW_POLL"] },
    });
    expect(back.body.emailOptOuts).toEqual(["NEW_POLL"]);
  });

  it("rejects kinds that don't exist", async () => {
    const res = await api.request("PUT", "/users/me/notifications", {
      as: ada,
      body: { emailOptOuts: ["EVERYTHING"] },
    });
    expect(res.status).toBe(400);
  });

  it("isn't part of the member list everyone sees", async () => {
    await prisma.user.update({ where: { id: ada.id }, data: { emailOptOuts: ["NEW_POLL"] } });
    const list = await api.request("GET", "/users", { as: ben });
    expect(list.body[0]).not.toHaveProperty("emailOptOuts");
  });
});
