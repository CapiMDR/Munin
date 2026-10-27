const fs = require("fs");
const path = require("path");

class SavedMessageStore {
  constructor(filePath = path.join(__dirname, "..", "..", "..", "data", "savedMessages.json")) {
    this.filePath = filePath;
    this.messagesByChat = this.load();
  }

  load() {
    try {
      const messagesByChat = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
      if (typeof messagesByChat !== "object" || messagesByChat === null || Array.isArray(messagesByChat)) {
        throw new Error("The saved messages file must contain an object keyed by chat ID.");
      }
      return messagesByChat;
    } catch (error) {
      if (error.code === "ENOENT") return {};
      throw error;
    }
  }

  set(chatId, title, messageId, savedAt) {
    if (!this.messagesByChat[chatId]) this.messagesByChat[chatId] = {};
    const key = title.toLowerCase();
    const alreadyExists = Object.hasOwn(this.messagesByChat[chatId], key);
    this.messagesByChat[chatId][key] = { title, messageId, savedAt };
    this.save();
    return alreadyExists;
  }

  get(chatId, title) {
    return this.messagesByChat[chatId]?.[title.toLowerCase()];
  }

  getAll(chatId) {
    return Object.values(this.messagesByChat[chatId] || {}).sort((left, right) => left.title.localeCompare(right.title, "es"));
  }

  removeAt(chatId, index) {
    const savedMessage = this.getAll(chatId)[index];
    if (!savedMessage) return undefined;
    const messages = this.messagesByChat[chatId];
    const key = savedMessage.title.toLowerCase();
    delete messages[key];
    this.save();
    return savedMessage;
  }

  removeAtMany(chatId, indexes) {
    const savedMessages = this.getAll(chatId);
    const removed = [...new Set(indexes)].map((index) => savedMessages[index]).filter(Boolean);
    if (!removed.length) return removed;

    const messages = this.messagesByChat[chatId];
    removed.forEach((savedMessage) => delete messages[savedMessage.title.toLowerCase()]);
    this.save();
    return removed;
  }

  save() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.messagesByChat, null, 2));
  }
}

module.exports = SavedMessageStore;
