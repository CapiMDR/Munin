const { getMexicoCityDateParts, getMexicoCityTime, mexicoCityDateTimeToTimestamp } = require("./timeUtils");

const WEEKDAYS = Object.freeze(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]);
const WEEK_MS = 7 * 24 * 60 * 60 * 1_000;

function toIso(timestamp) {
  const date = new Date(timestamp);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  const localAsUtc = Date.UTC(values.year, Number(values.month) - 1, values.day, values.hour, values.minute, values.second);
  const offsetMinutes = Math.round((localAsUtc - timestamp) / 60_000);
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(offsetMinutes);
  const offset = `${sign}${String(Math.floor(absoluteOffset / 60)).padStart(2, "0")}:${String(absoluteOffset % 60).padStart(2, "0")}`;
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}${offset}`;
}

function timestampOf(value) {
  const timestamp = typeof value === "number" ? value : Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function getLocalWeekday(timestamp) {
  const { year, month, day } = getMexicoCityDateParts(new Date(timestamp));
  return WEEKDAYS[(new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7];
}

function getWeekStartDay(timestamp) {
  const { year, month, day } = getMexicoCityDateParts(new Date(timestamp));
  const date = new Date(Date.UTC(year, month - 1, day));
  return getWeekStartForCalendarDate(date);
}

function getWeekStartForCalendarDate(date) {
  const weekStart = new Date(date);
  weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7));
  return weekStart.getTime();
}

function getNextWeeklyTrigger(reminder, afterTimestamp) {
  const recurrence = reminder.recurrence;
  if (recurrence?.frequency !== "week") return undefined;

  const startAt = timestampOf(reminder.startAt);
  const until = recurrence.until ? timestampOf(recurrence.until) : undefined;
  const interval = recurrence.interval || 1;
  const weekdays = recurrence.daysOfWeek || [];
  const time = parseTime(recurrence.time);
  if (!startAt || !time || !Number.isInteger(interval) || interval < 1 || !weekdays.every((day) => WEEKDAYS.includes(day))) return undefined;

  const after = Math.max(afterTimestamp, startAt - 1);
  const startParts = getMexicoCityDateParts(new Date(after));

  for (let offset = 0; offset <= 3660; offset++) {
    const date = new Date(Date.UTC(startParts.year, startParts.month - 1, startParts.day + offset));
    const candidateDay = date.getTime();
    const weekday = WEEKDAYS[(date.getUTCDay() + 6) % 7];
    if (!weekdays.includes(weekday)) continue;
    if ((getWeekStartForCalendarDate(date) - getWeekStartDay(startAt)) / WEEK_MS % interval !== 0) continue;

    const candidate = mexicoCityDateTimeToTimestamp({
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      ...time,
    });
    if (candidate < startAt || candidate <= after) continue;
    if (until !== undefined && candidate > until) return undefined;
    return candidate;
  }

  return undefined;
}

function parseTime(value) {
  const match = typeof value === "string" && value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return undefined;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour <= 23 && minute <= 59 ? { hour, minute } : undefined;
}

module.exports = { WEEKDAYS, getLocalWeekday, getNextWeeklyTrigger, parseTime, timestampOf, toIso };
