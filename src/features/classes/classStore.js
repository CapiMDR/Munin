const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { DAYS_ORDER } = require("../../utils/timeUtils");

class ClassStore {
  constructor(filePath = path.join(__dirname, "..", "..", "..", "data", "classes.json")) {
    this.filePath = filePath;
    this.dataByChat = this.load();
  }

  load() {
    try {
      const contents = fs.readFileSync(this.filePath, "utf8");
      const data = JSON.parse(contents);

      if (typeof data !== "object" || data === null || Array.isArray(data)) {
        throw new Error("The classes file must contain an object keyed by chat ID.");
      }

      return data;
    } catch (error) {
      if (error.code === "ENOENT") {
        return {};
      }

      throw error;
    }
  }

  ensureChat(chatId) {
    if (!this.dataByChat[chatId]) {
      this.dataByChat[chatId] = { bell: true, classes: [] };
    }

    return this.dataByChat[chatId];
  }

  add(chatId, classData) {
    const chat = this.ensureChat(chatId);

    const newClass = {
      id: crypto.randomUUID(),
      name: classData.name,
      day: classData.day.toLowerCase(),
      startTime: classData.startTime,
      endTime: classData.endTime,
      classroom: classData.classroom,
    };

    chat.classes.push(newClass);
    this.save();
    return newClass;
  }

  getAll(chatId) {
    return this.ensureChat(chatId).classes;
  }

  /**
   * Returns all classes sorted by day of week (Monday first) then by start time.
   * Each class gets a `globalIndex` property (1-based) for user-facing display.
   */
  getAllSorted(chatId) {
    const classes = [...this.getAll(chatId)];

    classes.sort((a, b) => {
      const dayDiff = DAYS_ORDER.indexOf(a.day) - DAYS_ORDER.indexOf(b.day);

      if (dayDiff !== 0) {
        return dayDiff;
      }

      return a.startTime.localeCompare(b.startTime);
    });

    return classes.map((cls, index) => ({ ...cls, globalIndex: index + 1 }));
  }

  /**
   * Returns all classes for a specific day, sorted by start time.
   */
  getByDay(chatId, day) {
    return this.getAllSorted(chatId).filter((cls) => cls.day === day.toLowerCase());
  }

  /**
   * Finds a class by its global index (1-based, from getAllSorted).
   */
  getByGlobalIndex(chatId, globalIndex) {
    const sorted = this.getAllSorted(chatId);
    return sorted.find((cls) => cls.globalIndex === globalIndex) || undefined;
  }

  /**
   * Finds classes by name (case-insensitive). Returns an array since names can be duplicated.
   */
  getByName(chatId, name) {
    const normalizedName = name.toLowerCase().trim();
    return this.getAllSorted(chatId).filter((cls) => cls.name.toLowerCase() === normalizedName);
  }

  /**
   * Resolves a class identifier (index number or name string) to a single class.
   * Returns { class, ambiguous } where ambiguous is true if multiple matches by name.
   */
  resolve(chatId, identifier) {
    const asNumber = Number(identifier);

    if (Number.isInteger(asNumber) && asNumber >= 1) {
      const cls = this.getByGlobalIndex(chatId, asNumber);
      return { class: cls || undefined, ambiguous: false };
    }

    const matches = this.getByName(chatId, identifier);

    if (matches.length === 0) {
      return { class: undefined, ambiguous: false };
    }

    if (matches.length > 1) {
      return { class: undefined, ambiguous: true, matches };
    }

    return { class: matches[0], ambiguous: false };
  }

  update(chatId, classId, fields) {
    const chat = this.ensureChat(chatId);
    const cls = chat.classes.find((c) => c.id === classId);

    if (!cls) {
      return undefined;
    }

    if (fields.name !== undefined) cls.name = fields.name;
    if (fields.day !== undefined) cls.day = fields.day.toLowerCase();
    if (fields.startTime !== undefined) cls.startTime = fields.startTime;
    if (fields.endTime !== undefined) cls.endTime = fields.endTime;
    if (fields.classroom !== undefined) cls.classroom = fields.classroom;

    this.save();
    return cls;
  }

  remove(chatId, classId) {
    const chat = this.ensureChat(chatId);
    const index = chat.classes.findIndex((c) => c.id === classId);

    if (index === -1) {
      return undefined;
    }

    const [removed] = chat.classes.splice(index, 1);
    this.save();
    return removed;
  }

  getBell(chatId) {
    return this.ensureChat(chatId).bell;
  }

  toggleBell(chatId) {
    const chat = this.ensureChat(chatId);
    chat.bell = !chat.bell;
    this.save();
    return chat.bell;
  }

  setBell(chatId, enabled) {
    const chat = this.ensureChat(chatId);
    chat.bell = enabled;
    this.save();
    return chat.bell;
  }

  getAllChatsWithBell() {
    return Object.entries(this.dataByChat)
      .filter(([, data]) => data.bell)
      .map(([chatId, data]) => ({ chatId, classes: data.classes }));
  }

  save() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.dataByChat, null, 2));
  }
}

module.exports = ClassStore;
