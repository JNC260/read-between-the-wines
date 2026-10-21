import * as z from "zod";

// JSON has no Date type: dates travel as ISO strings and become Date objects
// again on the other side. z.encode() goes Date -> string, z.decode() goes
// string -> Date.
export const isoDate = z.codec(z.iso.datetime(), z.date(), {
  decode: (s) => new Date(s),
  encode: (d) => d.toISOString(),
});
