import { sendDueReminders } from "./notifications.service";

const EVERY_MS = 15 * 60 * 1000;
// Not right at startup, so a deploy's health check isn't waiting on email.
const FIRST_RUN_MS = 60 * 1000;

// Checks for reminders every 15 minutes, in the web server itself: one
// Railway service, nothing else to run. Each email goes out once whatever
// happens (see sendDueReminders), so a restart or overlapping run is safe.
export const startReminderSchedule = () => {
  const run = async () => {
    try {
      const sent = await sendDueReminders();
      if (sent > 0) {
        console.log(`Sent ${sent} reminder email${sent === 1 ? "" : "s"}`);
      }
    } catch (e) {
      console.error("Reminder check failed", e);
    }
  };
  const first = setTimeout(run, FIRST_RUN_MS);
  const every = setInterval(run, EVERY_MS);
  // Neither keeps the process alive on shutdown.
  first.unref();
  every.unref();
  return () => {
    clearTimeout(first);
    clearInterval(every);
  };
};
