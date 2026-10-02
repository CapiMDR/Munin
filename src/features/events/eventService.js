const { failure, success } = require("../../core/result");
const { createDefaultEventReminders } = require("./eventDefaults");
const { getNextEventOccurrence } = require("./eventSchedule");
const { parseIsoDate } = require("../../utils/dateUtils");
const { getMexicoCityDateTimeParts, mexicoCityDateTimeToTimestamp, timestampOf, toMexicoCityIso } = require("../../utils/timeUtils");
const { partitionOneBasedIndexes } = require("../../utils/indexUtils");

const RECURRENCE_FREQUENCIES = new Set(["day", "week", "month", "year"]);
const WEEKDAYS = new Set(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]);
const RSVP_STATUSES = new Set(["going", "maybe", "declined"]);
const EVENT_UPDATE_FIELDS = new Set(["title", "description", "type", "startAt", "location", "recurrence"]);

function createEvent(dto, eventStore, eventScheduler) {
  const title = normalizeRequiredText(dto.title);
  const createdBy = normalizeRequiredText(dto.createdBy);
  const type = normalizeEventType(dto.type);
  const normalizedStartAt = normalizeEventStartAt(dto.startAt);
  const startAt = type === "birthday" ? getNextBirthdayOccurrence(normalizedStartAt, dto.now) : normalizedStartAt;
  if (!title || !createdBy || !startAt) return failure("EVENT_CREATE_INVALID");

  const recurrence = normalizeRecurrence(dto.recurrence, startAt);
  if (!recurrence.ok) return recurrence;
  const location = normalizeLocation(dto.location);
  if (!location.ok) return location;

  const id = eventStore.getNextId(dto.chatId);
  const event = eventStore.add(dto.chatId, {
    id,
    title,
    description: normalizeOptionalText(dto.description),
    type,
    startAt,
    location: location.data.location,
    recurrence: recurrence.data.recurrence,
    reminders: createDefaultEventReminders(type, id),
    participants: { going: [], maybe: [], declined: [] },
    createdBy,
    createdByName: normalizeOptionalText(dto.createdByName),
    createdAt: toMexicoCityIso(Date.now()),
  });
  return success("EVENT_CREATED", { event: eventScheduler?.scheduleEvent(dto.chatId, event) || event });
}

function listEvents({ chatId }, eventStore) {
  return success("EVENTS_LISTED", { events: eventStore.getAll(chatId) });
}

function getEvent({ chatId, id }, eventStore) {
  const event = eventStore.getById(chatId, id);
  return event ? success("EVENT_FOUND", { event }) : failure("EVENT_NOT_FOUND");
}

function getEventCountdown({ chatId, id, now = Date.now() }, eventStore) {
  const event = eventStore.getById(chatId, id);
  if (!event) return failure("EVENT_NOT_FOUND");
  const occurrenceAt = getNextEventOccurrence(event, now);
  return occurrenceAt ? success("EVENT_COUNTDOWN_FOUND", { event, occurrenceAt }) : failure("EVENT_ALREADY_PASSED", { event });
}

