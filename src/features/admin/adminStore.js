const fs = require("fs");
const path = require("path");
const { GLOBAL_ADMIN_ID } = require("../../config/adminConfig");

const INDEFINITE_DURATION = "indefinite";

class AdminStore {
  constructor(filePath = path.join(__dirname, "..", "..", "data", "admins.json")) {
    this.filePath = filePath;
    this.data = this.load();
  }
  load() {
    try {
      return JSON.parse(fs.readFileSync(this.filePath, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return {};
      throw error;
    }
  }
  chat(chatId) {
    if (!this.data[chatId]) this.data[chatId] = { admins: [], bans: {}, pausedUntil: null };
    return this.data[chatId];
  }
  isAdmin(chatId, userId) {
    return Boolean(userId) && (userId === GLOBAL_ADMIN_ID || this.chat(chatId).admins.includes(userId));
  }
  isGlobalAdmin(userId) {
    return Boolean(userId) && userId === GLOBAL_ADMIN_ID;
  }
  addAdmin(chatId, userId) {
    const chat = this.chat(chatId);
    if (!chat.admins.includes(userId)) {
      chat.admins.push(userId);
      this.save();
    }
  }
  removeAdmin(chatId, userId) {
    if (userId === GLOBAL_ADMIN_ID) return false;
    const chat = this.chat(chatId);
    chat.admins = chat.admins.filter((id) => id !== userId);
    this.save();
    return true;
  }
  ban(chatId, userId, until) {
    this.chat(chatId).bans[userId] = until;
    this.save();
  }
  banIndefinitely(chatId, userId) {
    this.ban(chatId, userId, INDEFINITE_DURATION);
  }
  unban(chatId, userId) {
    const chat = this.chat(chatId);
    if (!chat.bans[userId]) return false;
    delete chat.bans[userId];
    this.save();
    return true;
  }
  isBanned(chatId, userId) {
    const chat = this.chat(chatId),
      until = chat.bans[userId];
    if (!until) return false;
    if (until === INDEFINITE_DURATION) return true;
    if (until > Date.now()) return true;
    delete chat.bans[userId];
    this.save();
    return false;
  }
  pause(chatId, until) {
    this.chat(chatId).pausedUntil = until;
    this.save();
  }
  pauseIndefinitely(chatId) {
    this.pause(chatId, INDEFINITE_DURATION);
  }
  unpause(chatId) {
    const chat = this.chat(chatId);
    if (!chat.pausedUntil) return false;
    chat.pausedUntil = null;
    this.save();
    return true;
  }
  isPaused(chatId) {
    const chat = this.chat(chatId);
    if (!chat.pausedUntil) return false;
    if (chat.pausedUntil === INDEFINITE_DURATION) return true;
    if (chat.pausedUntil > Date.now()) return true;
    chat.pausedUntil = null;
    this.save();
    return false;
  }
  getBans(chatId) {
    const chat = this.chat(chatId);
    const now = Date.now();
    const bans = [];
    let removedExpiredBan = false;

    for (const [userId, until] of Object.entries(chat.bans)) {
      if (until === INDEFINITE_DURATION || until > now) {
        bans.push({ userId, until, isIndefinite: until === INDEFINITE_DURATION });
      } else {
        delete chat.bans[userId];
        removedExpiredBan = true;
      }
    }

    if (removedExpiredBan) this.save();
    return bans;
  }
  getAdmins(chatId) {
    const admins = this.chat(chatId).admins;
    return [...new Set([GLOBAL_ADMIN_ID, ...admins].filter(Boolean))];
  }
  save() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
  }
}

module.exports = AdminStore;
