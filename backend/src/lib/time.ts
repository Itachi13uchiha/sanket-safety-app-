export const MIN = 60_000;
export const HOUR = 3_600_000;
export const DAY = 86_400_000;

const pad = (n: number) => String(n).padStart(2, '0');

/** Wall-clock parts for an instant in the configured fixed-offset timezone. */
export function localParts(ms: number, offsetMin: number) {
  const d = new Date(ms + offsetMin * MIN);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return { dateKey: `${y}-${pad(m)}-${pad(day)}`, hour: d.getUTCHours(), dow: d.getUTCDay() };
}

export function startOfLocalDay(ms: number, offsetMin: number): number {
  const local = ms + offsetMin * MIN;
  return Math.floor(local / DAY) * DAY - offsetMin * MIN;
}

/** The last `days` local date keys, oldest first, ending today. */
export function lastDateKeys(nowMs: number, days: number, offsetMin: number): string[] {
  const today = startOfLocalDay(nowMs, offsetMin);
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) keys.push(localParts(today - i * DAY + 12 * HOUR, offsetMin).dateKey);
  return keys;
}

export function hourLabel(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display} ${h >= 12 ? 'PM' : 'AM'}`;
}

export const windowLabel = (startHour: number, endHour: number) =>
  `${hourLabel(startHour)} – ${hourLabel(endHour)}`;

/** Three-hour blocks: 0 => 12AM-3AM … 7 => 9PM-12AM. */
export const blockOf = (hour: number) => Math.floor(hour / 3);
