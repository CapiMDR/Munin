const MAX_TIMEOUT = 2 ** 31 - 1;
const RETRY_DELAY = 60_000;

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

    const delay = Math.max(0, reminder.dueAt - Date.now());
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
    if (reminder.dueAt > Date.now()) {
      this.schedule(reminder);
      return;
    }

    try {
      await this.sendMessage(reminder.chatId, `⏰ Recordatorio: ${reminder.content}`);
      this.reminderStore.removeById(reminder.chatId, reminder.id);
      this.timers.delete(reminder.id);
    } catch (error) {
      console.error("Could not deliver reminder:", error);
      const timer = setTimeout(() => this.handleTimeout(reminder), RETRY_DELAY);
      this.timers.set(reminder.id, timer);
    }
  }
}

module.exports = ReminderScheduler;
