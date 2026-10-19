/** Match server leave-memo working-day rules for accrual preview. */

export type LeaveHoliday = { month: number; day: number }

function monthDayKey(month: number, day: number): string {
  return `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseUtcDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

function formatUtcDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isWorkingDay(
  date: Date,
  holidayKeys: Set<string>,
  saturdayWorking: boolean,
): boolean {
  const weekday = date.getUTCDay();
  if (weekday === 0) return false;
  if (!saturdayWorking && weekday === 6) return false;
  const key = monthDayKey(date.getUTCMonth() + 1, date.getUTCDate());
  return !holidayKeys.has(key);
}

/** Last working day strictly before `yyyy-mm-dd`, or null if input is invalid. */
export function lastWorkingDayBeforeIso(
  startIso: string,
  holidays: LeaveHoliday[],
  saturdayWorking = true,
): string | null {
  const start = parseUtcDate(startIso);
  if (!start) return null;
  const keys = new Set(
    holidays.map((holiday) => monthDayKey(holiday.month, holiday.day)),
  );
  const cursor = new Date(start.getTime());
  cursor.setUTCDate(cursor.getUTCDate() - 1);
  for (let guard = 0; guard < 400; guard += 1) {
    if (isWorkingDay(cursor, keys, saturdayWorking)) {
      return formatUtcDate(cursor);
    }
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return null;
}
