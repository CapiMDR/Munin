const { getNextEventReminderTrigger, toIso } = require("./eventSchedule");
const { presentEventReminder } = require("../presenters/eventPresenter");

const MAX_TIMEOUT = 2 ** 31 - 1;
const RETRY_DELAY = 60_000;

class EventScheduler {
  constructor(eventStore, sendMessage) {
    this.eventStore = eventStore;
    this.sendMessage = sendMessage;
    this.timers = new Map();
  }

  start() {
    for (const [chatId, events] of Object.entries(this.eventStore.eventsByChat)) {
      events.forEach((event) => this.scheduleEvent(chatId, event));
    }
  }

  scheduleEvent(chatId, event, { reset = false } = {}) {
    this.cancelEvent(chatId, event.id);
    const reminders = (event.reminders || []).map((reminder) => {
      const nextTrigger = !reset && reminder.nextTriggerAt ? null : getNextEventReminderTrigger(event, reminder, Date.now());
      return { ...reminder, nextTriggerAt: !reset && reminder.nextTriggerAt ? reminder.nextTriggerAt : nextTrigger ? toIso(nextTrigger) : null };
    });
    const changed = JSON.stringify(reminders) !== JSON.stringify(event.reminders || []);
    const scheduledEvent = changed ? this.eventStore.updateById(chatId, event.id, { reminders }) : event;
    for (const reminder of scheduledEvent.reminders || []) this.scheduleReminder(chatId, scheduledEvent, reminder);
    return scheduledEvent;
  }

  scheduleReminder(chatId, event, reminder) {
    if (!reminder.nextTriggerAt) return;
    const delay = Math.max(0, Date.parse(reminder.nextTriggerAt) - Date.now());
    const key = this.getKey(chatId, event.id, reminder.id);
    this.timers.set(
      key,
      setTimeout(() => this.handleTimeout(chatId, event.id, reminder.id), Math.min(delay, MAX_TIMEOUT)),
    );
  }

  cancelEvent(chatId, eventId) {
    for (const [key, timer] of this.timers) {
      if (key.startsWith(`${chatId}:${eventId}:`)) {
        clearTimeout(timer);
        this.timers.delete(key);
      }
    }
  }

  async handleTimeout(chatId, eventId, reminderId) {
    const event = this.eventStore.getById(chatId, eventId);
    const reminder = event?.reminders?.find((item) => item.id === reminderId);
    if (!event || !reminder?.nextTriggerAt) return;
    if (Date.parse(reminder.nextTriggerAt) > Date.now()) return this.scheduleReminder(chatId, event, reminder);

    try {
      await this.sendMessage(chatId, presentEventReminder(event));
      const triggerCount = (reminder.triggerCount || 0) + 1;
      const nextTrigger = getNextEventReminderTrigger(event, reminder, Date.now());
      const reminders = event.reminders.map((item) =>
        item.id === reminderId
          ? { ...item, lastTriggeredAt: toIso(Date.now()), triggerCount, nextTriggerAt: nextTrigger ? toIso(nextTrigger) : null }
          : item,
      );
      const updatedEvent = this.eventStore.updateById(chatId, eventId, { reminders });
      const updatedReminder = updatedEvent.reminders.find((item) => item.id === reminderId);
      this.timers.delete(this.getKey(chatId, eventId, reminderId));
      this.scheduleReminder(chatId, updatedEvent, updatedReminder);
    } catch (error) {
      console.error("Could not deliver event reminder:", error);
      const key = this.getKey(chatId, eventId, reminderId);
      this.timers.set(
        key,
        setTimeout(() => this.handleTimeout(chatId, eventId, reminderId), RETRY_DELAY),
      );
    }
  }

  getKey(chatId, eventId, reminderId) {
    return `${chatId}:${eventId}:${reminderId}`;
  }
}

module.exports = EventScheduler;
