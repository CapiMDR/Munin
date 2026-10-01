const fs = require("fs");
const path = require("path");
const { formatDailyPendings } = require("./pendingPresenter");
const { groupPendingsByDate } = require("./pendingUtils");
const { getMexicoCityDate, getMexicoCityDateKey, getMexicoCityTime, millisecondsUntilTime } = require("../../utils/timeUtils");

const DAILY_SUMMARY_MINUTES = 8 * 60;

class PendingScheduler {
  constructor(pendingStore, sendMessage, stateFilePath = path.join(__dirname, "..", "..", "data", "pendingSummaryState.json")) {
    this.pendingStore = pendingStore;
    this.sendMessage = sendMessage;
    this.stateFilePath = stateFilePath;
    this.lastSentByChat = this.loadState();
    this.dailyTimer = null;
  }

  start() {
    this.sendMissedSummaryIfNeeded().catch((error) => console.error("Could not send missed pending summaries:", error));
    this.scheduleNextSummary();
  }

  async sendMissedSummaryIfNeeded() {
    const now = getMexicoCityTime();
    if (now.minutes < DAILY_SUMMARY_MINUTES) return;

    await this.sendDailySummaries(getMexicoCityDate(), getMexicoCityDateKey());
  }

  scheduleNextSummary() {
    if (this.dailyTimer) clearTimeout(this.dailyTimer);

    const delay = millisecondsUntilTime(getMexicoCityTime(), DAILY_SUMMARY_MINUTES);
    this.dailyTimer = setTimeout(async () => {
      await this.sendDailySummaries(getMexicoCityDate(), getMexicoCityDateKey());
      this.scheduleNextSummary();
    }, delay);
  }

  async sendDailySummaries(today = getMexicoCityDate(), dateKey = getMexicoCityDateKey()) {
    for (const { chatId, pendings } of this.pendingStore.getAllWithChatIds()) {
      if (this.lastSentByChat[chatId] === dateKey) continue;

      try {
        await this.sendMessage(chatId, formatDailyPendings(groupPendingsByDate(pendings, today)));
        this.lastSentByChat[chatId] = dateKey;
        this.saveState();
      } catch (error) {
        console.error("Could not deliver daily pending summary:", error);
      }
    }
  }

  stop() {
    if (this.dailyTimer) clearTimeout(this.dailyTimer);
    this.dailyTimer = null;
  }

  loadState() {
    try {
      const state = JSON.parse(fs.readFileSync(this.stateFilePath, "utf8"));
      if (typeof state !== "object" || state === null || Array.isArray(state)) throw new Error("Invalid pending summary state.");
      return state;
    } catch (error) {
      if (error.code === "ENOENT") return {};
      console.warn("Could not load pending summary state; starting fresh:", error.message);
      return {};
    }
  }

  saveState() {
    fs.mkdirSync(path.dirname(this.stateFilePath), { recursive: true });
    fs.writeFileSync(this.stateFilePath, JSON.stringify(this.lastSentByChat, null, 2));
  }
}

module.exports = PendingScheduler;
