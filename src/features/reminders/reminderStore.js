const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

class ReminderStore {
  constructor(filePath = path.join(__dirname, "..", "..", "..", "data", "reminders.json")) {
    this.filePath = filePath;
    this.remindersByChat = this.load();
  }

  load() {
    try {
      const contents = fs.readFileSync(this.filePath, "utf8");
      const remindersByChat = JSON.parse(contents);

      if (typeof remindersByChat !== "object" || remindersByChat === null || Array.isArray(remindersByChat)) {
        throw new Error("The reminders file must contain an object keyed by chat ID.");
      }

      const { remindersByChat: normalized, changed } = normalizeReminders(remindersByChat);
      if (changed) {
        this.remindersByChat = normalized;
        this.save();
      }
      return normalized;
    } catch (error) {
      if (error.code === "ENOENT") {
        return {};
      }

      throw error;
    }
  }

  add(chatId, text, startAt, messageId) {
    return this.addReminder(chatId, createReminder({ text, startAt, messageId }));
  }

  addRecurring(chatId, text, startAt, intervalMs, count, messageId) {
    return this.addReminder(
      chatId,
      createReminder({
        text,
        startAt,
        messageId,
        recurrence: {
          frequency: "relative",
          interval: intervalMs,
          daysOfWeek: null,
          dayOfMonth: null,
          until: null,
          count,
        },
      }),
    );
  }

  addWeekly(chatId, text, startAt, recurrence, messageId) {
    return this.addReminder(chatId, createReminder({ text, startAt, recurrence, messageId }));
  }

  addReminder(chatId, reminderData) {
    if (!this.remindersByChat[chatId]) {
      this.remindersByChat[chatId] = [];
    }

    const reminder = reminderData.id ? reminderData : { id: crypto.randomUUID(), ...reminderData };

    this.remindersByChat[chatId].push(reminder);
    this.save();
    return reminder;
  }

  getAll(chatId) {
    return this.remindersByChat[chatId] || [];
  }

  getAllWithChatIds() {
    return Object.entries(this.remindersByChat).flatMap(([chatId, reminders]) =>
      reminders.map((reminder) => ({
        chatId,
        ...reminder,
      })),
    );
  }

  remove(chatId, index) {
    const reminders = this.remindersByChat[chatId];

    if (!reminders || index < 0 || index >= reminders.length) {
      return undefined;
    }

    const [reminder] = reminders.splice(index, 1);
    this.save();
    return reminder;
  }

  removeById(chatId, reminderId) {
    const reminders = this.remindersByChat[chatId];
    const index = reminders?.findIndex((reminder) => reminder.id === reminderId) ?? -1;

    return index === -1 ? undefined : this.remove(chatId, index);
  }

  updateById(chatId, reminderId, fields) {
    const reminder = this.remindersByChat[chatId]?.find((item) => item.id === reminderId);
    if (!reminder) return undefined;
    Object.assign(reminder, fields);
    this.save();
    return reminder;
  }

  save() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.remindersByChat, null, 2));
  }
}

function createReminder({ text, startAt, recurrence = null, messageId }) {
  const startTimestamp = toTimestamp(startAt);
  const now = new Date().toISOString();
  return {
    id: `rem_${crypto.randomUUID()}`,
    text,
    ...(messageId ? { messageId } : {}),
    startAt: new Date(startTimestamp).toISOString(),
    recurrence,
    nextTriggerAt: new Date(startTimestamp).toISOString(),
    lastTriggeredAt: null,
    triggerCount: 0,
    status: "active",
    createdAt: now,
  };
}

function normalizeReminders(remindersByChat) {
  let changed = false;
  const normalized = {};

  for (const [chatId, reminders] of Object.entries(remindersByChat)) {
    if (!Array.isArray(reminders)) throw new Error("Each chat's reminders must be an array.");
    normalized[chatId] = reminders.map((reminder) => {
      if (reminder.text && reminder.startAt && reminder.nextTriggerAt) return reminder;
      changed = true;
      const dueAt = toTimestamp(reminder.dueAt);
      const recurrence = reminder.intervalMs
        ? {
            frequency: "relative",
            interval: reminder.intervalMs,
            daysOfWeek: null,
            dayOfMonth: null,
            until: null,
            count: reminder.remaining ?? null,
          }
        : null;
      return {
        id: reminder.id || crypto.randomUUID(),
        text: reminder.content,
        startAt: new Date(dueAt).toISOString(),
        recurrence,
        nextTriggerAt: new Date(dueAt).toISOString(),
        lastTriggeredAt: null,
        triggerCount: 0,
        status: "active",
        createdAt: new Date().toISOString(),
      };
    });
  }

  return { remindersByChat: normalized, changed };
}

function toTimestamp(value) {
  const timestamp = typeof value === "number" ? value : Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error("Reminder timestamps must be valid.");
  return timestamp;
}

module.exports = ReminderStore;
