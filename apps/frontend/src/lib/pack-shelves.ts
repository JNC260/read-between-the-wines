// Splits a year's spines into shelves, left to right like a bookcase: a
// spine that won't fit on this shelf starts the next one. widths are the
// spines' widths in px; room is how wide a shelf is. Always at least one
// shelf, and a spine wider than the room still gets a shelf of its own.
export const packShelves = <T,>(
  items: T[],
  widthOf: (item: T) => number,
  room: number,
  gap: number,
): T[][] => {
  if (!(room > 0)) {
    return [items];
  }
  const shelves: T[][] = [[]];
  let used = 0;
  for (const item of items) {
    const width = widthOf(item);
    const current = shelves[shelves.length - 1];
    const needed = current.length === 0 ? width : used + gap + width;
    if (current.length > 0 && needed > room) {
      shelves.push([item]);
      used = width;
    } else {
      current.push(item);
      used = needed;
    }
  }
  return shelves;
};
