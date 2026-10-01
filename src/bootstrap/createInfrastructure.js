const PendingStore = require("../features/pendings/pendingStore");
const CustomCommandStore = require("../features/customCommands/customCommandStore");
const SavedMessageStore = require("../features/savedMessages/savedMessageStore");
const ReminderStore = require("../features/reminders/reminderStore");
const ClassStore = require("../features/classes/classStore");
const AdminStore = require("../features/admin/adminStore");
const UserStatsStore = require("../features/stats/userStatsStore");
const WeeklyReportStore = require("../features/reports/weeklyReportStore");
const EventStore = require("../features/events/eventStore");
const PendingScheduler = require("../features/pendings/pendingScheduler");
const ReminderScheduler = require("../features/reminders/reminderScheduler");
const ClassScheduler = require("../features/classes/classScheduler");
const WeeklyReportScheduler = require("../features/reports/weeklyReportScheduler");
const EventScheduler = require("../features/events/eventScheduler");
const { scheduleTimer } = require("../core/timerScheduler");
const AnimalImageApi = require("../apis/animalImageApi");
const OpenMeteoApi = require("../apis/openMeteoApi");
const OpenTriviaApi = require("../apis/openTriviaApi");
const { createWhatsAppOutput } = require("../handlers/whatsappOutput");
const { presentGroupReport } = require("../features/reports/groupReportPresenter");

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
    events: new EventStore(),
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
    events: new EventScheduler(stores.events, sendMessage),
    scheduleTimer,
  };

  return { apis, output, schedulers, sendMessage, stores };
}

module.exports = { createInfrastructure };
