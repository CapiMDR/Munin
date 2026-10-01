const fs = require("fs");
const path = require("path");
const { createDefaultEventReminders } = require("./eventDefaults");

/** Persists the events belonging to each WhatsApp group. */
class EventStore {
  constructor(filePath = path.join(__dirname, "..", "..", "data", "events.json")) {
    this.filePath = filePath;
    this.eventsByChat = this.load();
  }

  load() {
    try {
      const eventsByChat = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
      if (typeof eventsByChat !== "object" || eventsByChat === null || Array.isArray(eventsByChat)) {
        throw new Error("The events file must contain an object keyed by chat ID.");
      }
      let changed = false;
      for (const [chatId, events] of Object.entries(eventsByChat)) {
        if (!Array.isArray(events)) throw new Error("Each chat's events must be an array.");
        eventsByChat[chatId] = events.map((event) => {
          if (Array.isArray(event.reminders)) return event;
          changed = true;
          return { ...event, reminders: createDefaultEventReminders(event.type || "social", event.id) };
        });
      }
      if (changed) this.saveEvents(eventsByChat);
      return eventsByChat;
    } catch (error) {
      if (error.code === "ENOENT") return {};
      throw error;
    }
  }

  add(chatId, event) {
    if (!this.eventsByChat[chatId]) this.eventsByChat[chatId] = [];
    this.eventsByChat[chatId].push(event);
    this.save();
    return event;
  }

  getAll(chatId) {
    return this.eventsByChat[chatId] || [];
  }

  getById(chatId, id) {
    return this.getAll(chatId).find((event) => String(event.id) === String(id));
  }

  getNextId(chatId) {
    const numericIds = this.getAll(chatId)
      .map((event) => Number(event.id))
      .filter(Number.isInteger);
    return String(Math.max(0, ...numericIds) + 1);
  }

  updateById(chatId, id, fields) {
    const event = this.getById(chatId, id);
    if (!event) return undefined;
    Object.assign(event, fields);
    this.save();
    return event;
  }

  removeById(chatId, id) {
    const events = this.eventsByChat[chatId];
    const index = events?.findIndex((event) => String(event.id) === String(id)) ?? -1;
    if (index < 0) return undefined;
    const [event] = events.splice(index, 1);
    this.save();
    return event;
  }

  save() {
    this.saveEvents(this.eventsByChat);
  }

  saveEvents(eventsByChat) {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(eventsByChat, null, 2));
  }
}

module.exports = EventStore;
