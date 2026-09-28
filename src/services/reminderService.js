const { getMexicoCityDateParts, mexicoCityDateTimeToTimestamp, parseClockTime, parseDuration } = require("../utils/timeUtils");
const { resolveMexicoCityDate } = require("../utils/dateUtils");
const { WEEKDAYS, getNextWeeklyTrigger, parseTime, toIso } = require("../schedulers/reminderSchedule");
const { failure, success } = require("./result");

function createRelativeReminder(
  { chatId, text, duration, startAt, count, messageId, senderMentionId },
  reminderStore,
  reminderScheduler,
  userStatsStore,
) {
  const recurring = count !== undefined;
  const firstTriggerAt = startAt ?? Date.now() + duration;
  const reminder = recurring
    ? reminderStore.addRecurring(chatId, text, firstTriggerAt, duration, count, messageId)
    : reminderStore.add(chatId, text, firstTriggerAt, messageId);

  userStatsStore?.recordAction(chatId, senderMentionId, "remindersCreated");
  reminderScheduler?.schedule({ chatId, ...reminder });
  return { reminder, recurring, reminders: reminderStore.getAll(chatId) };
}

function scheduleReminder(chatId, reminder, reminderScheduler) {
  reminderScheduler?.schedule({ chatId, ...reminder });
  return reminder;
}

function createWeeklyReminder({ chatId, text, startAt, recurrence, messageId, senderMentionId }, reminderStore, reminderScheduler, userStatsStore) {
  const reminder = reminderStore.addWeekly(chatId, text, startAt, recurrence, messageId);
  userStatsStore?.recordAction(chatId, senderMentionId, "remindersCreated");
  reminderScheduler?.schedule({ chatId, ...reminder });
  return { reminder, reminders: reminderStore.getAll(chatId) };
}

function listReminders(chatId, reminderStore) {
  return success("REMINDERS_LISTED", { reminders: reminderStore.getAll(chatId) });
}

function deleteReminder(chatId, index, reminderStore, reminderScheduler) {
  const reminder = reminderStore.remove(chatId, index);
  if (reminder) reminderScheduler?.cancel(reminder.id);
  return reminder ? success("REMINDER_DELETED", { reminder, reminders: reminderStore.getAll(chatId) }) : failure("REMINDER_NOT_FOUND");
}

const MINIMUM_RECURRING_REMINDER_MS = 10 * 60_000;

function createReminder(dto, reminderStore, reminderScheduler, userStatsStore) {
  const text = dto.text?.trim();
  if (!text) return failure("REMINDER_CONTENT_REQUIRED");
  if (dto.weeklyRecurrence) return createWeeklyReminderFromDto({ ...dto, text }, reminderStore, reminderScheduler, userStatsStore);

  const hasDuration = dto.duration !== undefined;
  const hasAbsoluteTime = dto.dueDate !== undefined || dto.dueTime !== undefined;
  const recurring = dto.repeatCount !== undefined || dto.repeatForever === true;
  if (hasDuration === hasAbsoluteTime || (dto.repeatForever && dto.repeatCount !== undefined)) return failure("REMINDER_INPUT_INVALID");

  let duration;
  let startAt;
  if (hasDuration) {
    duration = parseDuration(dto.duration);
    if (!duration) return failure("REMINDER_DURATION_INVALID");
    startAt = Date.now() + duration;
  } else {
    if (recurring) return failure("REMINDER_ABSOLUTE_CANNOT_REPEAT");
    const date = resolveMexicoCityDate(dto.dueDate);
    const time = parseClockTime(dto.dueTime);
    if (!date || !time) return failure("REMINDER_ABSOLUTE_INVALID");
    startAt = mexicoCityDateTimeToTimestamp({ ...date, ...time });
    if (startAt <= Date.now()) return failure("REMINDER_TIME_PASSED");
  }

  const count = dto.repeatForever ? null : dto.repeatCount === undefined ? undefined : Number(dto.repeatCount);
  if (count !== undefined && count !== null && (!Number.isInteger(count) || count < 1)) return failure("REMINDER_COUNT_INVALID");
  if (recurring && duration < MINIMUM_RECURRING_REMINDER_MS) return failure("REMINDER_INTERVAL_TOO_SHORT");

  const result = createRelativeReminder({ ...dto, text, duration, startAt, count }, reminderStore, reminderScheduler, userStatsStore);
  return success("REMINDER_CREATED", {
    ...result,
    kind: hasAbsoluteTime ? "absolute" : recurring ? "relativeRecurring" : "relative",
    startAt,
    count,
  });
}

function createWeeklyReminderFromDto(dto, reminderStore, reminderScheduler, userStatsStore) {
  if (
    dto.duration !== undefined ||
    dto.dueDate !== undefined ||
    dto.dueTime !== undefined ||
    dto.repeatCount !== undefined ||
    dto.repeatForever === true
  ) {
    return failure("REMINDER_WEEKLY_CONFLICT");
  }
  const weekly = dto.weeklyRecurrence;
  const interval = weekly.interval === undefined ? 1 : Number(weekly.interval);
  const daysOfWeek = Array.isArray(weekly.days_of_week) ? [...new Set(weekly.days_of_week.map((day) => String(day).toLowerCase()))] : [];
  const time = typeof weekly.time === "string" ? weekly.time : "";
  const count = weekly.count === undefined ? null : Number(weekly.count);
  if (!Number.isInteger(interval) || interval < 1 || !daysOfWeek.length || !daysOfWeek.every((day) => WEEKDAYS.includes(day)) || !parseTime(time))
    return failure("REMINDER_WEEKLY_INVALID");
  if (count !== null && (!Number.isInteger(count) || count < 1)) return failure("REMINDER_COUNT_INVALID");
  const startDate = weekly.start_date === undefined ? getMexicoCityDateParts() : resolveMexicoCityDate(weekly.start_date);
  const untilDate = weekly.until_date === undefined ? undefined : resolveMexicoCityDate(weekly.until_date);
  if (!startDate || (weekly.until_date !== undefined && !untilDate)) return failure("REMINDER_ABSOLUTE_INVALID");
  const recurrence = {
    frequency: "week",
    interval,
    daysOfWeek,
    dayOfMonth: null,
    time,
    until: untilDate ? toIso(mexicoCityDateTimeToTimestamp({ ...untilDate, ...parseTime(time) })) : null,
    count,
  };
  const boundary = mexicoCityDateTimeToTimestamp({ ...startDate, hour: 0, minute: 0 });
  const startAt = getNextWeeklyTrigger({ startAt: toIso(boundary), recurrence: { ...recurrence, interval: 1 } }, boundary - 1);
  if (!startAt) return failure("REMINDER_TIME_PASSED");
  const result = createWeeklyReminder({ ...dto, text: dto.text, startAt, recurrence }, reminderStore, reminderScheduler, userStatsStore);
  return success("REMINDER_CREATED", { ...result, kind: "weekly", startAt, count });
}

module.exports = { createReminder, createRelativeReminder, createWeeklyReminder, deleteReminder, listReminders, scheduleReminder };
