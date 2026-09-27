const { MESSAGES } = require("../commandConstants");

const UTC_OFFSET_HOURS = -6;

class ClassScheduler {
  constructor(classStore, sendMessage) {
    this.classStore = classStore;
    this.sendMessage = sendMessage;
    this.timers = new Map(); // key: `${chatId}:${classId}`, value: timeout id
    this.midnightTimer = null;
  }

  start() {
    this.scheduleAllForToday();
    this.scheduleMidnightReset();
  }

  /**
   * Gets the current date/time adjusted to UTC-6.
   */
  getNow() {
    const now = new Date();
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
    return new Date(utcMs + UTC_OFFSET_HOURS * 3_600_000);
  }

  /**
   * Gets the current Spanish day name in lowercase.
   */
  getCurrentDay() {
    const dayIndex = this.getNow().getDay(); // 0=Sunday
    const jsToSpanish = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
    return jsToSpanish[dayIndex];
  }

  /**
   * Converts a time string "HH:mm" to minutes since midnight.
   */
  timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Schedules reminders for all classes happening today, across all groups with bell enabled.
   */
  scheduleAllForToday() {
    this.clearAllTimers();

    const today = this.getCurrentDay();
    const chats = this.classStore.getAllChatsWithBell();

    for (const { chatId, classes } of chats) {
      const todayClasses = classes.filter((cls) => cls.day === today);

      for (const cls of todayClasses) {
        this.scheduleReminder(chatId, cls);
      }
    }
  }

  /**
   * Reschedules all reminders for a specific chat (called after add/edit/delete/bell toggle).
   */
  rescheduleForChat(chatId) {
    // Clear existing timers for this chat
    for (const [key, timerId] of this.timers) {
      if (key.startsWith(`${chatId}:`)) {
        clearTimeout(timerId);
        this.timers.delete(key);
      }
    }

    if (!this.classStore.getBell(chatId)) {
      return;
    }

    const today = this.getCurrentDay();
    const classes = this.classStore.getAll(chatId).filter((cls) => cls.day === today);

    for (const cls of classes) {
      this.scheduleReminder(chatId, cls);
    }
  }

  /**
   * Schedules a single reminder for 10 minutes before the class starts.
   */
  scheduleReminder(chatId, cls) {
    const now = this.getNow();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const classMinutes = this.timeToMinutes(cls.startTime);
    const reminderMinutes = classMinutes - 10;

    // Only schedule if the reminder time hasn't passed yet
    if (reminderMinutes <= currentMinutes) {
      return;
    }

    const delayMs = (reminderMinutes - currentMinutes) * 60_000;
    // Adjust for seconds already elapsed in the current minute
    const adjustedDelay = delayMs - now.getSeconds() * 1000;

    const key = `${chatId}:${cls.id}`;
    const timerId = setTimeout(() => this.fireReminder(chatId, cls, key), Math.max(0, adjustedDelay));
    this.timers.set(key, timerId);
  }

  async fireReminder(chatId, cls, key) {
    this.timers.delete(key);

    try {
      await this.sendMessage(chatId, MESSAGES.CLASS_REMINDER(cls));
    } catch (error) {
      console.error("Could not deliver class reminder:", error);
    }
  }

  /**
   * Schedules a timer to re-schedule all classes at midnight (UTC-6).
   */
  scheduleMidnightReset() {
    if (this.midnightTimer) {
      clearTimeout(this.midnightTimer);
    }

    const now = this.getNow();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);

    const delayMs = midnight.getTime() - now.getTime();

    this.midnightTimer = setTimeout(() => {
      this.scheduleAllForToday();
      this.scheduleMidnightReset();
    }, delayMs + 1000); // +1s buffer to ensure we're in the new day
  }

  clearAllTimers() {
    for (const timerId of this.timers.values()) {
      clearTimeout(timerId);
    }

    this.timers.clear();
  }

  stop() {
    this.clearAllTimers();

    if (this.midnightTimer) {
      clearTimeout(this.midnightTimer);
      this.midnightTimer = null;
    }
  }
}

module.exports = ClassScheduler;
