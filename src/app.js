const { Client, LocalAuth, MessageMedia, Poll } = require("whatsapp-web.js");
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
const { loadBotLid, saveBotLid } = require("./stores/botIdentityStore");
const { presentGroupReport } = require("./presenters/groupReportPresenter");

function createMuninApp({
  client = new Client({ authStrategy: new LocalAuth(), puppeteer: { headless: false } }),
  renderQr = console.log,
  testMode = false,
  testChatId = process.env.TEST_CHAT_ID?.trim() || "",
  sendMaintenanceMessage = false,
  featherCooldownMs = 30 * 60 * 1_000,
} = {}) {
  const sendMessage = (chatId, message, options) => client.sendMessage(chatId, message, options);
  const sendPoll = (chatId, title, options, allowMultipleAnswers) => sendMessage(chatId, new Poll(title, options, { allowMultipleAnswers }));
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
  const animalImageApis = { cat: new AnimalImageApi("cat"), dog: new AnimalImageApi("dog") };
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
    sendMessage,
    sendReaction: (messageId, reaction) => client.sendReaction(messageId, reaction),
    testMode,
    testChatId,
    sendMaintenanceMessage,
    featherCooldownMs,
  });

  const sendAnimalImage = async (chatId, animal) => {
    const animalApi = animalImageApis[animal];
    if (!animalApi) throw new Error(`Unsupported animal: ${animal}`);
    const image = await animalApi.getRandomImage();
    await sendMessage(chatId, await MessageMedia.fromUrl(image.url, { unsafeMime: true }));
    return image;
  };
  const scheduleTimer = (duration, callback) =>
    setTimeout(() => callback().catch((error) => console.error("Could not deliver timer:", error)), duration);

  aiToolExecutor = createAiToolExecutor({
    pendingStore,
    reminderStore,
    reminderScheduler,
    savedMessageStore,
    customCommandStore,
    userStatsStore,
    sendAnimalImage,
    reactToInvokingMessage: messageHandler.reactToInvokingMessage,
    openMeteoApi,
    openTriviaApi,
    translateTrivia,
    triviaManager,
    classStore,
    classScheduler,
    scheduleTimer,
    sendMessage,
    summarizer,
  });
  commandHandler = new CommandHandler({
    sendMessage,
    pendingStore,
    reminderStore,
    reminderScheduler,
    sendPoll,
    classStore,
    classScheduler,
    scheduleTimer,
    adminStore,
    customCommandStore,
    savedMessageStore,
    getBotLid: messageHandler.getBotLid,
    summarizer,
    generateSummary,
    suggestSimilarCommand,
    userStatsStore,
    weeklyReportStore,
    sendAnimalImage,
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
