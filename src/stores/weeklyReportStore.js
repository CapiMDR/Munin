const fs = require("fs");
const path = require("path");

class WeeklyReportStore {
  constructor(filePath = path.join(__dirname, "..", "..", "data", "weeklyReports.json")) {
    this.filePath = filePath;
    this.enabledByChat = this.load();
  }

  load() {
    try {
      const data = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
      if (typeof data !== "object" || data === null || Array.isArray(data))
        throw new Error("Weekly report settings must be an object keyed by chat ID.");
      return data;
    } catch (error) {
      if (error.code === "ENOENT") return {};
      throw error;
    }
  }

  isEnabled(chatId) {
    return this.enabledByChat[chatId] === true;
  }

  toggle(chatId) {
    const enabled = !this.isEnabled(chatId);
    this.enabledByChat[chatId] = enabled;
    this.save();
    return enabled;
  }

  getEnabledChatIds() {
    return Object.entries(this.enabledByChat)
      .filter(([, enabled]) => enabled)
      .map(([chatId]) => chatId);
  }

  save() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.enabledByChat, null, 2));
  }
}

module.exports = WeeklyReportStore;
