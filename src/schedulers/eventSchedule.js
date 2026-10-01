const { parseIsoDate } = require("../utils/dateUtils");
const { addMexicoCityCalendarOffset, getMexicoCityDateTimeParts, mexicoCityDateTimeToTimestamp, timestampOf, toMexicoCityIso } = require("../utils/timeUtils");

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

function getNextEventReminderTrigger(event, reminder, afterTimestamp) {
  const start = getEventStartTimestamp(event);
  if (!Number.isFinite(start)) return undefined;
  const recurrence = event.recurrence;
  if (!recurrence) {
    const trigger = getReminderTimestamp(start, reminder);
    return trigger > afterTimestamp ? trigger : undefined;
  }

  const maxOccurrences = recurrence.count ?? 10_000;
  for (let occurrenceIndex = 0; occurrenceIndex < maxOccurrences; occurrenceIndex++) {
    const occurrence = getOccurrenceTimestamp(event, occurrenceIndex);
    if (!occurrence || isAfterUntil(occurrence, recurrence.until)) return undefined;
    const trigger = getReminderTimestamp(occurrence, reminder);
    if (trigger > afterTimestamp) return trigger;
  }
  return undefined;
}

function getNextEventOccurrence(event, afterTimestamp) {
  const start = getEventStartTimestamp(event);
  if (!Number.isFinite(start)) return undefined;
  if (!event.recurrence) return start > afterTimestamp ? start : undefined;

  const maxOccurrences = event.recurrence.count ?? 100_000;
  for (let occurrenceIndex = 0; occurrenceIndex < maxOccurrences; occurrenceIndex++) {
    const occurrence = getOccurrenceTimestamp(event, occurrenceIndex);
    if (!occurrence || isAfterUntil(occurrence, event.recurrence.until)) return undefined;
    if (occurrence > afterTimestamp) return occurrence;
  }
  return undefined;
}

function getOccurrenceTimestamp(event, occurrenceIndex) {
  const recurrence = event.recurrence;
  const start = getEventStartTimestamp(event);
  if (!recurrence || occurrenceIndex === 0) return start;
  const parts = getEventStartParts(event);
  if (recurrence.frequency === "day") return addMexicoCityCalendarOffset(parts, { days: occurrenceIndex * recurrence.interval });
  if (recurrence.frequency === "month") return addMexicoCityCalendarOffset(parts, { months: occurrenceIndex * recurrence.interval });
  if (recurrence.frequency === "year") return addMexicoCityCalendarOffset(parts, { months: occurrenceIndex * recurrence.interval * 12 });
  if (recurrence.frequency === "week") return getWeeklyOccurrence(parts, recurrence, occurrenceIndex);
  return undefined;
}

function getWeeklyOccurrence(parts, recurrence, occurrenceIndex) {
  const days = recurrence.daysOfWeek?.length ? recurrence.daysOfWeek : [getWeekday(parts)];
  const baseWeekStart = getWeekStart(parts);
  let found = 0;
  for (let dayOffset = 0; dayOffset < 70_000; dayOffset++) {
    const date = new Date(baseWeekStart + dayOffset * 86_400_000);
    const candidate = { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), hour: parts.hour, minute: parts.minute };
    const weekDistance = Math.floor(dayOffset / 7);
    if (weekDistance % recurrence.interval || !days.includes(getWeekday(candidate))) continue;
    const timestamp = mexicoCityDateTimeToTimestamp(candidate);
    if (timestamp < mexicoCityDateTimeToTimestamp(parts)) continue;
    if (found++ === occurrenceIndex) return timestamp;
  }
  return undefined;
}

function getReminderTimestamp(occurrenceTimestamp, reminder) {
  let parts = getMexicoCityDateTimeParts(new Date(occurrenceTimestamp));
  if (reminder.time) {
    const [hour, minute] = reminder.time.split(":").map(Number);
    parts = { ...parts, hour, minute };
  }
  return addMexicoCityCalendarOffset(parts, reminder.offset || {});
}

function getEventStartTimestamp(event) {
  const parts = getEventStartParts(event);
  return mexicoCityDateTimeToTimestamp(parts);
}

function getEventStartParts(event) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(event.startAt)) {
    return { ...parseIsoDate(event.startAt), hour: 9, minute: 0 };
  }
  return getMexicoCityDateTimeParts(new Date(event.startAt));
}

function isAfterUntil(timestamp, until) {
  if (!until) return false;
  const untilTimestamp = /^\d{4}-\d{2}-\d{2}$/.test(until)
    ? mexicoCityDateTimeToTimestamp({ ...parseIsoDate(until), hour: 23, minute: 59 })
    : timestampOf(until);
  return timestamp > untilTimestamp;
}

function getWeekday(parts) {
  return WEEKDAYS[(new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay() + 6) % 7];
}

function getWeekStart(parts) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.getTime();
}

module.exports = { getNextEventOccurrence, getNextEventReminderTrigger, toIso: toMexicoCityIso };
