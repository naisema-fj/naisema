/**
 * Today's date where it is latest on Earth (UTC+14), as YYYY-MM-DD. Dates staff enter, such as a
 * recording or a link check, are refused as "in the future" only past this, so someone in Fiji
 * (UTC+12) or Aotearoa New Zealand (UTC+13 in summer) can always enter their own today.
 */
export const latestToday = (now = new Date()) => new Date(now.getTime() + 14 * 3_600_000).toISOString().slice(0, 10);

/**
 * Today's date in Fiji (UTC+12, no daylight saving), as YYYY-MM-DD: the calendar NAISEMA's own
 * agreements are dated in, so one starts and ends on Fiji's days.
 */
export const fijiToday = (now = new Date()) => new Date(now.getTime() + 12 * 3_600_000).toISOString().slice(0, 10);

/** A moment as a visitor reads the day it fell on in Fiji: "2 October 2026". */
export const fijiDateText = (date: Date) =>
  new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "Pacific/Fiji" }).format(
    date,
  );
