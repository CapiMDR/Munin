const { DAYS_ORDER, capitalize } = require("./classStore");
const { MESSAGES } = require("./commandConstants");
const { groupPendingsByDate } = require("./pendingUtils");
const { formatReminder, getMexicoCityDate, getMexicoCityTime, timeToMinutes } = require("./timeUtils");

function formatSavedMessages(savedMessages) {
  return savedMessages.length ? MESSAGES.SAVED_MESSAGES_LIST(savedMessages) : MESSAGES.NO_SAVED_MESSAGES;
}

function formatPendings(pendings) {
  return pendings.length ? MESSAGES.DAILY_PENDINGS(groupPendingsByDate(pendings, getMexicoCityDate())) : MESSAGES.NO_PENDING;
}

function formatReminders(reminders) {
  return reminders.length ? MESSAGES.REMINDERS_LIST(reminders.map(formatReminder)) : MESSAGES.NO_REMINDERS;
}

function formatAllClasses(classes, currentTime = getMexicoCityTime()) {
  if (!classes.length) return MESSAGES.NO_CLASSES;

  const groups = DAYS_ORDER.map((day) => [day, classes.filter((cls) => cls.day === day)])
    .filter(([, items]) => items.length)
    .map(([day, items]) => {
      const lines = items.map((cls) => {
        const isActive =
          day === currentTime.day && currentTime.minutes >= timeToMinutes(cls.startTime) && currentTime.minutes < timeToMinutes(cls.endTime);
        return formatClassLine(cls, isActive);
      });
      return `${capitalize(day)}:\n${lines.join("\n")}`;
    });
  return MESSAGES.ALL_CLASSES(groups);
}

function formatClassesToday(day, classes, currentMinutes = getMexicoCityTime().minutes) {
  const lines = classes.map((cls) => {
    const isActive = currentMinutes >= timeToMinutes(cls.startTime) && currentMinutes < timeToMinutes(cls.endTime);
    return formatClassLine(cls, isActive);
  });

  return classes.length ? MESSAGES.CLASSES_TODAY(capitalize(day), lines) : MESSAGES.NO_CLASSES_TODAY;
}

function formatClassLine(cls, isActive = false) {
  return `${!isActive ? "`" : "*"}${cls.globalIndex}. ${cls.name} — ${cls.startTime} - ${cls.endTime} — ${cls.classroom}${!isActive ? "`" : "*"}`;
}

module.exports = { formatAllClasses, formatClassesToday, formatPendings, formatReminders, formatSavedMessages };
