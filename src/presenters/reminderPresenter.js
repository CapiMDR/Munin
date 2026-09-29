const { MESSAGES } = require("./messages");
const { formatDuration, formatMexicoCityDateTime, formatReminder } = require("../utils/timeUtils");

function presentReminderResult(result, { senderTag, duration } = {}) {
  if (!result.ok) {
    return { ok: false, code: result.code, message: getReminderErrorMessage(result.code) };
  }
  const { reminder, reminders, kind, startAt, count } = result.data;
  if (result.code === "REMINDERS_LISTED") return { ok: true, action: "list_reminders", message: formatReminders(reminders) };
  if (result.code === "REMINDER_DELETED") {
    return {
      ok: true,
      action: "delete_reminder",
      message: MESSAGES.MUTATION_WITH_LIST(MESSAGES.REMINDER_DELETED(result.data.index, reminder.text), formatReminders(reminders)),
    };
  }
  if (result.code === "REMINDER_CREATED") {
    const confirmation =
      kind === "relativeRecurring"
        ? MESSAGES.RECURRING_REMINDER_ADDED(formatDuration(duration), count === null ? "infinitas veces" : `${count} veces`, reminder.text)
        : kind === "relative"
          ? MESSAGES.REMINDER_ADDED(senderTag, formatDuration(duration), reminder.text)
          : MESSAGES.REMINDER_CREATED(reminder.text, formatMexicoCityDateTime(startAt));
    return {
      ok: true,
      action: "create_reminder",
      message: MESSAGES.MUTATION_WITH_LIST(confirmation, formatReminders(reminders)),
      dueAt: formatMexicoCityDateTime(startAt),
      kind,
      count,
    };
  }
  return { ok: false, code: "REMINDER_RESULT_UNKNOWN", message: MESSAGES.REMINDER_USAGE };
}

function getReminderErrorMessage(code) {
  if (code === "REMINDER_NOT_FOUND") return MESSAGES.DELETE_REMINDER_NOT_FOUND;
  if (code === "REMINDER_DURATION_INVALID") return MESSAGES.REMINDER_INVALID_DURATION;
  if (code === "REMINDER_ABSOLUTE_INVALID") return MESSAGES.REMINDER_INVALID_ABSOLUTE_TIME;
  if (code === "REMINDER_TIME_PASSED") return MESSAGES.REMINDER_TIME_ALREADY_PASSED;
  return MESSAGES.REMINDER_USAGE;
}

function formatReminders(reminders) {
  return reminders.length ? MESSAGES.REMINDERS_LIST(reminders.map(formatReminder)) : MESSAGES.NO_REMINDERS;
}

module.exports = { formatReminders, presentReminderResult };
