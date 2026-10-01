/**
 * Today's date where it is latest on Earth (UTC+14), as YYYY-MM-DD. Dates staff enter, such as a
 * recording or a link check, are refused as "in the future" only past this, so someone in Fiji
 * (UTC+12) or Aotearoa New Zealand (UTC+13 in summer) can always enter their own today.
 */
export const latestToday = (now = new Date()) => new Date(now.getTime() + 14 * 3_600_000).toISOString().slice(0, 10);
