import { app } from "./app";
import { config } from "./lib/config";
import { prisma } from "./lib/prisma";
import { startReminderSchedule } from "./notifications/notifications.schedule";

// Railway sets PORT; locally it's 3333, where Vite's proxy expects it.
const server = app.listen(config.PORT, () => {
  console.log(`Listening on port ${config.PORT} (${config.NODE_ENV})`);
});
server.on("error", console.error);

const stopReminders = startReminderSchedule();

const shutdown = () => {
  stopReminders();
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
