const EVENT_DEFAULTS = Object.freeze({
  birthday: {
    reminders: [
      { offset: { months: -1 }, time: "09:00" },
      { offset: { days: -1 }, time: "09:00" },
      { offset: { days: 0 }, time: "09:00" },
    ],
  },
  social: {
    reminders: [{ offset: { hours: -1 } }],
  },
});

function createDefaultEventReminders(type, eventId) {
  const defaults = EVENT_DEFAULTS[type] || EVENT_DEFAULTS.social;
  return defaults.reminders.map((reminder, index) => ({
    id: `event_${eventId}_reminder_${index + 1}`,
    offset: { ...reminder.offset },
    ...(reminder.time ? { time: reminder.time } : {}),
    nextTriggerAt: null,
    lastTriggeredAt: null,
    triggerCount: 0,
  }));
}

module.exports = { EVENT_DEFAULTS, createDefaultEventReminders };
