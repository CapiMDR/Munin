const fs = require("fs");
const path = require("path");

class PendingStore {
  constructor(filePath = path.join(__dirname, "..", "..", "data", "pendientes.json")) {
    this.filePath = filePath;
    this.pendingsByChat = this.load();
  }

  // Load pending items from the JSON file. If the file doesn't exist, it initializes an empty object.
  load() {
    try {
      const contents = fs.readFileSync(this.filePath, "utf8");
      const pendingsByChat = JSON.parse(contents);

      if (typeof pendingsByChat !== "object" || pendingsByChat === null || Array.isArray(pendingsByChat)) {
        throw new Error("The pendientes file must contain an object keyed by chat ID.");
      }

      return pendingsByChat;
    } catch (error) {
      if (error.code === "ENOENT") {
        return {};
      }

      throw error;
    }
  }

  // Add a pending item for a specific chat. If the chat doesn't exist, it initializes an empty array for that chat.
  add(chatId, content, date, time) {
    if (!this.pendingsByChat[chatId]) {
      this.pendingsByChat[chatId] = [];
    }

    const pending = { content, date, time };
    this.pendingsByChat[chatId].push(pending);
    this.save();
    return pending;
  }

  getAll(chatId) {
    return this.pendingsByChat[chatId] || [];
  }

  getAllWithChatIds() {
    return Object.entries(this.pendingsByChat)
      .filter(([, pendings]) => pendings.length > 0)
      .map(([chatId, pendings]) => ({ chatId, pendings }));
  }

  // Remove a pending item by its index (0-based) for a specific chat. Returns the removed pending item, or undefined if the index was invalid.
  remove(chatId, index) {
    const pendings = this.pendingsByChat[chatId];

    if (!pendings || index < 0 || index >= pendings.length) {
      return undefined;
    }

    const [pending] = pendings.splice(index, 1);
    this.save();
    return pending;
  }

  save() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.pendingsByChat, null, 2));
  }
}

module.exports = PendingStore;
