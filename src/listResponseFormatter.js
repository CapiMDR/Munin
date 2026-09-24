const { DAYS_ORDER, capitalize } = require("./classStore");
const { MESSAGES } = require("./commandConstants");
const { groupPendingsByDate } = require("./pendingUtils");
const { formatReminder, getMexicoCityDate } = require("./timeUtils");

function formatSavedMessages(savedMessages) {
  return savedMessages.length ? MESSAGES.SAVED_MESSAGES_LIST(savedMessages) : MESSAGES.NO_SAVED_MESSAGES;
}

function formatPendings(pendings) {
  return pendings.length ? MESSAGES.DAILY_PENDINGS(groupPendingsByDate(pendings, getMexicoCityDate())) : MESSAGES.NO_PENDING;
}

function formatReminders(reminders) {
  return reminders.length ? MESSAGES.REMINDERS_LIST(reminders.map(formatReminder)) : MESSAGES.NO_REMINDERS;
}

function formatAllClasses(classes) {
  if (!classes.length) return MESSAGES.NO_CLASSES;

  const groups = DAYS_ORDER.map((day) => [day, classes.filter((cls) => cls.day === day)])
    .filter(([, items]) => items.length)
    .map(([day, items]) => `${capitalize(day)}:\n${items.map((cls) => `  ${formatClassLine(cls)}`).join("\n")}`);
  return MESSAGES.ALL_CLASSES(groups);
}

function formatClassesToday(day, classes) {
  return classes.length ? MESSAGES.CLASSES_TODAY(capitalize(day), classes.map(formatClassLine)) : MESSAGES.NO_CLASSES_TODAY;
}

function formatClassLine(cls) {
  return `${cls.globalIndex}. ${cls.name} — ${cls.startTime} - ${cls.endTime} — ${cls.classroom}`;
}

module.exports = { formatAllClasses, formatClassesToday, formatPendings, formatReminders, formatSavedMessages };
