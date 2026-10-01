const {
  getMexicoCityDateParts,
  getMexicoCityDateTimeParts,
  mexicoCityDateTimeToTimestamp,
  parseClockTime,
  parseDuration,
} = require("../utils/timeUtils");
const { resolveMexicoCityDate } = require("../utils/dateUtils");
const { WEEKDAYS, getNextWeeklyTrigger, parseTime, toIso } = require("../schedulers/reminderSchedule");
const { failure, success } = require("./result");
const { partitionOneBasedIndexes } = require("../utils/indexUtils");

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
  if (!Number.isInteger(index) || index < 0) return failure("REMINDER_INDEX_INVALID");

  const reminder = reminderStore.remove(chatId, index);
  if (reminder) reminderScheduler?.cancel(reminder.id);
  return reminder
    ? success("REMINDER_DELETED", { index: index + 1, reminder, reminders: reminderStore.getAll(chatId) })
    : failure("REMINDER_NOT_FOUND");
}

function deleteReminders(chatId, indexes, reminderStore, reminderScheduler) {
  if (!Array.isArray(indexes) || !indexes.length) return failure("REMINDER_INDEX_INVALID");
  const { valid, invalid } = partitionOneBasedIndexes(indexes, reminderStore.getAll(chatId).length);
  const deleted = valid
    .sort((a, b) => b - a)
    .map((index) => {
      const reminder = reminderStore.remove(chatId, index - 1);
      reminderScheduler?.cancel(reminder.id);
      return { index, reminder };
    })
    .reverse();
  return success("REMINDERS_DELETED", { deleted, invalidIndexes: invalid, reminders: reminderStore.getAll(chatId) });
}

function updateReminder(dto, reminderStore, reminderScheduler) {
  if (!Number.isInteger(dto.index) || dto.index < 0) return failure("REMINDER_INDEX_INVALID");
  const current = reminderStore.getAll(dto.chatId)[dto.index];
  if (!current) return failure("REMINDER_NOT_FOUND");
  if (
    ![dto.hasText, dto.hasDuration, dto.hasDueDate, dto.hasDueTime, dto.hasRepeatCount, dto.hasRepeatForever, dto.hasWeeklyRecurrence].some(Boolean)
  ) {
    return failure("REMINDER_UPDATE_REQUIRED");
  }

  const updates = {};
  if (dto.hasText) {
    const text = dto.text?.trim();
    if (!text) return failure("REMINDER_CONTENT_REQUIRED");
    updates.text = text;
  }

  const usesWeekly = dto.hasWeeklyRecurrence && dto.weeklyRecurrence !== null;
  const usesAbsolute = dto.hasDueDate || dto.hasDueTime;
  if ((usesWeekly && (dto.hasDuration || usesAbsolute || dto.hasRepeatCount || dto.hasRepeatForever)) || (dto.hasDuration && usesAbsolute)) {
    return failure("REMINDER_INPUT_INVALID");
  }

  if (usesWeekly) {
    const weekly = buildWeeklyReminderSchedule(dto.weeklyRecurrence);
    if (!weekly.ok) return weekly;
    Object.assign(updates, { startAt: toIso(weekly.data.startAt), nextTriggerAt: toIso(weekly.data.startAt), recurrence: weekly.data.recurrence });
  } else if (dto.hasWeeklyRecurrence) {
    updates.recurrence = null;
  } else if (dto.hasDuration) {
    const duration = parseDuration(dto.duration);
    if (!duration) return failure("REMINDER_DURATION_INVALID");
    const countResult = getEditedRepeatCount(dto, current.recurrence);
    if (!countResult.ok) return countResult;
    const recurring = countResult.data.recurring;
    if (recurring && duration < MINIMUM_RECURRING_REMINDER_MS) return failure("REMINDER_INTERVAL_TOO_SHORT");
    const startAt = Date.now() + duration;
    Object.assign(updates, {
      startAt: toIso(startAt),
      nextTriggerAt: toIso(startAt),
      recurrence: recurring
        ? { frequency: "relative", interval: duration, daysOfWeek: null, dayOfMonth: null, until: null, count: countResult.data.count }
        : null,
    });
  } else if (usesAbsolute) {
    const base = getMexicoCityDateTimeParts(new Date(current.startAt));
    const date = dto.hasDueDate ? resolveMexicoCityDate(dto.dueDate) : base;
    const time = dto.hasDueTime ? parseClockTime(dto.dueTime) : base;
    if (!date || !time) return failure("REMINDER_ABSOLUTE_INVALID");
    const startAt = mexicoCityDateTimeToTimestamp({ ...date, ...time });
    Object.assign(updates, { startAt: toIso(startAt), nextTriggerAt: toIso(startAt), recurrence: null });
  } else if (dto.hasRepeatCount || dto.hasRepeatForever) {
    if (!current.recurrence) return failure("REMINDER_INPUT_INVALID");
    const countResult = getEditedRepeatCount(dto, current.recurrence);
    if (!countResult.ok) return countResult;
    updates.recurrence = countResult.data.recurring ? { ...current.recurrence, count: countResult.data.count } : null;
  }

  const rescheduled = Object.hasOwn(updates, "nextTriggerAt");
  if (rescheduled) Object.assign(updates, { lastTriggeredAt: null, triggerCount: 0, status: "active" });
  const reminder = reminderStore.updateById(dto.chatId, current.id, updates);
  if (rescheduled) {
    reminderScheduler?.cancel(current.id);
    reminderScheduler?.schedule({ chatId: dto.chatId, ...reminder });
  }
  return success("REMINDER_UPDATED", {
    index: dto.index + 1,
    reminder,
    reminders: reminderStore.getAll(dto.chatId),
    kind: getReminderKind(reminder),
  });
}