function updateEvent(dto, eventStore, eventScheduler) {
  const event = eventStore.getById(dto.chatId, dto.id);
  if (!event) return failure("EVENT_NOT_FOUND");
  const suppliedFields = Object.keys(dto.updates || {}).filter((field) => EVENT_UPDATE_FIELDS.has(field));
  if (!suppliedFields.length) return failure("EVENT_UPDATE_REQUIRED");

  const updates = {};
  if (suppliedFields.includes("title")) {
    updates.title = normalizeRequiredText(dto.updates.title);
    if (!updates.title) return failure("EVENT_UPDATE_INVALID");
  }
  if (suppliedFields.includes("description")) updates.description = normalizeOptionalText(dto.updates.description);
  if (suppliedFields.includes("type")) {
    updates.type = normalizeRequiredText(dto.updates.type)?.toLowerCase();
    if (!updates.type) return failure("EVENT_UPDATE_INVALID");
  }
  if (suppliedFields.includes("location")) {
    const location = normalizeLocation(dto.updates.location);
    if (!location.ok) return location;
    updates.location = location.data.location;
  }

  const startAt = suppliedFields.includes("startAt") ? normalizeEventStartAt(dto.updates.startAt) : event.startAt;
  if (!startAt) return failure("EVENT_UPDATE_INVALID");
  if (suppliedFields.includes("startAt")) updates.startAt = startAt;

  if (suppliedFields.includes("recurrence")) {
    const recurrence = normalizeRecurrence(dto.updates.recurrence, startAt);
    if (!recurrence.ok) return recurrence;
    updates.recurrence = recurrence.data.recurrence;
  } else if (event.recurrence?.until && toEventTimestamp(event.recurrence.until) < toEventTimestamp(startAt)) {
    return failure("EVENT_RECURRENCE_UNTIL_INVALID");
  }

  const resetReminders = ["type", "startAt", "recurrence"].some((field) => suppliedFields.includes(field));
  if (resetReminders) updates.reminders = createDefaultEventReminders(updates.type || event.type, event.id);
  const updatedEvent = eventStore.updateById(dto.chatId, dto.id, updates);
  return success("EVENT_UPDATED", { event: eventScheduler?.scheduleEvent(dto.chatId, updatedEvent, { reset: resetReminders }) || updatedEvent });
}

function deleteEvent({ chatId, id }, eventStore, eventScheduler) {
  const event = eventStore.removeById(chatId, id);
  if (event) eventScheduler?.cancelEvent(chatId, event.id);
  return event ? success("EVENT_DELETED", { event }) : failure("EVENT_NOT_FOUND");
}

function deleteEvents({ chatId, indexes }, eventStore, eventScheduler) {
  if (!Array.isArray(indexes) || !indexes.length) return failure("EVENT_NOT_FOUND");
  const events = eventStore.getAll(chatId);
  const { valid, invalid } = partitionOneBasedIndexes(indexes, events.length);
  const deleted = valid
    .sort((a, b) => b - a)
    .map((index) => {
      const event = eventStore.removeById(chatId, events[index - 1].id);
      eventScheduler?.cancelEvent(chatId, event.id);
      return { index, event };
    })
    .reverse();
  return success("EVENTS_DELETED", { deleted, invalidIndexes: invalid, events: eventStore.getAll(chatId) });
}

function rsvpToEvent({ chatId, id, participantId, participantName, status }, eventStore) {
  const event = eventStore.getById(chatId, id);
  if (!event) return failure("EVENT_NOT_FOUND");
  if (!participantId || !RSVP_STATUSES.has(status)) return failure("EVENT_RSVP_INVALID");

  const participants = Object.fromEntries(
    [...RSVP_STATUSES].map((rsvpStatus) => [
      rsvpStatus,
      (event.participants?.[rsvpStatus] || []).filter((participant) => getParticipantId(participant) !== participantId),
    ]),
  );
  participants[status].push({ mentionId: participantId, name: normalizeOptionalText(participantName) || participantId });
  return success("EVENT_RSVP_UPDATED", { event: eventStore.updateById(chatId, id, { participants }), status });
}

function getParticipantId(participant) {
  return typeof participant === "string" ? participant : participant?.mentionId;
}

function normalizeRecurrence(value, startAt) {
  if (value === null || value === undefined) return success("EVENT_RECURRENCE_NORMALIZED", { recurrence: null });
  if (typeof value !== "object" || Array.isArray(value)) return failure("EVENT_RECURRENCE_INVALID");
  const frequency = String(value.frequency || "").toLowerCase();
  const interval = value.interval === undefined ? 1 : Number(value.interval);
  const daysOfWeek = value.daysOfWeek ?? value.days_of_week ?? null;
  const until = value.until === null || value.until === undefined ? null : normalizeEventStartAt(value.until);
  const count = value.count === null || value.count === undefined ? null : Number(value.count);
  if (!RECURRENCE_FREQUENCIES.has(frequency) || !Number.isInteger(interval) || interval < 1) return failure("EVENT_RECURRENCE_INVALID");
  if (until === null && value.until !== null && value.until !== undefined) return failure("EVENT_RECURRENCE_INVALID");
  if (until && toEventTimestamp(until) < toEventTimestamp(startAt)) return failure("EVENT_RECURRENCE_UNTIL_INVALID");
  if (count !== null && (!Number.isInteger(count) || count < 1)) return failure("EVENT_RECURRENCE_COUNT_INVALID");
  if (daysOfWeek !== null && (!Array.isArray(daysOfWeek) || !daysOfWeek.length || frequency !== "week")) return failure("EVENT_RECURRENCE_INVALID");
  const normalizedDays = daysOfWeek === null ? null : [...new Set(daysOfWeek.map((day) => String(day).toLowerCase()))];
  if (normalizedDays && !normalizedDays.every((day) => WEEKDAYS.has(day))) return failure("EVENT_RECURRENCE_INVALID");
  return success("EVENT_RECURRENCE_NORMALIZED", {
    recurrence: { frequency, interval, daysOfWeek: normalizedDays, until, count },
  });
}

