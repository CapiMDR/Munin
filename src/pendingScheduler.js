const { MESSAGES } = require("./commandConstants");
const { groupPendingsByDate } = require("./pendingUtils");
const { getMexicoCityDate, getMexicoCityTime, millisecondsUntilTime } = require("./timeUtils");

const DAILY_SUMMARY_MINUTES = 8 * 60;

class PendingScheduler {
  constructor(pendingStore, sendMessage) {
    this.pendingStore = pendingStore;
    this.sendMessage = sendMessage;
    this.dailyTimer = null;
  }

  start() {
    this.scheduleNextSummary();
  }

  scheduleNextSummary() {
    if (this.dailyTimer) clearTimeout(this.dailyTimer);

    const delay = millisecondsUntilTime(getMexicoCityTime(), DAILY_SUMMARY_MINUTES);
    this.dailyTimer = setTimeout(async () => {
      await this.sendDailySummaries();
      this.scheduleNextSummary();
    }, delay);
  }

  async sendDailySummaries(today = getMexicoCityDate()) {
    for (const { chatId, pendings } of this.pendingStore.getAllWithChatIds()) {
      try {
        await this.sendMessage(chatId, MESSAGES.DAILY_PENDINGS(groupPendingsByDate(pendings, today)));
      } catch (error) {
        console.error("Could not deliver daily pending summary:", error);
      }
    }
  }

  stop() {
    if (this.dailyTimer) clearTimeout(this.dailyTimer);
    this.dailyTimer = null;
  }
}

module.exports = PendingScheduler;