function getEditedRepeatCount(dto, recurrence) {
  if (dto.hasRepeatForever && dto.repeatForever === true && dto.hasRepeatCount) return failure("REMINDER_INPUT_INVALID");
  if (dto.hasRepeatForever && dto.repeatForever === false) return success("REMINDER_REPEAT_UPDATED", { recurring: false, count: undefined });
  if (dto.hasRepeatForever && dto.repeatForever !== true) return failure("REMINDER_INPUT_INVALID");
  if (dto.hasRepeatCount) {
    const count = Number(dto.repeatCount);
    if (!Number.isInteger(count) || count < 1) return failure("REMINDER_COUNT_INVALID");
    return success("REMINDER_REPEAT_UPDATED", { recurring: true, count });
  }
  if (dto.hasRepeatForever) return success("REMINDER_REPEAT_UPDATED", { recurring: true, count: null });
  return recurrence
    ? success("REMINDER_REPEAT_UPDATED", { recurring: true, count: recurrence.count })
    : success("REMINDER_REPEAT_UPDATED", { recurring: false, count: undefined });
}

function buildWeeklyReminderSchedule(weekly) {
  const interval = weekly?.interval === undefined ? 1 : Number(weekly?.interval);
  const daysOfWeek = Array.isArray(weekly?.days_of_week) ? [...new Set(weekly.days_of_week.map((day) => String(day).toLowerCase()))] : [];
  const time = typeof weekly?.time === "string" ? weekly.time : "";
  const count = weekly?.count === undefined || weekly.count === null ? null : Number(weekly.count);
  if (!Number.isInteger(interval) || interval < 1 || !daysOfWeek.length || !daysOfWeek.every((day) => WEEKDAYS.includes(day)) || !parseTime(time))
    return failure("REMINDER_WEEKLY_INVALID");
  if (count !== null && (!Number.isInteger(count) || count < 1)) return failure("REMINDER_COUNT_INVALID");
  const startDate = weekly.start_date === undefined ? getMexicoCityDateParts() : resolveMexicoCityDate(weekly.start_date);
  const untilDate = weekly.until_date === undefined || weekly.until_date === null ? undefined : resolveMexicoCityDate(weekly.until_date);
  if (!startDate || (weekly.until_date !== undefined && weekly.until_date !== null && !untilDate)) return failure("REMINDER_ABSOLUTE_INVALID");
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
  return startAt ? success("REMINDER_WEEKLY_READY", { recurrence, startAt }) : failure("REMINDER_TIME_PASSED");
}

function getReminderKind(reminder) {
  return reminder.recurrence?.frequency === "week" ? "weekly" : reminder.recurrence ? "relativeRecurring" : "absolute";
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

module.exports = { createReminder, deleteReminder, deleteReminders, listReminders, scheduleReminder, updateReminder };