function normalizeLocation(value) {
  if (value === null || value === undefined) return success("EVENT_LOCATION_NORMALIZED", { location: { name: null, place: null, url: null } });
  if (typeof value !== "object" || Array.isArray(value)) return failure("EVENT_LOCATION_INVALID");
  const url = normalizeOptionalText(value.url);
  if (url) {
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) return failure("EVENT_LOCATION_INVALID");
    } catch {
      return failure("EVENT_LOCATION_INVALID");
    }
  }
  return success("EVENT_LOCATION_NORMALIZED", {
    location: { name: normalizeOptionalText(value.name), place: normalizeOptionalText(value.place), url },
  });
}

function normalizeRequiredText(value) {
  const text = normalizeOptionalText(value);
  return text || null;
}

function normalizeOptionalText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeEventType(value) {
  return normalizeOptionalText(value)?.toLowerCase() || "social";
}

function normalizeEventStartAt(value) {
  if (typeof value !== "string") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return parseIsoDate(value) ? value : null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const timestamp = timestampOf(value);
  return Number.isFinite(timestamp) ? toMexicoCityIso(timestamp) : null;
}

/**
 * Replaces a birthday's supplied year with its next calendar occurrence in
 * Mexico City. All-day birthdays remain valid for the entire current day.
 */
function getNextBirthdayOccurrence(startAt, now = Date.now()) {
  if (!startAt) return null;
  const current = getMexicoCityDateTimeParts(new Date(now));

  if (/^\d{4}-\d{2}-\d{2}$/.test(startAt)) {
    const birthday = parseIsoDate(startAt);
    let year = getNextValidBirthdayYear(current.year, birthday.month, birthday.day);
    if (isCalendarDateBefore({ year, month: birthday.month, day: birthday.day }, current)) {
      year = getNextValidBirthdayYear(year + 1, birthday.month, birthday.day);
    }
    return formatDateOnly(year, birthday.month, birthday.day);
  }

  const birthday = getMexicoCityDateTimeParts(new Date(startAt));
  let year = getNextValidBirthdayYear(current.year, birthday.month, birthday.day);
  let occurrenceAt = mexicoCityDateTimeToTimestamp({ ...birthday, year });
  if (occurrenceAt < now) {
    year = getNextValidBirthdayYear(year + 1, birthday.month, birthday.day);
    occurrenceAt = mexicoCityDateTimeToTimestamp({ ...birthday, year });
  }
  return toMexicoCityIso(occurrenceAt);
}

function formatDateOnly(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getNextValidBirthdayYear(year, month, day) {
  let candidateYear = year;
  while (!parseIsoDate(formatDateOnly(candidateYear, month, day))) candidateYear += 1;
  return candidateYear;
}

function isCalendarDateBefore(left, right) {
  if (left.year !== right.year) return left.year < right.year;
  if (left.month !== right.month) return left.month < right.month;
  return left.day < right.day;
}

function toEventTimestamp(value) {
  const date = parseIsoDate(value);
  return date ? mexicoCityDateTimeToTimestamp({ ...date, hour: 0, minute: 0 }) : timestampOf(value);
}

module.exports = { createEvent, deleteEvent, deleteEvents, getEvent, getEventCountdown, listEvents, rsvpToEvent, updateEvent };
