const fs = require("fs");
const path = require("path");
const { getMexicoCityDateKey, getMexicoCityTime } = require("../../utils/timeUtils");

const SUNDAY = "domingo";
const MONDAY = "lunes";
const REPORT_MINUTES = 18 * 60;
const DAY_SECONDS = 24 * 60 * 60;

class WeeklyReportScheduler {
  constructor(
    weeklyReportStore,
    userStatsStore,
    buildReport,
    sendMessage,
    stateFilePath = path.join(__dirname, "..", "..", "..", "data", "weeklyReportState.json"),
  ) {
    this.weeklyReportStore = weeklyReportStore;
    this.userStatsStore = userStatsStore;
    this.buildReport = buildReport;
    this.sendMessage = sendMessage;
    this.stateFilePath = stateFilePath;
    this.lastSentByChat = this.loadState();
    this.reportTimer = null;
    this.resetTimer = null;
    this.reportDeliveryPromise = null;
  }

  start() {
    this.sendMissedReportIfNeeded().catch((error) => console.error("Could not send missed weekly reports:", error));
    this.scheduleNextReport();
    this.scheduleNextReset();
  }

  async sendMissedReportIfNeeded() {
    const now = getMexicoCityTime();
    if (now.day !== SUNDAY || now.minutes < REPORT_MINUTES) return;

    await this.sendWeeklyReports(getMexicoCityDateKey());
  }

  scheduleNextReport() {
    this.schedule("reportTimer", SUNDAY, REPORT_MINUTES, async () => {
      await this.sendWeeklyReports(getMexicoCityDateKey());
    });
  }

  async sendWeeklyReports(reportKey = getMexicoCityDateKey()) {
    if (this.reportDeliveryPromise) return this.reportDeliveryPromise;

    this.reportDeliveryPromise = this.deliverWeeklyReports(reportKey);

    try {
      await this.reportDeliveryPromise;
    } finally {
      this.reportDeliveryPromise = null;
    }
  }

  async deliverWeeklyReports(reportKey) {
    for (const chatId of this.weeklyReportStore.getEnabledChatIds()) {
      if (this.lastSentByChat[chatId] === reportKey) continue;

      try {
        await this.sendMessage(chatId, this.buildReport(chatId));
        this.lastSentByChat[chatId] = reportKey;
        this.saveState();
      } catch (error) {
        console.error(`Could not send weekly report to ${chatId}:`, error);
      }
    }
  }

  scheduleNextReset() {
    this.schedule("resetTimer", MONDAY, 0, async () => {
      for (const chatId of this.weeklyReportStore.getEnabledChatIds()) {
        this.userStatsStore.resetWeeklyStats(chatId);
      }
    });
  }

  schedule(timerName, day, minutes, task) {
    if (this[timerName]) clearTimeout(this[timerName]);
    this[timerName] = setTimeout(async () => {
      await task();
      this.schedule(timerName, day, minutes, task);
    }, millisecondsUntilDayTime(day, minutes));
  }

  stop() {
    if (this.reportTimer) clearTimeout(this.reportTimer);
    if (this.resetTimer) clearTimeout(this.resetTimer);
    this.reportTimer = null;
    this.resetTimer = null;
  }

  loadState() {
    try {
      const state = JSON.parse(fs.readFileSync(this.stateFilePath, "utf8"));
      if (typeof state !== "object" || state === null || Array.isArray(state)) throw new Error("Invalid weekly report state.");
      return state;
    } catch (error) {
      if (error.code === "ENOENT") return {};
      console.warn("Could not load weekly report state; starting fresh:", error.message);
      return {};
    }
  }

  saveState() {
    fs.mkdirSync(path.dirname(this.stateFilePath), { recursive: true });
    fs.writeFileSync(this.stateFilePath, JSON.stringify(this.lastSentByChat, null, 2));
  }
}

function millisecondsUntilDayTime(targetDay, targetMinutes) {
  const now = getMexicoCityTime();
  const dayIndexes = { domingo: 0, lunes: 1, martes: 2, miércoles: 3, jueves: 4, viernes: 5, sábado: 6 };
  const currentSeconds = now.minutes * 60 + now.seconds;
  const targetSeconds = targetMinutes * 60;
  let seconds = ((dayIndexes[targetDay] - dayIndexes[now.day] + 7) % 7) * DAY_SECONDS + targetSeconds - currentSeconds;
  if (seconds <= 0) seconds += 7 * DAY_SECONDS;
  return seconds * 1_000;
}

module.exports = WeeklyReportScheduler;
