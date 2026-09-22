const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

class ReminderStore {
  constructor(filePath = path.join(__dirname, "reminders.json")) {
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

      return remindersByChat;
    } catch (error) {
      if (error.code === "ENOENT") {
        return {};
      }

      throw error;
    }
  }

  add(chatId, content, dueAt) {
    if (!this.remindersByChat[chatId]) {
      this.remindersByChat[chatId] = [];
    }

    const reminder = {
      id: crypto.randomUUID(),
      content,
      dueAt,
    };

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

  save() {
    fs.writeFileSync(this.filePath, JSON.stringify(this.remindersByChat, null, 2));
  }
}

module.exports = ReminderStore;
