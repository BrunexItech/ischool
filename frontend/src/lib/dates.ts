/** The local calendar date as YYYY-MM-DD. `toISOString().slice(0, 10)` is the
 * UTC date, which is still "yesterday" in Kenya until 03:00 — so a register
 * opened at 01:00 would be filed under the wrong day. */
export function localDateStr(d: Date = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Add (or subtract) whole days to a YYYY-MM-DD string, staying in local time. */
export function addDaysStr(dateStr: string, days: number) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return localDateStr(new Date(y, m - 1, d + days));
}
