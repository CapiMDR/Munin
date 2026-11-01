const fs = require("fs");
const path = require("path");

/** Persists named elapsed-time starting points for each WhatsApp group. */
class CronometerStore {
  constructor(filePath = path.join(__dirname, "..", "..", "..", "data", "cronometers.json")) {
    this.filePath = filePath;
    this.cronometersByChat = this.load();
  }

  load() {
    try {
      const cronometersByChat = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
      if (typeof cronometersByChat !== "object" || cronometersByChat === null || Array.isArray(cronometersByChat)) {
        throw new Error("The cronometers file must contain an object keyed by chat ID.");
      }
      return cronometersByChat;
    } catch (error) {
      if (error.code === "ENOENT") return {};
      throw error;
    }
  }

  add(chatId, title, savedAt) {
    if (!this.cronometersByChat[chatId]) this.cronometersByChat[chatId] = [];
    const cronometer = { title, savedAt };
    this.cronometersByChat[chatId].push(cronometer);
    this.save();
    return cronometer;
  }

  getAll(chatId) {
    return this.cronometersByChat[chatId] || [];
  }

  remove(chatId, index) {
    const cronometers = this.cronometersByChat[chatId];
    if (!cronometers || index < 0 || index >= cronometers.length) return undefined;
    const [cronometer] = cronometers.splice(index, 1);
    this.save();
    return cronometer;
  }

  save() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.cronometersByChat, null, 2));
  }
}

module.exports = CronometerStore;
