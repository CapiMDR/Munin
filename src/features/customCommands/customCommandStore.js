const fs = require("fs");
const path = require("path");

class CustomCommandStore {
  constructor(filePath = path.join(__dirname, "..", "..", "..", "data", "customCommands.json")) {
    this.filePath = filePath;
    this.commandsByChat = this.load();
  }

  load() {
    try {
      const commandsByChat = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
      if (typeof commandsByChat !== "object" || commandsByChat === null || Array.isArray(commandsByChat)) {
        throw new Error("The custom commands file must contain an object keyed by chat ID.");
      }
      return commandsByChat;
    } catch (error) {
      if (error.code === "ENOENT") return {};
      throw error;
    }
  }

  has(chatId, command) {
    return Object.hasOwn(this.commandsByChat[chatId] || {}, command);
  }

  set(chatId, command, reply) {
    if (!this.commandsByChat[chatId]) this.commandsByChat[chatId] = {};
    const alreadyExists = this.has(chatId, command);
    this.commandsByChat[chatId][command] = reply;
    this.save();
    return alreadyExists;
  }

  get(chatId, command) {
    return this.commandsByChat[chatId]?.[command];
  }

  getAll(chatId) {
    return Object.entries(this.commandsByChat[chatId] || {})
      .map(([command, reply]) => ({ command, reply }))
      .sort((left, right) => left.command.localeCompare(right.command, "es"));
  }

  remove(chatId, command) {
    if (!this.has(chatId, command)) return undefined;
    const reply = this.commandsByChat[chatId][command];
    delete this.commandsByChat[chatId][command];
    this.save();
    return reply;
  }

  removeAt(chatId, index) {
    const command = this.getAll(chatId)[index]?.command;
    return command ? { command, reply: this.remove(chatId, command) } : undefined;
  }

  save() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.commandsByChat, null, 2));
  }
}

module.exports = CustomCommandStore;
