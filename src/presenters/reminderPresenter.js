const { MESSAGES } = require("../commandConstants");
const { formatReminders } = require("../listResponseFormatter");
const { formatDuration, formatMexicoCityDateTime } = require("../utils/timeUtils");

function presentReminderResult(result, { index, senderTag, duration, repetitions } = {}) {
  if (!result.ok) {
    return { ok: false, code: result.code, message: result.code === "REMINDER_NOT_FOUND" ? MESSAGES.DELETE_REMINDER_NOT_FOUND : MESSAGES.REMINDER_USAGE };
  }
  const { reminder, reminders, kind, startAt, count } = result.data;
  if (result.code === "REMINDERS_LISTED") return { ok: true, action: "list_reminders", message: formatReminders(reminders) };
  if (result.code === "REMINDER_DELETED") {
    return { ok: true, action: "delete_reminder", message: MESSAGES.MUTATION_WITH_LIST(MESSAGES.REMINDER_DELETED(index, reminder.text), formatReminders(reminders)) };
  }
  if (result.code === "REMINDER_CREATED") {
    const confirmation = kind === "relativeRecurring"
      ? MESSAGES.RECURRING_REMINDER_ADDED(formatDuration(duration), repetitions || (count === null ? "infinitas veces" : `${count} veces`), reminder.text)
      : kind === "relative"
        ? MESSAGES.REMINDER_ADDED(senderTag, formatDuration(duration), reminder.text)
        : MESSAGES.REMINDER_CREATED(reminder.text, formatMexicoCityDateTime(startAt));
    return { ok: true, action: "create_reminder", message: MESSAGES.MUTATION_WITH_LIST(confirmation, formatReminders(reminders)), dueAt: formatMexicoCityDateTime(startAt), kind, count };
  }
  return { ok: false, code: "REMINDER_RESULT_UNKNOWN", message: MESSAGES.REMINDER_USAGE };
}

module.exports = { presentReminderResult };
