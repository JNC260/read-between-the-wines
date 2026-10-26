// datetime-local wants "YYYY-MM-DDTHH:mm" in local time, with no zone.
// new Date() reads that format back as local time, so the two round-trip.
const pad = (n: number) => String(n).padStart(2, "0");

export const toLocalInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
  `T${pad(d.getHours())}:${pad(d.getMinutes())}`;
