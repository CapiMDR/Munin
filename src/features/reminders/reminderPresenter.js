const { COMMANDS, INFINITE_TOKEN } = require("../../config/commandConstants");
const { formatDuration, formatMexicoCityDateTime, formatReminder } = require("../../utils/timeUtils");

const MESSAGES = {
  MUTATION_WITH_LIST: (confirmation, list) => `${confirmation}\n\n${list}`,
  REMINDER_USAGE: `Uso: ${COMMANDS.REMINDER} <cantidad><m/h/d> [x<veces> o ${INFINITE_TOKEN}] <contenido>. Responde a un mensaje para usarlo como contenido; ${COMMANDS.REMINDER} - <índice> lo elimina. Los recordatorios repetidos requieren un mínimo de 10m.`,
  REMINDER_INVALID_DURATION: "No entendí el tiempo del recordatorio. Usa una cantidad positiva seguida de m, h o d; por ejemplo: 30m, 2h o 1d.",
  REMINDER_INVALID_ABSOLUTE_TIME: "No entendí la fecha u hora del recordatorio. Usa hoy o mañana y una hora HH:mm, por ejemplo: hoy a las 10:00.",
  REMINDER_TIME_ALREADY_PASSED: "Esa hora de hoy ya paso. Indica una hora futura o pide el recordatorio para mañana.",
  RECURRING_REMINDER_ADDED: (interval, repetitions, content) => `Recordatorio repetido cada ${interval}, ${repetitions}: ${content}`,
  REMINDER_ADDED: (userTag, time, content) => `${userTag ? `${userTag} ` : ""}Te recordaré en ${time}: ${content}`,
  REMINDER_CREATED: (content, dueAt) => `Recordatorio agregado para ${dueAt}: ${content}`,
  NO_REMINDERS: 'No hay recordatorios guardados para este chat.\n\n> Dime *"Recuérdame pagar la renta mañana a las 9:00"*.',
  REMINDERS_LIST: (reminders) => `🐦‍⬛ Recordatorios de este grupo:\n${reminders.map(formatReminderLine).join("\n")}`,
  DELETE_REMINDER_NOT_FOUND: "No existe un recordatorio con ese índice en este chat.",
  REMINDER_DELETED: (index, content) => `Recordatorio ${index} eliminado: ${content}`,
};

function presentReminderDue(content) {
  return `🐦‍⬛ Recordar: ${content}`;
}

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
  if (result.code === "REMINDERS_DELETED") {
    const confirmation = result.data.deleted.length
      ? `Se eliminaron ${result.data.deleted.length} recordatorios.`
      : "No encontré recordatorios para eliminar.";
    const clarification = result.data.invalidIndexes.length ? `\nNo encontré los índices: ${result.data.invalidIndexes.join(", ")}.` : "";
    return {
      ok: true,
      action: "delete_reminders",
      message: MESSAGES.MUTATION_WITH_LIST(`${confirmation}${clarification}`, formatReminders(reminders)),
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
  if (result.code === "REMINDER_UPDATED") {
    return {
      ok: true,
      action: "edit_reminder",
      message: MESSAGES.MUTATION_WITH_LIST(`Recordatorio ${result.data.index} actualizado: ${formatReminder(reminder)}`, formatReminders(reminders)),
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
  return reminders.length
    ? `${MESSAGES.REMINDERS_LIST(reminders)}\n\n> Dime *"Recuérdame pagar la renta mañana a las 9:00"*.`
    : MESSAGES.NO_REMINDERS;
}

function formatReminderLine(reminder, index) {
  const marker = index === 0 ? "*" : "`";
  return `${marker}${index + 1}. ${formatReminder(reminder)}${marker}`;
}

module.exports = { formatReminders, presentReminderDue, presentReminderResult };
