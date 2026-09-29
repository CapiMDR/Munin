const PendingStore = require("../stores/pendingStore");
const CustomCommandStore = require("../stores/customCommandStore");
const SavedMessageStore = require("../stores/savedMessageStore");
const ReminderStore = require("../stores/reminderStore");
const ClassStore = require("../stores/classStore");
const AdminStore = require("../stores/adminStore");
const UserStatsStore = require("../stores/userStatsStore");
const WeeklyReportStore = require("../stores/weeklyReportStore");
const PendingScheduler = require("../schedulers/pendingScheduler");
const ReminderScheduler = require("../schedulers/reminderScheduler");
const ClassScheduler = require("../schedulers/classScheduler");
const WeeklyReportScheduler = require("../schedulers/weeklyReportScheduler");
const { scheduleTimer } = require("../schedulers/timerScheduler");
const AnimalImageApi = require("../apis/animalImageApi");
const OpenMeteoApi = require("../apis/openMeteoApi");
const OpenTriviaApi = require("../apis/openTriviaApi");
const { createWhatsAppOutput } = require("../handlers/whatsappOutput");
const { presentGroupReport } = require("../presenters/groupReportPresenter");

/**
 * Creates process-wide storage, API, scheduling, and WhatsApp transport dependencies.
 * @param {object} options Infrastructure configuration.
 * @returns {object} Grouped infrastructure dependencies.
 */
function createInfrastructure({ client, generateImage, imageMimeType }) {
  const animalImageApis = { cat: new AnimalImageApi("cat"), dog: new AnimalImageApi("dog") };
  const output = createWhatsAppOutput({ animalImageApis, client, generateImage, imageMimeType });
  const sendMessage = (chatId, text, options) => output.deliver({ type: "text", chatId, text, options });

  const stores = {
    pending: new PendingStore(),
    customCommands: new CustomCommandStore(),
    savedMessages: new SavedMessageStore(),
    reminders: new ReminderStore(),
    classes: new ClassStore(),
    admins: new AdminStore(),
    userStats: new UserStatsStore(),
    weeklyReports: new WeeklyReportStore(),
  };
  const apis = {
    animals: animalImageApis,
    weather: new OpenMeteoApi(),
    trivia: new OpenTriviaApi(),
  };
  const buildGroupReport = (chatId) => {
    const report = stores.userStats.getGroupReport(chatId);
    report.currentPendings = stores.pending.getAll(chatId).length;
    return presentGroupReport(report);
  };
  const schedulers = {
    pending: new PendingScheduler(stores.pending, sendMessage),
    reminders: new ReminderScheduler(stores.reminders, sendMessage),
    classes: new ClassScheduler(stores.classes, sendMessage),
    weeklyReports: new WeeklyReportScheduler(stores.weeklyReports, stores.userStats, buildGroupReport, sendMessage),
    scheduleTimer,
  };

  return { apis, output, schedulers, sendMessage, stores };
}

module.exports = { createInfrastructure };
