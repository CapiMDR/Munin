const MAX_TIMEOUT = 2 ** 31 - 1;
const RETRY_DELAY = 60_000;
const { MESSAGES } = require("../commandConstants");
const { getNextWeeklyTrigger, timestampOf, toIso } = require("./reminderSchedule");

class ReminderScheduler {
  constructor(reminderStore, sendMessage) {
    this.reminderStore = reminderStore;
    this.sendMessage = sendMessage;
    this.timers = new Map();
  }

  start() {
    this.reminderStore.getAllWithChatIds().forEach((reminder) => this.schedule(reminder));
  }

  schedule(reminder) {
    this.cancel(reminder.id);
    if (reminder.status !== "active") return;

    const delay = Math.max(0, timestampOf(reminder.nextTriggerAt) - Date.now());
    const timeoutDelay = Math.min(delay, MAX_TIMEOUT);
    const timer = setTimeout(() => this.handleTimeout(reminder), timeoutDelay);

    this.timers.set(reminder.id, timer);
  }

  cancel(reminderId) {
    const timer = this.timers.get(reminderId);

    if (timer) {
      clearTimeout(timer);
      this.timers.delete(reminderId);
    }
  }

  async handleTimeout(reminder) {
    const nextTriggerAt = timestampOf(reminder.nextTriggerAt);
    if (nextTriggerAt > Date.now()) {
      this.schedule(reminder);
      return;
    }

    try {
      await this.sendMessage(
        reminder.chatId,
        MESSAGES.REMINDER_DUE(reminder.text),
        reminder.messageId ? { quotedMessageId: reminder.messageId } : undefined,
      );
      const triggeredAt = Date.now();
      const updates = {
        lastTriggeredAt: toIso(triggeredAt),
        triggerCount: reminder.triggerCount + 1,
      };
      const nextTrigger = getNextTrigger(reminder, triggeredAt, updates.triggerCount);

      if (nextTrigger) {
        const nextReminder = this.reminderStore.updateById(reminder.chatId, reminder.id, {
          ...updates,
          nextTriggerAt: toIso(nextTrigger),
        });
        this.schedule({ chatId: reminder.chatId, ...nextReminder });
      } else {
        this.reminderStore.removeById(reminder.chatId, reminder.id);
        this.timers.delete(reminder.id);
      }
    } catch (error) {
      console.error("Could not deliver reminder:", error);
      const timer = setTimeout(() => this.handleTimeout(reminder), RETRY_DELAY);
      this.timers.set(reminder.id, timer);
    }
  }
}

function getNextTrigger(reminder, triggeredAt, triggerCount) {
  const recurrence = reminder.recurrence;
  if (!recurrence) return undefined;
  if (recurrence.count !== null && triggerCount >= recurrence.count) return undefined;

  if (recurrence.frequency === "relative") {
    let next = timestampOf(reminder.nextTriggerAt) + recurrence.interval;
    while (next <= triggeredAt) next += recurrence.interval;
    return next;
  }

  if (recurrence.frequency === "week") return getNextWeeklyTrigger(reminder, triggeredAt);
  return undefined;
}

module.exports = ReminderScheduler;
