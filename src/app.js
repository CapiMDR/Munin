const { Client, LocalAuth } = require("whatsapp-web.js");
const { generateResponse, generateSummary, shouldAwardFeather, translateTrivia, suggestSimilarCommand, completeToolCall } = require("./ai/muninAI");
const { createAiToolExecutor } = require("./handlers/aiToolExecutor");
const { createMessageHandler } = require("./handlers/messageHandler");
const CommandHandler = require("./handlers/commandHandler");
const PendingStore = require("./stores/pendingStore");
const PendingScheduler = require("./schedulers/pendingScheduler");
const CustomCommandStore = require("./stores/customCommandStore");
const SavedMessageStore = require("./stores/savedMessageStore");
const ReminderScheduler = require("./schedulers/reminderScheduler");
const ReminderStore = require("./stores/reminderStore");
const ClassStore = require("./stores/classStore");
const ClassScheduler = require("./schedulers/classScheduler");
const AdminStore = require("./stores/adminStore");
const UserStatsStore = require("./stores/userStatsStore");
const WeeklyReportStore = require("./stores/weeklyReportStore");
const WeeklyReportScheduler = require("./schedulers/weeklyReportScheduler");
const AnimalImageApi = require("./apis/animalImageApi");
const OpenMeteoApi = require("./apis/openMeteoApi");
const OpenTriviaApi = require("./apis/openTriviaApi");
const { TriviaManager } = require("./services/triviaManager");
const { Summarizer } = require("./ai/summarizer");
const { IMAGE_MIME_TYPE, generateImage } = require("./apis/cloudflareImageApi");
const { createWhatsAppOutput } = require("./handlers/whatsappOutput");
const { scheduleTimer } = require("./schedulers/timerScheduler");
const { loadBotLid, saveBotLid } = require("./stores/botIdentityStore");
const { presentGroupReport } = require("./presenters/groupReportPresenter");

function createMuninApp({
  client = new Client({ authStrategy: new LocalAuth(), puppeteer: { headless: false } }),
  renderQr = console.log,
} = {}) {
  const animalImageApis = { cat: new AnimalImageApi("cat"), dog: new AnimalImageApi("dog") };
  const whatsappOutput = createWhatsAppOutput({
    animalImageApis,
    client,
    generateImage,
    imageMimeType: IMAGE_MIME_TYPE,
  });
  const sendMessage = (chatId, text, options) => whatsappOutput.deliver({ type: "text", chatId, text, options });
  const pendingStore = new PendingStore();
  const customCommandStore = new CustomCommandStore();
  const savedMessageStore = new SavedMessageStore();
  const pendingScheduler = new PendingScheduler(pendingStore, sendMessage);
  const reminderStore = new ReminderStore();
  const reminderScheduler = new ReminderScheduler(reminderStore, sendMessage);
  const classStore = new ClassStore();
  const classScheduler = new ClassScheduler(classStore, sendMessage);
  const adminStore = new AdminStore();
  const userStatsStore = new UserStatsStore();
  const weeklyReportStore = new WeeklyReportStore();
  const openMeteoApi = new OpenMeteoApi();
  const openTriviaApi = new OpenTriviaApi();
  const summarizer = new Summarizer();
  const triviaManager = new TriviaManager({
    sendMessage,
    getPlayerName: (chatId, mentionId) => userStatsStore.get(chatId, mentionId)?.name || mentionId,
    recordTriviaGamePlayed: (chatId, mentionId) => userStatsStore.recordTriviaGamePlayed(chatId, mentionId),
    recordTriviaAnswer: (chatId, mentionId, correct) => userStatsStore.recordTriviaAnswer(chatId, mentionId, correct),
    recordTriviaGameWon: (chatId, mentionId) => userStatsStore.recordTriviaGameWon(chatId, mentionId),
  });

  let aiToolExecutor;
  let commandHandler;
  const messageHandler = createMessageHandler({
    initialBotLid: loadBotLid(),
    saveBotLid,
    getCommandHandler: () => commandHandler,
    adminStore,
    userStatsStore,
    summarizer,
    triviaManager,
    shouldAwardFeather,
    generateResponse,
    aiToolExecutor: { execute: (...args) => aiToolExecutor.execute(...args) },
    completeToolCall,
    output: whatsappOutput,
    scheduleTimer,
  });

  aiToolExecutor = createAiToolExecutor({
    pendingStore,
    reminderStore,
    reminderScheduler,
    savedMessageStore,
    customCommandStore,
    userStatsStore,
    adminStore,
    output: whatsappOutput,
    openMeteoApi,
    openTriviaApi,
    translateTrivia,
    triviaManager,
    classStore,
    classScheduler,
    sendMessage,
    summarizer,
  });
  commandHandler = new CommandHandler({
    pendingStore,
    reminderStore,
    reminderScheduler,
    classStore,
    classScheduler,
    adminStore,
    customCommandStore,
    savedMessageStore,
    getBotLid: messageHandler.getBotLid,
    summarizer,
    generateSummary,
    suggestSimilarCommand,
    userStatsStore,
    weeklyReportStore,
    openMeteoApi,
    openTriviaApi,
    translateTrivia,
    triviaManager,
  });

  const buildGroupReport = (chatId) => {
    const report = userStatsStore.getGroupReport(chatId);
    report.currentPendings = pendingStore.getAll(chatId).length;
    return presentGroupReport(report);
  };
  const weeklyReportScheduler = new WeeklyReportScheduler(weeklyReportStore, userStatsStore, buildGroupReport, sendMessage);
  let pendingSchedulerStarted = false;

  function start() {
    reminderScheduler.start();
    classScheduler.start();
    client.on("qr", (qr) => {
      console.log("QR received");
      renderQr(qr);
    });
    client.on("authenticated", () => console.log("AUTHENTICATED"));
    client.on("auth_failure", (message) => console.error("AUTH FAILURE:", message));
    client.on("ready", () => {
      console.log("READY");
      if (!pendingSchedulerStarted) {
        pendingSchedulerStarted = true;
        pendingScheduler.start();
      }
      weeklyReportScheduler.start();
    });
    client.on("disconnected", (reason) => console.log("DISCONNECTED:", reason));
    client.on("group_join", async ({ chatId }) => {
      try {
        await sendMessage(chatId, "🐦‍⬛ Munin ha aterrizado.\nUsa !ayuda para ver lo que puede hacer.");
      } catch (error) {
        console.error("Group join error:", error);
      }
    });
    client.on("message_create", messageHandler.handleMessageCreate);
    client.initialize();
  }

  return { client, start };
}

module.exports = { createMuninApp };
