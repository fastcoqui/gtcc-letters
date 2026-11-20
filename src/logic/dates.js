/** Business-day suspense. Weekends and the configured federal holidays are skipped. */

export const DEFAULT_HOLIDAYS = [
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-05-25', '2026-06-19', '2026-07-03',
  '2026-09-07', '2026-10-12', '2026-11-11', '2026-11-26', '2026-12-25',
  '2027-01-01', '2027-01-18', '2027-02-15', '2027-05-31', '2027-06-18', '2027-07-05',
  '2027-09-06', '2027-10-11', '2027-11-11', '2027-11-25', '2027-12-24',
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function parseISODate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? '').trim());
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

export function formatISODate(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function milDate(iso) {
  const date = parseISODate(iso);
  if (!date) return '';
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/**
 * Add n business days after `iso`, not counting the start date.
 * Mirrors VBA AddBusinessDays: step forward one day at a time, skip Sat/Sun and holidays.
 */
export function addBusinessDays(iso, days, holidays = DEFAULT_HOLIDAYS) {
  const start = parseISODate(iso);
  const n = Number(days);
  if (!start || !Number.isFinite(n) || n <= 0) return iso || '';
  const skip = new Set((holidays || []).map((h) => String(h).trim()));
  let left = Math.trunc(n);
  let cursor = start;
  let guard = 0;
  while (left > 0 && guard < 4000) {
    guard += 1;
    cursor = new Date(cursor.getTime() + 86400000);
    const dow = cursor.getUTCDay();
    const key = formatISODate(cursor);
    if (dow !== 0 && dow !== 6 && !skip.has(key)) left -= 1;
  }
  return formatISODate(cursor);
}

export function parseHolidayText(text) {
  return String(text ?? '')
    .split(/[\s,;]+/)
    .map((part) => part.trim())
    .filter((part) => /^\d{4}-\d{2}-\d{2}$/.test(part));
}
