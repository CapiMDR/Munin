const { getMexicoCityTime } = require("./timeUtils");

const SUNDAY = "domingo";
const MONDAY = "lunes";
const REPORT_MINUTES = 8 * 60;
const DAY_SECONDS = 24 * 60 * 60;

class WeeklyReportScheduler {
  constructor(weeklyReportStore, userStatsStore, buildReport, sendMessage) {
    this.weeklyReportStore = weeklyReportStore;
    this.userStatsStore = userStatsStore;
    this.buildReport = buildReport;
    this.sendMessage = sendMessage;
    this.reportTimer = null;
    this.resetTimer = null;
  }

  start() {
    this.scheduleNextReport();
    this.scheduleNextReset();
  }

  scheduleNextReport() {
    this.schedule("reportTimer", SUNDAY, REPORT_MINUTES, async () => {
      for (const chatId of this.weeklyReportStore.getEnabledChatIds()) {
        try {
          await this.sendMessage(chatId, this.buildReport(chatId));
        } catch (error) {
          console.error(`Could not send weekly report to ${chatId}:`, error);
        }
      }
    });
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
