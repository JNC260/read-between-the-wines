// US numbers only. Stored as E.164 (+15551234567) so every number looks the
// same in the database however it was typed; shown as (555) 123-4567.

const digitsOf = (input: string) => {
  const digits = input.replace(/\D/g, "");
  // A leading 1 is the country code, not part of the number.
  return digits.length === 11 && digits.startsWith("1")
    ? digits.slice(1)
    : digits;
};

// "+15551234567" for anything with exactly ten digits (eleven with a leading
// 1), whatever the punctuation. Null otherwise.
export function normalizePhone(input: string): string | null {
  const digits = digitsOf(input);
  return digits.length === 10 ? `+1${digits}` : null;
}

// For an input as it's typed: "555" stays "555", "5551" becomes "(555) 1",
// and so on up to "(555) 123-4567". Also formats a stored "+15551234567".
// Extra digits past ten are dropped.
export function formatPhone(input: string): string {
  const digits = (
    input.startsWith("+1") ? input.slice(2) : digitsOf(input)
  ).replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) {
    return digits;
  }
  const area = `(${digits.slice(0, 3)}) `;
  if (digits.length <= 6) {
    return area + digits.slice(3);
  }
  return `${area}${digits.slice(3, 6)}-${digits.slice(6)}`;
}
